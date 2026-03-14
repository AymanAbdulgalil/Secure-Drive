from __future__ import annotations

from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field, field_serializer, model_validator
from pydantic.networks import IPvAnyAddress
from typing import Literal

from .types import SHA256Hex


class RefreshToken(BaseModel):
    token_id: UUID
    user_id: UUID

    token_hash: SHA256Hex

    issued_at: datetime
    expires_at: datetime

    revoked: bool = False
    revoked_at: datetime | None = None

    family_id: UUID
    superseded_by: UUID | None = None

    device_info: str = Field(..., min_length=1)
    ip_address: IPvAnyAddress
    last_used_at: datetime | None = None

    @field_serializer("ip_address", "token_id", "user_id", "family_id", "superseded_by")
    def serialize_ip(self, value) -> str:
        return str(value)

    @model_validator(mode="after")
    def check_integrity(self) -> "RefreshToken":
        if self.issued_at >= self.expires_at:
            raise ValueError("expires_at must be after issued_at")
        if self.revoked and self.revoked_at is None:
            raise ValueError("revoked_at must be set when revoked is True")
        if not self.revoked and self.revoked_at is not None:
            raise ValueError("revoked_at should not be set when revoked is False")
        return self


class RefreshTokenCreate(BaseModel):
    user_id: UUID
    token_hash: SHA256Hex
    family_id: UUID
    device_info: str = Field(..., min_length=1)
    ip_address: IPvAnyAddress

    @field_serializer("ip_address")
    def serialize_ip(self, address) -> str:
        return str(address)


class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(..., min_length=1)


class VerificationToken(BaseModel):
    sub: UUID
    ver: int = Field(..., ge=0)
    exp: int = Field(..., gt=0)
    typ: Literal["verification"] = "verification"
    tok: str | None = Field(
        default=None, exclude=True, min_length=66   # sha256 hash + . + token json dump
    )


class AccessToken(BaseModel):
    sub: UUID
    ver: int = Field(..., ge=0)
    exp: int = Field(..., ge=0)
    typ: Literal["access"] = "access"
    tok: str | None = Field(
        default=None, exclude=True, min_length=66   # sha256 hash + . + token json dump
    )
