from __future__ import annotations

from asyncpg import Connection
from typing import BinaryIO
from uuid import uuid4

from ...models.file import File, FileCreate
from ._minio_client import put_file
from .._common import assert_found
from .exceptions import FileNotFoundError, FileCreateError


async def create_file_meta_and_bytes(
    *,
    conn: Connection,
    file_meta: FileCreate,
    file_bytes: BinaryIO,
) -> File:
    """Insert a metadata row and upload the file bytes to object storage.

    The database insert and the MinIO ``PUT`` are sequenced so that bytes are
    only written *after* the row has been committed.  If the insert fails the
    transaction is rolled back and no bytes are written; if the ``PUT`` fails
    the row is already committed, so the caller should treat a
    :exc:`FileCreateError` as a signal to retry or clean up.

    Parameters
    ----------
    conn:
        Active asyncpg connection. A savepoint transaction is opened
        internally.
    file_meta:
        Value object describing the file to create (owner, bucket, folder,
        name, MIME type, size, and SHA-256 hash).
    file_bytes:
        Readable binary stream whose content will be uploaded to MinIO under
        the newly generated ``file_id``.

    Returns
    -------
    File
        The fully-populated metadata record as persisted in the database.

    Raises
    ------
    asyncpg.UniqueViolationError
        If a row with the generated ``file_id`` already exists (astronomically
        unlikely with UUID v4, but surfaced for completeness).
    asyncpg.ForeignKeyViolationError
        If ``file_meta.owner_id`` does not reference a valid user row.
    asyncpg.CheckViolationError
        If any database constraint is violated (e.g. blank name, invalid hash
        format, folder not starting with ``/``).
    FileCreateError
        If the metadata row could not be inserted for any other reason.
    """
    file_id = uuid4()

    try:
        async with conn.transaction():
            row = await conn.fetchrow(
                """
                INSERT INTO files (
                    file_id, owner_id,
                    bucket, folder,
                    original_name, current_name,
                    mime_type, size_bytes, sha256_hex
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
                """,
                file_id,
                file_meta.owner_id,
                file_meta.bucket,
                file_meta.folder,
                file_meta.name,
                file_meta.name,
                file_meta.mime_type,
                file_meta.size_bytes,
                file_meta.sha256_hex,
            )
            if assert_found(row, FileNotFoundError):
                put_file(
                    file_id=file_id,
                    file_bytes=file_bytes,
                    size_bytes=file_meta.size_bytes,
                )
    except FileNotFoundError:
        raise FileCreateError(f"Could not create file '{file_meta.name}'.")

    return File.model_validate(row)
