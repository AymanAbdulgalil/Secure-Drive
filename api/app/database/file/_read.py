from __future__ import annotations

from uuid import UUID
from asyncpg import Connection
from urllib3.response import BaseHTTPResponse

from ...models.file import File
from ...models.types import SHA256Hex, LogicalPath
from .._common import assert_found
from ._minio_client import get_file_stream


# Allowlist for the ORDER BY column in list_file_meta_by_owner.
# Adding a column here is the only change needed to expose new sort options.
_ALLOWED_ORDER: frozenset[str] = frozenset(
    {"created_at", "current_name", "size_bytes", "updated_at"}
)


async def get_file_meta(
    *,
    conn: Connection,
    file_id: UUID,
) -> File:
    """Fetch the metadata record for a single file.

    Parameters
    ----------
    conn:
        Active asyncpg connection.
    file_id:
        Primary key of the file to retrieve.

    Returns
    -------
    File
        The metadata record for the requested file.

    Raises
    ------
    FileNotFoundError
        If no row with *file_id* exists in the ``files`` table.
    """
    row = await conn.fetchrow(
        "SELECT * FROM files WHERE file_id = $1",
        file_id,
    )
    return File.model_validate(assert_found(row, FileNotFoundError))


async def get_file_meta_by_sha256(
    *,
    conn: Connection,
    sha256_hex: SHA256Hex,
    owner_id: UUID | None = None,
) -> File:
    """Fetch a file record by its SHA-256 content hash.

    Useful for content-addressed look-ups and per-user deduplication checks
    before uploading a file that may already exist in storage.

    Parameters
    ----------
    conn:
        Active asyncpg connection.
    sha256_hex:
        Hex-encoded SHA-256 digest of the file content to look up.
    owner_id:
        When provided, restricts the search to files belonging to this owner.
        Omit (or pass ``None``) to search across all owners.

    Returns
    -------
    File
        The **first** matching metadata record.

    Raises
    ------
    FileNotFoundError
        If no file with the given hash (and optional owner) is found.
    """
    if owner_id is not None:
        row = await conn.fetchrow(
            """
            SELECT * FROM files
            WHERE sha256_hex = $1 AND owner_id = $2
            LIMIT 1
            """,
            sha256_hex,
            owner_id,
        )
    else:
        row = await conn.fetchrow(
            "SELECT * FROM files WHERE sha256_hex = $1 LIMIT 1",
            sha256_hex,
        )
    return File.model_validate(assert_found(row, FileNotFoundError))


async def get_file_meta_and_bytes(
    *,
    conn: Connection,
    file_id: UUID,
) -> tuple[File, BaseHTTPResponse]:
    """Fetch a file's metadata record together with a streaming handle to its bytes.

    The stream is opened lazily by MinIO; no bytes are transferred until the
    caller begins reading from ``BaseHTTPResponse``.  The caller is responsible
    for closing the stream after consumption.

    Parameters
    ----------
    conn:
        Active asyncpg connection.
    file_id:
        Primary key of the file to retrieve.

    Returns
    -------
    tuple[File, BaseHTTPResponse]
        ``(metadata_record, byte_stream)`` — the metadata record and an
        open streaming response from MinIO.

    Raises
    ------
    FileNotFoundError
        If no row with *file_id* exists in the ``files`` table.
    """
    file = await get_file_meta(conn=conn, file_id=file_id)
    file_bytes = get_file_stream(file_id=file_id)
    return file, file_bytes


async def list_file_meta_by_owner(
    *,
    conn: Connection,
    owner_id: UUID,
    limit: int = 50,
    offset: int = 0,
    order_by: str = "created_at",
    ascending: bool = False,
) -> list[File]:
    """Return a paginated, sorted list of all files belonging to an owner.

    Parameters
    ----------
    conn:
        Active asyncpg connection.
    owner_id:
        UUID of the user whose files should be listed.
    limit:
        Maximum number of rows to return (passed directly to ``LIMIT``).
    offset:
        Number of rows to skip before returning results (for cursor-style
        pagination, prefer keyset pagination instead).
    order_by:
        Column used for sorting.  Must be one of:
        ``"created_at"`` (default), ``"current_name"``, ``"size_bytes"``,
        ``"updated_at"``.  Validated against :data:`_ALLOWED_ORDER` to prevent
        SQL injection.
    ascending:
        Sort direction. ``False`` (default) returns the most-recent files
        first; ``True`` returns the oldest / smallest / alphabetically-first.

    Returns
    -------
    list[File]
        Possibly-empty list of file metadata records.

    Raises
    ------
    ValueError
        If *order_by* is not a member of :data:`_ALLOWED_ORDER`.
    """
    if order_by not in _ALLOWED_ORDER:
        raise ValueError(
            f"order_by must be one of {sorted(_ALLOWED_ORDER)!r}, got {order_by!r}."
        )

    direction = "ASC" if ascending else "DESC"
    rows = await conn.fetch(
        f"""
        SELECT * FROM files
        WHERE owner_id = $1
        ORDER BY {order_by} {direction}
        LIMIT $2 OFFSET $3
        """,
        owner_id,
        limit,
        offset,
    )
    return [File.model_validate(row) for row in rows]


async def list_file_meta_by_folder(
    *,
    conn: Connection,
    owner_id: UUID,
    folder: LogicalPath,
    recursive: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> list[File]:
    """Return files stored in a specific logical folder for a given owner.

    Parameters
    ----------
    conn:
        Active asyncpg connection.
    owner_id:
        UUID of the user whose files should be listed.
    folder:
        Logical path to match against the ``folder`` column (e.g. ``"/docs"``).
    recursive:
        When ``True``, returns files in *folder* **and** all of its
        sub-folders via a ``LIKE`` prefix query (e.g. ``"/docs"`` also
        returns ``"/docs/reports"`` and ``"/docs/2024/q1"``).
        When ``False`` (default), only rows with an exact ``folder`` match
        are returned.
    limit:
        Maximum number of rows to return.
    offset:
        Number of rows to skip before returning results.

    Returns
    -------
    list[File]
        Possibly-empty list of file metadata records ordered by
        ``(folder, current_name)``.
    """
    if recursive:
        rows = await conn.fetch(
            """
            SELECT * FROM files
            WHERE owner_id = $1
              AND (folder = $2 OR folder LIKE ($2 || '/%'))
            ORDER BY folder, current_name
            LIMIT $3 OFFSET $4
            """,
            owner_id,
            folder,
            limit,
            offset,
        )
    else:
        rows = await conn.fetch(
            """
            SELECT * FROM files
            WHERE owner_id = $1 AND folder = $2
            ORDER BY current_name
            LIMIT $3 OFFSET $4
            """,
            owner_id,
            folder,
            limit,
            offset,
        )
    return [File.model_validate(row) for row in rows]
