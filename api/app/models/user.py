from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field

from .types import SHA256Hex, Email


class User(BaseModel):
    user_id: UUID
    email: Email
    password_hash: SHA256Hex
    name: str = Field(..., min_length=1, max_length=255)
    
    created_at: datetime
    updated_at: datetime | None
    last_login: datetime | None
    
    storage_used: int = Field(..., ge=0)
    storage_quota: int = Field(..., ge=0)

    verification_version: int = Field(..., ge=0)

    verified: bool
    valid_since: datetime
    is_active: bool


class UserRegister(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: Email
    password: str = Field(..., min_length=8)


class UserLogin(BaseModel):
    email: Email
    password: str = Field(..., min_length=8)


class UserResponse(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: Email
    created_at: datetime
    updated_at: datetime | None
    last_login: datetime | None
    storage_used: int = Field(..., ge=0)
    storage_quota: int = Field(..., ge=0)
