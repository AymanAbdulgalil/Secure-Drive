from __future__ import annotations

import json
import os
import time
from uuid import UUID

from ...database.token.exceptions import (
    TokenExpiredError,
)
from ...models.token import PasswordResetToken
from ..crypto import (
    b64url_decode,
    b64url_encode,
    hmac_sha256_sign,
    hmac_sha256_verify,
    validate_secret,
)

__all__ = [
    "create_password_reset_token",
    "decode_password_reset_token",
]


def create_password_reset_token(
    user_id: UUID,
    version: int,
) -> PasswordResetToken:
    """Create and return a signed email verification token for the given user details."""
    ttl_seconds = int(os.getenv("VERIFICATION_TOKEN_TTL_SECONDS", "86400"))
    secret_key = os.getenv("JWT_SECRET_KEY", "")
    validate_secret(secret_key)

    now = int(time.time())
    token = PasswordResetToken(
        sub=user_id,
        ver=version,
        exp=now + ttl_seconds,
    )
    header = b64url_encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    body = b64url_encode(token.model_dump_json().encode())
    signing_input = f"{header}.{body}"
    token.tok = hmac_sha256_sign(plain_data=signing_input, secret_key=secret_key)
    return token


def decode_password_reset_token(
    signed_token: str,
) -> PasswordResetToken:
    """Validate the token and return the decoded token if valid, otherwise raise an error."""
    secret_key = os.getenv("JWT_SECRET_KEY", "")
    validate_secret(secret_key)

    signing_input = hmac_sha256_verify(signed_data=signed_token, secret_key=secret_key)
    payload = signing_input.split(".", 1)[1]
    raw = json.loads(b64url_decode(payload))
    token = PasswordResetToken(
        sub=UUID(raw["sub"]),
        ver=int(raw["ver"]),
        exp=int(raw["exp"]),
        typ=raw["typ"],
        tok=signed_token,
    )
    now = int(time.time())
    if now >= token.exp:
        raise TokenExpiredError("Token has expired.")

    return token
