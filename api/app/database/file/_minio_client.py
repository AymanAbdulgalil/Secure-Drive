import os
from uuid import UUID
from typing import BinaryIO, Generator

from minio import Minio
from minio.error import S3Error
from pydantic import BaseModel, computed_field, model_validator
from urllib3.response import BaseHTTPResponse


_MULTIPART_THRESHOLD = 5 * 1024 * 1024  # 5 MB — MinIO's minimum part size


class _MinioSettings(BaseModel):
    model_config = {"frozen": True}

    access_key: str = os.environ.get("MINIO_ROOT_USER", "minioadmin")
    secret_key: str = os.environ.get("MINIO_ROOT_PASSWORD", "minioadmin")
    bucket: str = os.environ.get("MINIO_BUCKET", "drive-files")
    secure: bool = (
        os.environ.get("MINIO_SECURE", "false").lower() == "true"
    )  # was: .lower == "true" (missing call)
    port: str = os.environ.get("MINIO_API_PORT", "9000")
    host: str = os.environ.get("MINIO_HOST", "minio")

    @computed_field  # type: ignore[misc]
    @property
    def endpoint(self) -> str:
        return f"{self.host}:{self.port}"

    @model_validator(mode="after")
    def _validate_secrets(self) -> "_MinioSettings":
        if not self.access_key or not self.secret_key:
            raise ValueError("MINIO_ROOT_USER and MINIO_ROOT_PASSWORD must be set")
        return self


settings = _MinioSettings()

client = Minio(
    endpoint=settings.endpoint,
    access_key=settings.access_key,
    secret_key=settings.secret_key,
    secure=settings.secure,
)


# ---------------------------------------------------------------------------
# Bucket helpers
# ---------------------------------------------------------------------------


def ensure_bucket() -> None:
    """Create the configured bucket if it does not already exist."""
    try:
        if not client.bucket_exists(settings.bucket):
            client.make_bucket(settings.bucket)
    except S3Error as exc:
        raise


# ---------------------------------------------------------------------------
# Object operations
# ---------------------------------------------------------------------------


def put_file(
    *,
    file_id: UUID,
    file_bytes: BinaryIO,
    size_bytes: int,
    content_type: str = "application/octet-stream",
) -> None:
    """Upload a file-like object to MinIO.

    Args:
        file_id:      Unique identifier used as the object key.
        file_bytes:   Readable binary stream.
        size_bytes:   Exact byte length, or ``-1`` for unknown length
                      (triggers chunked / multipart upload with a 5 MB part
                      size so MinIO can buffer the stream internally).
        content_type: MIME type stored as object metadata.

    Raises:
        S3Error: On any MinIO / S3 protocol error.
    """
    ensure_bucket()

    part_size = _MULTIPART_THRESHOLD if size_bytes == -1 else 0

    try:
        client.put_object(
            settings.bucket,
            str(file_id),
            file_bytes,
            length=size_bytes,
            part_size=part_size,
            content_type=content_type,
        )
    except S3Error:
        raise


def get_file_stream(file_id: UUID) -> BaseHTTPResponse:
    """Return a streaming MinIO response for the given object.

    **The caller is responsible for closing the response:**

    .. code-block:: python

        stream = get_file_stream(file_id)
        try:
            for chunk in stream:
                ...
        finally:
            stream.close()
            stream.release_conn()

    Raises:
        S3Error: If the object does not exist or cannot be read.
    """
    try:
        return client.get_object(settings.bucket, str(file_id))
    except S3Error:
        raise


def get_file_chunks(
    file_id: UUID,
    chunk_size: int = 65_536,
) -> Generator[bytes, None, None]:
    """Yield raw bytes chunks for *file_id*, closing the connection on exit.

    Prefer this over :func:`get_file_stream` when you only need the raw bytes
    and don't want to manage the connection lifetime yourself.
    """
    stream = get_file_stream(file_id)
    try:
        yield from stream.stream(chunk_size)
    finally:
        stream.close()
        stream.release_conn()


def file_exists(file_id: UUID) -> bool:
    """Return ``True`` if the object exists, ``False`` otherwise."""
    try:
        client.stat_object(settings.bucket, str(file_id))
        return True
    except S3Error as exc:
        if exc.code == "NoSuchKey":
            return False
        raise


def remove_file(file_id: UUID) -> None:
    """Delete an object from MinIO storage.

    This is a no-op if the object does not exist (idempotent delete).

    Args:
        file_id: The object key to delete.

    Raises:
        S3Error: On unexpected MinIO / S3 errors.
    """
    try:
        client.remove_object(settings.bucket, str(file_id))
    except S3Error as exc:
        if exc.code == "NoSuchKey":
            return
        raise
