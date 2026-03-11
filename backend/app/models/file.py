from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field

from .types import SHA256Hex, LogicalPath, Bucket, MimeType


class File(BaseModel):
    file_id: UUID
    owner_id: UUID

    bucket: Bucket
    folder: LogicalPath

    original_name: str = Field(..., min_length=1)
    current_name: str = Field(..., min_length=1)
    mime_type: MimeType
    size_bytes: int = Field(..., gt=0)
    sha256_hex: SHA256Hex

    created_at: datetime
    updated_at: datetime | None


class FileCreate(BaseModel):
    owner_id: UUID
    bucket: Bucket
    folder: LogicalPath
    name: str = Field(..., min_length=1)
    mime_type: MimeType
    size_bytes: int = Field(..., gt=0)
    sha256_hex: SHA256Hex


class FileUpdate(BaseModel):
    owner_id: UUID
    name: str = Field(..., min_length=1)
    mime_type: MimeType
    folder: LogicalPath


class FileResponcse(BaseModel):
    owner: str = Field(..., min_length=1)
    folder: LogicalPath
    current_name: str = Field(..., min_length=1)
    mime_type: MimeType
    size_bytes: int = Field(..., gt=0)
    sha256_hex: SHA256Hex
    created_at: datetime
    updated_at: datetime