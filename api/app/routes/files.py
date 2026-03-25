import hashlib
import re
from pathlib import PurePosixPath
from tempfile import NamedTemporaryFile
from uuid import UUID

import asyncpg
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import StreamingResponse

from ..database.file import (
    count_file_meta_by_owner,
    create_file_meta_and_bytes,
    delete_file_meta_and_bytes,
    get_file_meta,
    get_file_meta_and_bytes,
    list_file_meta_by_folder,
    list_file_meta_by_owner,
    move_file_meta,
    rename_file_meta,
    total_bytes_by_owner,
)
from ..database.file._minio_client import settings as minio_settings
from ..database.file.exceptions import FileNotFoundError
from ..models.file import FileCreate
from ..models.types import LogicalPath
from ..services.tokens import decode_access_token
from ._common import get_db, get_token

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


def _normalize_folder(raw: str | None) -> LogicalPath:
    """
    Convert a user-supplied folder string to a canonical DB folder path.

    Rules
    -----
    - ``None`` or empty → root  → ``PurePosixPath("/")``
    - Otherwise sanitize, strip leading/trailing slashes, prepend ``/``
      e.g. ``"docs/reports/"`` → ``PurePosixPath("/docs/reports")``
    """
    if not raw or not raw.strip():
        return PurePosixPath("/")
    clean = _sanitize_filename(raw.strip("/"))
    return PurePosixPath(f"/{clean}")


def _require_token(token: str) -> dict:
    """Decode and validate the bearer token, raising 401 on failure."""
    try:
        return decode_access_token(token).model_dump()
    except Exception as exc:
        raise HTTPException(status_code=401, detail=str(exc))


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
    owner_id = tok["sub"]

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

        file_meta = FileCreate(
            owner_id=owner_id,
            bucket=minio_settings.bucket,
            folder=folder_path,
            name=current_name,
            mime_type=file.content_type or "application/octet-stream",
            size_bytes=size,
            sha256_hex=h.hexdigest(),
        )

        try:
            meta = await create_file_meta_and_bytes(
                conn=conn,
                file_meta=file_meta,
                file_bytes=tmp,  # type: ignore[arg-type]
            )
        except asyncpg.UniqueViolationError:
            raise HTTPException(status_code=409, detail="File key conflict; please retry")
        except asyncpg.ForeignKeyViolationError:
            raise HTTPException(status_code=400, detail="Owner account not found")

    return meta.model_dump()


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
    owner_id = tok["sub"]

    if sort_by not in _ALLOWED_SORT:
        raise HTTPException(
            status_code=400,
            detail=f"sort_by must be one of {sorted(_ALLOWED_SORT)}",
        )

    ascending = sort_order.lower() == "asc"

    if folder is not None:
        canonical = _normalize_folder(folder)
        rows = await list_file_meta_by_folder(
            conn=conn,
            owner_id=owner_id,
            folder=canonical,
            limit=limit,
            offset=offset,
        )
        total = await conn.fetchval(
            "SELECT COUNT(*) FROM files WHERE owner_id = $1 AND folder = $2",
            owner_id,
            canonical,
        )
    else:
        rows = await list_file_meta_by_owner(
            conn=conn,
            owner_id=owner_id,
            limit=limit,
            offset=offset,
            order_by=sort_by,
            ascending=ascending,
        )
        total = await count_file_meta_by_owner(conn=conn, owner_id=owner_id)

    return {
        "items": [r.model_dump() for r in rows],
        "total_count": total,
        "limit": limit,
        "offset": offset,
        "has_more": (offset + limit) < total,  # type: ignore
    }


# ─── GET /files/folders ───────────────────────────────────────────────────────

@router.get("/folders")
async def list_folders(
    conn: asyncpg.Connection = Depends(get_db),
    token: str = Depends(get_token),
):
    """Return the distinct folder paths that belong to the current user, with file counts."""
    tok = _require_token(token)
    owner_id = tok["sub"]

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
    owner_id = tok["sub"]

    total_files = await count_file_meta_by_owner(conn=conn, owner_id=owner_id)
    total_bytes = await total_bytes_by_owner(conn=conn, owner_id=owner_id)

    return {
        "total_files": total_files,
        "total_bytes": total_bytes,
        "total_mb": round(total_bytes / (1024 * 1024), 2),
    }


# ─── GET /files/{file_id} ─────────────────────────────────────────────────────

@router.get("/{file_id}")
async def download_file(
    file_id: UUID,
    conn: asyncpg.Connection = Depends(get_db),
    token: str = Depends(get_token),
):
    """Stream a file download. The browser will trigger a Save dialog."""
    tok = _require_token(token)
    owner_id = tok["sub"]

    try:
        file_uuid = file_id
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid file_id format")

    try:
        meta, obj = await get_file_meta_and_bytes(conn=conn, file_id=file_uuid)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")

    if meta.owner_id != owner_id:
        obj.close()
        obj.release_conn()
        raise HTTPException(status_code=403, detail="Access denied")

    def _iterator():
        try:
            for chunk in obj.stream(_CHUNK_SIZE):
                yield chunk
        finally:
            obj.close()
            obj.release_conn()

    headers = {
        "Content-Disposition": f'attachment; filename="{_sanitize_filename(meta.current_name)}"',
        "X-Content-SHA256": meta.sha256_hex,
    }
    return StreamingResponse(
        _iterator(),
        media_type=meta.mime_type or "application/octet-stream",
        headers=headers,
    )


# ─── DELETE /files/{file_id} ──────────────────────────────────────────────────

@router.delete("/{file_id}", status_code=status.HTTP_200_OK)
async def delete_file_endpoint(
    file_id: UUID,
    conn: asyncpg.Connection = Depends(get_db),
    token: str = Depends(get_token),
):
    """Delete a file from object storage and remove its database record."""
    tok = _require_token(token)
    owner_id = tok["sub"]

    try:
        file_uuid = file_id
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid file_id format")

    try:
        meta = await get_file_meta(conn=conn, file_id=file_uuid)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")

    if meta.owner_id != owner_id:
        raise HTTPException(status_code=403, detail="Access denied")

    await delete_file_meta_and_bytes(conn=conn, file_id=file_uuid)

    return {"success": True, "file_id": file_id, "message": "File deleted successfully"}


# ─── PATCH /files/{file_id} ───────────────────────────────────────────────────

@router.patch("/{file_id}")
async def update_file_metadata(
    file_id: UUID,
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
    owner_id = tok["sub"]

    try:
        file_uuid = file_id
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid file_id format")

    try:
        meta = await get_file_meta(conn=conn, file_id=file_uuid)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")

    if meta.owner_id != owner_id:
        raise HTTPException(status_code=403, detail="Access denied")

    if name is not None:
        meta = await rename_file_meta(
            conn=conn,
            file_id=file_uuid,
            new_name=_sanitize_filename(name),
        )

    if folder is not None:
        meta = await move_file_meta(
            conn=conn,
            file_id=file_uuid,
            folder=_normalize_folder(folder),
        )

    return meta.model_dump()