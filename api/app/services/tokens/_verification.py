from __future__ import annotations

import os
import time
import json
from uuid import UUID

from ...database.token.exceptions import (
    TokenExpiredError,
)
from ...models.token import VerificationToken
from ..crypto import (
    b64url_encode,
    b64url_decode,
    validate_secret,
    hmac_sha256_sign,
    hmac_sha256_verify,
)


__all__ = [
    "create_verification_token",
    "decode_verification_token",
]


def create_verification_token(
    user_id: UUID,
    version: int,
) -> VerificationToken:
    """Create and return a signed email verification token for the given user details."""
    ttl_seconds = int(os.getenv("VERIFICATION_TOKEN_TTL_SECONDS", "86400"))
    secret_key = os.getenv("JWT_SECRET_KEY", "")
    validate_secret(secret_key)

    now = int(time.time())
    token = VerificationToken(
        sub=user_id,
        ver=version,
        exp=now + ttl_seconds,
    )
    header = b64url_encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    body = b64url_encode(token.model_dump_json().encode())
    signing_input = f"{header}.{body}"
    token.tok = hmac_sha256_sign(plain_data=signing_input, secret_key=secret_key)
    return token


def decode_verification_token(
    signed_token: str,
) -> VerificationToken:
    """Validate the token and return the decoded token if valid, otherwise raise an error."""
    secret_key = os.getenv("JWT_SECRET_KEY", "")
    validate_secret(secret_key)

    signing_input = hmac_sha256_verify(signed_data=signed_token, secret_key=secret_key)
    payload = signing_input.split(".", 1)[1]
    raw = json.loads(b64url_decode(payload))
    token = VerificationToken(
        sub=UUID(raw["sub"]),
        ver=int(raw["ver"]),
        exp=int(raw["exp"]),
        typ=raw["typ"],
        tok=signed_token
    )
    now = int(time.time())
    if now >= token.exp:
        raise TokenExpiredError("Token has expired.")

    return token
