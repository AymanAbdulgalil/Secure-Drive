import re
import uuid
import hashlib
from tempfile import NamedTemporaryFile

import asyncpg
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from ._common import get_db, get_token
from ..database.file import (
    create_file,
    get_file_by_id,
    list_files_by_owner,
    list_files_by_folder,
    rename_file,
    move_file,
    delete_file as repo_delete_file,
    count_files_by_owner,
    total_bytes_by_owner,
)
from ..auth.utils import decode_token

router = APIRouter(prefix="/files", tags=["files"])
_CHUNK_SIZE = 1024 * 1024  # 1 MiB

_ALLOWED_SORT = {"created_at", "current_name", "size_bytes", "updated_at"}


# ─── helpers ──────────────────────────────────────────────────────────────────

def _sanitize_filename(name: str) -> str:
    """Remove dangerous characters from a filename."""
    if not name:
        return "unnamed"
    name = re.sub(r'[/\\"\'\x00-\x1f]', "", name)
    return name[:255].strip() or "unnamed"


def _normalize_folder(raw: str | None) -> str:
    """
    Convert a user-supplied folder string to a canonical DB folder path.

    Rules
    -----
    - ``None`` or empty → root  → ``"/"``
    - Otherwise sanitize, strip leading/trailing slashes, prepend ``/``
      e.g. ``"docs/reports/"`` → ``"/docs/reports"``
    """
    if not raw or not raw.strip():
        return "/"
    clean = _sanitize_filename(raw.strip("/"))
    return f"/{clean}"


def _require_token(token: str) -> dict:
    """Decode token or raise 401."""
    tok = decode_token(token)
    if not tok:
        raise HTTPException(status_code=401, detail="Invalid authentication token")
    return tok


def _serialize(f: FileMeta) -> dict:
    """Serialize a FileMeta TypedDict for JSON responses."""
    return {
        "file_id": str(f["file_id"]),
        "name": f["current_name"],
        "original_name": f["original_name"],
        "folder": f["folder"],
        "content_type": f["content_type"],
        "size_bytes": f["size_bytes"],
        "sha256": f["sha256_hex"],
        "created_at": f["created_at"].isoformat(),
        "updated_at": f["updated_at"].isoformat() if f["updated_at"] else None,
    }


# ─── POST /files ──────────────────────────────────────────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED)
async def upload_file(
    folder: str | None = Form(None),
    logical_name: str | None = Form(None),
    file: UploadFile = File(...),
    conn: asyncpg.Connection = Depends(get_db),
    token: str = Depends(get_token),
):
    """Upload a file to object storage and record its metadata."""
    tok = _require_token(token)
    owner_id = uuid.UUID(tok["sub"])

    file_uuid = uuid.uuid4()
    file_key = make_file_key(user_id=owner_id, file_uuid=file_uuid)
    folder_path = _normalize_folder(folder)
    current_name = _sanitize_filename(logical_name or file.filename or "unnamed")

    with NamedTemporaryFile(delete=True) as tmp:
        h = hashlib.sha256()
        size = 0

        while chunk := await file.read(_CHUNK_SIZE):
            tmp.write(chunk)
            h.update(chunk)
            size += len(chunk)

        if size == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")

        tmp.seek(0)
        put_bytes(
            file_key=file_key,
            data=tmp,  # type: ignore[arg-type]
            length=size,
            content_type=file.content_type or "application/octet-stream",
            metadata={"original-name": file.filename or ""},
        )

    try:
        meta = await create_file(
            conn=conn,
            file_id=file_uuid,
            owner_id=owner_id,
            bucket=settings.bucket,
            file_key=file_key,
            original_name=current_name,
            current_name=current_name,
            folder=folder_path,
            content_type=file.content_type,
            size_bytes=size,
            sha256_hex=h.hexdigest(),
        )
    except asyncpg.UniqueViolationError:
        # file_key collision (should not happen with uuid4, but be safe)
        minio_delete_file(file_key)
        raise HTTPException(status_code=409, detail="File key conflict; please retry")
    except asyncpg.ForeignKeyViolationError:
        minio_delete_file(file_key)
        raise HTTPException(status_code=400, detail="Owner account not found")

    return _serialize(meta)


# ─── GET /files ───────────────────────────────────────────────────────────────

@router.get("")
async def list_files(
    folder: str | None = Query(None, description="Filter by folder path (omit for all files)"),
    sort_by: str = Query("created_at", description="Sort field: current_name, size_bytes, created_at, updated_at"),
    sort_order: str = Query("desc", description="Sort order: asc or desc"),
    limit: int = Query(100, ge=1, le=1000, description="Max results"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    conn: asyncpg.Connection = Depends(get_db),
    token: str = Depends(get_token),
):
    """
    List the current user's files with optional folder filtering and pagination.

    - **folder**: omit to return all files; ``/`` for root; ``/docs`` for a sub-folder
    - **sort_by**: ``current_name`` | ``size_bytes`` | ``created_at`` | ``updated_at``
    - **sort_order**: ``asc`` or ``desc``
    - **limit** / **offset**: pagination
    """
    tok = _require_token(token)
    owner_id = uuid.UUID(tok["sub"])

    if sort_by not in _ALLOWED_SORT:
        raise HTTPException(
            status_code=400,
            detail=f"sort_by must be one of {sorted(_ALLOWED_SORT)}",
        )

    ascending = sort_order.lower() == "asc"

    if folder is not None:
        # Caller explicitly wants a specific folder
        canonical = _normalize_folder(folder)
        rows = await list_files_by_folder(
            conn,
            owner_id,
            canonical,
            limit=limit,
            offset=offset,
        )
        # Count for has_more
        total = await conn.fetchval(
            "SELECT COUNT(*) FROM files WHERE owner_id = $1 AND folder = $2",
            owner_id,
            canonical,
        )
    else:
        rows = await list_files_by_owner(
            conn,
            owner_id,
            limit=limit,
            offset=offset,
            order_by=sort_by,
            ascending=ascending,
        )
        total = await count_files_by_owner(conn, owner_id)

    return {
        "items": [_serialize(r) for r in rows],
        "total_count": total,
        "limit": limit,
        "offset": offset,
        "has_more": (offset + limit) < total, # type: ignore
    }


# ─── GET /files/folders ───────────────────────────────────────────────────────

@router.get("/folders")
async def list_folders(
    conn: asyncpg.Connection = Depends(get_db),
    token: str = Depends(get_token),
):
    """Return the distinct folder paths that belong to the current user, with file counts."""
    tok = _require_token(token)
    owner_id = uuid.UUID(tok["sub"])

    rows = await conn.fetch(
        """
        SELECT folder, COUNT(*) AS file_count
        FROM files
        WHERE owner_id = $1
        GROUP BY folder
        ORDER BY folder
        """,
        owner_id,
    )

    folders = [
        {"name": r["folder"], "file_count": r["file_count"]}
        for r in rows
        if r["folder"] != "/"
    ]
    root_count = next(
        (r["file_count"] for r in rows if r["folder"] == "/"), 0
    )

    return {"folders": folders, "root_file_count": root_count}


# ─── GET /files/stats ─────────────────────────────────────────────────────────

@router.get("/stats")
async def get_storage_stats(
    conn: asyncpg.Connection = Depends(get_db),
    token: str = Depends(get_token),
):
    """Return aggregate storage statistics for the current user."""
    tok = _require_token(token)
    owner_id = uuid.UUID(tok["sub"])

    total_files = await count_files_by_owner(conn, owner_id)
    total_bytes = await total_bytes_by_owner(conn, owner_id)

    return {
        "total_files": total_files,
        "total_bytes": total_bytes,
        "total_mb": round(total_bytes / (1024 * 1024), 2),
    }


# ─── GET /files/{file_id} ─────────────────────────────────────────────────────

@router.get("/{file_id}")
async def download_file(
    file_id: str,
    conn: asyncpg.Connection = Depends(get_db),
    token: str = Depends(get_token),
):
    """Stream a file download. The browser will trigger a Save dialog."""
    tok = _require_token(token)
    owner_id = uuid.UUID(tok["sub"])

    try:
        file_uuid = uuid.UUID(file_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid file_id format")

    meta = await get_file_by_id(conn, file_uuid)
    if not meta:
        raise HTTPException(status_code=404, detail="File not found")
    if meta["owner_id"] != owner_id:
        raise HTTPException(status_code=403, detail="Access denied")

    obj = get_file_stream(meta["file_key"])

    def _iterator():
        try:
            for chunk in obj.stream(_CHUNK_SIZE):
                yield chunk
        finally:
            obj.close()
            obj.release_conn()

    headers = {
        "Content-Disposition": f'attachment; filename="{_sanitize_filename(meta["current_name"])}"',
        "X-Content-SHA256": meta["sha256_hex"],
    }
    return StreamingResponse(
        _iterator(),
        media_type=meta["content_type"] or "application/octet-stream",
        headers=headers,
    )


# ─── DELETE /files/{file_id} ──────────────────────────────────────────────────

@router.delete("/{file_id}", status_code=status.HTTP_200_OK)
async def delete_file_endpoint(
    file_id: str,
    conn: asyncpg.Connection = Depends(get_db),
    token: str = Depends(get_token),
):
    """Delete a file from object storage and remove its database record."""
    tok = _require_token(token)
    owner_id = uuid.UUID(tok["sub"])

    try:
        file_uuid = uuid.UUID(file_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid file_id format")

    meta = await get_file_by_id(conn, file_uuid)
    if not meta:
        raise HTTPException(status_code=404, detail="File not found")
    if meta["owner_id"] != owner_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Best-effort MinIO delete; DB record is authoritative
    try:
        minio_delete_file(str(meta["file_key"]))
    except Exception as exc:
        # Log and continue - stale objects can be cleaned up separately

    await repo_delete_file(conn, file_uuid)

    return {"success": True, "file_id": file_id, "message": "File deleted successfully"}


# ─── PATCH /files/{file_id} ───────────────────────────────────────────────────

@router.patch("/{file_id}")
async def update_file_metadata(
    file_id: str,
    name: str | None = Form(None),
    folder: str | None = Form(None),
    conn: asyncpg.Connection = Depends(get_db),
    token: str = Depends(get_token),
):
    """
    Update file metadata (rename or move to a different folder).

    - **name**: new display name (updates ``current_name`` only)
    - **folder**: new folder path; ``""`` or ``"/"`` moves the file to root
    """
    tok = _require_token(token)
    owner_id = uuid.UUID(tok["sub"])

    try:
        file_uuid = uuid.UUID(file_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid file_id format")

    meta = await get_file_by_id(conn, file_uuid)
    if not meta:
        raise HTTPException(status_code=404, detail="File not found")
    if meta["owner_id"] != owner_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Apply rename if requested
    if name is not None:
        updated = await rename_file(conn, file_uuid, _sanitize_filename(name))
        if updated:
            meta = updated

    # Apply folder move if requested
    if folder is not None:
        updated = await move_file(conn, file_uuid, folder=_normalize_folder(folder))
        if updated:
            meta = updated

    return _serialize(meta)