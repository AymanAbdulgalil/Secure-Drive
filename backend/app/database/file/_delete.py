from __future__ import annotations

from uuid import UUID
from asyncpg import Connection

from ._minio_client import remove_file
from .exceptions import FileError


async def delete_file_meta_and_bytes(
    *,
    conn: Connection,
    file_id: UUID,
) -> bool:
    """Delete a file's metadata row and its stored bytes atomically.

    The database ``DELETE`` is executed first inside a transaction.  The
    MinIO ``DELETE`` follows only if the row was removed successfully, so a
    DB failure leaves storage untouched.  If the MinIO call fails after the
    row has been deleted, the bytes become orphaned — callers should treat a
    :exc:`FileError` as a signal that manual clean-up of object storage may
    be required.

    Parameters
    ----------
    conn:
        Active asyncpg connection.  A savepoint transaction is opened
        internally.
    file_id:
        Primary key of the file to permanently delete.

    Returns
    -------
    bool
        Always ``True`` on success (present for use in conditional
        expressions and future extension).

    Raises
    ------
    FileError
        If the database row could not be deleted, meaning the file bytes
        were *not* removed and no orphan was created.
    """
    async with conn.transaction():
        result: str = await conn.execute(
            "DELETE FROM files WHERE file_id = $1",
            file_id,
        )
        if not result.endswith(" 1"):
            raise FileError(
                f"Could not delete the DB record for file '{file_id}'. "
                "The record is now orphaned and doesn't correspond to any bytes."
            )
        remove_file(file_id=file_id)

    return True
