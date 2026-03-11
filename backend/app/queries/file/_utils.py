from __future__ import annotations

from uuid import UUID
from asyncpg import Connection

from ._minio_client import file_exists


async def count_file_meta_by_owner(
    *,
    conn: Connection,
    owner_id: UUID,
) -> int:
    """Return the total number of files owned by *owner_id*.

    Parameters
    ----------
    conn:
        Active asyncpg connection.
    owner_id:
        UUID of the target user.

    Returns
    -------
    int
        Row count; ``0`` if the owner has no files.
    """
    return await conn.fetchval(  # type: ignore[return-value]
        "SELECT COUNT(*) FROM files WHERE owner_id = $1",
        owner_id,
    )


async def total_bytes_by_owner(
    *,
    conn: Connection,
    owner_id: UUID,
) -> int:
    """Return the aggregate stored size (in bytes) for all files owned by *owner_id*.

    Parameters
    ----------
    conn:
        Active asyncpg connection.
    owner_id:
        UUID of the target user.

    Returns
    -------
    int
        Sum of ``size_bytes`` across all matching rows; ``0`` if the owner
        has no files (``COALESCE`` prevents a ``NULL`` return).
    """
    value = await conn.fetchval(
        "SELECT COALESCE(SUM(size_bytes), 0) FROM files WHERE owner_id = $1",
        owner_id,
    )
    return int(value)  # type: ignore[arg-type]


async def file_meta_and_bytes_exists(
    *,
    conn: Connection,
    file_id: UUID,
) -> bool:
    """Check whether a file exists in both the database and object storage.

    Uses a lightweight ``EXISTS`` sub-query instead of fetching the full row,
    and only calls the MinIO existence check when the DB row is present (short-
    circuit evaluation).

    Parameters
    ----------
    conn:
        Active asyncpg connection.
    file_id:
        Primary key of the file to check.

    Returns
    -------
    bool
        ``True`` only if *both* the metadata row and the stored bytes exist;
        ``False`` otherwise.
    """
    value = await conn.fetchval(
        "SELECT EXISTS(SELECT 1 FROM files WHERE file_id = $1)",
        file_id,
    )
    return bool(value) and file_exists(file_id=file_id)
