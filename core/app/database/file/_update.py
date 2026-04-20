from __future__ import annotations

from uuid import UUID

from asyncpg import Connection

from ...models.file import File
from ...models.types import Bucket, LogicalPath
from .._common import assert_found
from ._read import get_file_meta


async def rename_file_meta(
    *,
    conn: Connection,
    file_id: UUID,
    new_name: str,
) -> File:
    """Update the display name of an existing file.

    Only ``current_name`` is changed; ``original_name`` is preserved as an
    immutable audit field.

    Parameters
    ----------
    conn:
        Active asyncpg connection.
    file_id:
        Primary key of the file to rename.
    new_name:
        Replacement value for ``current_name``.  Must be non-blank (enforced
        by the database constraint ``chk_files_names_not_blank``).

    Returns
    -------
    File
        The updated metadata record.

    Raises
    ------
    FileNotFoundError
        If no row with *file_id* exists.
    asyncpg.CheckViolationError
        If *new_name* is an empty string or whitespace-only.
    """
    row = await conn.fetchrow(
        """
        UPDATE files
        SET current_name = $2
        WHERE file_id = $1
        RETURNING *
        """,
        file_id,
        new_name,
    )
    return File.model_validate(dict(assert_found(row, FileNotFoundError)))


async def move_file_meta(
    *,
    conn: Connection,
    file_id: UUID,
    bucket: Bucket | None = None,
    folder: LogicalPath | None = None,
) -> File:
    """Relocate a file by updating its bucket, folder, or both.

    Only the fields explicitly passed (i.e. not ``None``) are written to the
    database, allowing callers to move across buckets, into a sub-folder, or
    both in a single round-trip.  Passing neither argument is a no-op and
    returns the current record without issuing an ``UPDATE``.

    Parameters
    ----------
    conn:
        Active asyncpg connection.
    file_id:
        Primary key of the file to move.
    bucket:
        New bucket name, or ``None`` to leave unchanged.
    folder:
        New logical folder path, or ``None`` to leave unchanged.  Must be an
        absolute ``PurePosixPath`` with no ``..`` segments (enforced by the
        ``LogicalPath`` type and the database constraint
        ``chk_files_folder_starts_with_slash``).

    Returns
    -------
    File
        The updated metadata record (or the unchanged record if neither
        *bucket* nor *folder* was provided).

    Raises
    ------
    FileNotFoundError
        If no row with *file_id* exists.
    asyncpg.CheckViolationError
        If *folder* does not start with ``"/"``.
    """
    updates: list[str] = []
    params: list[object] = [file_id]

    if bucket is not None:
        params.append(bucket)
        updates.append(f"bucket = ${len(params)}")
    if folder is not None:
        params.append(str(folder))  # asyncpg expects str, not PurePosixPath
        updates.append(f"folder = ${len(params)}")

    if not updates:
        return await get_file_meta(conn=conn, file_id=file_id)

    set_clause = ", ".join(updates)
    row = await conn.fetchrow(
        f"""
        UPDATE files
        SET {set_clause}
        WHERE file_id = $1
        RETURNING *
        """,
        *params,
    )
    return File.model_validate(dict(assert_found(row, FileNotFoundError)))
