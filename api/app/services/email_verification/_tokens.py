from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
from typing import TypedDict
from ....queries.exceptions import (
    TokenError,
    TokenTypeError,
    TokenExpiredError,
    TokenSignatureError,
)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------


_TOKEN_TYPE = "email_verification"
_DEFAULT_TTL_SECONDS = 12 * 60 * 60  # 12 hours


# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------


class _TokenPayload(TypedDict):
    sub: str  # user UUID
    exp: int  # expiry (epoch seconds)
    typ: str  # token type


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(s: str) -> bytes:
    padding = 4 - len(s) % 4
    if padding != 4:
        s += "=" * padding
    return base64.urlsafe_b64decode(s.encode("ascii"))


def _sign(secret: bytes, message: str) -> str:
    sig = hmac.HMAC(secret, message.encode("utf-8"), hashlib.sha256).digest()
    return _b64url_encode(sig)


def _constant_time_compare(a: str, b: str) -> bool:
    return hmac.compare_digest(a.encode("utf-8"), b.encode("utf-8"))


def _validate_secret(secret: bytes) -> None:
    if len(secret) < 32:
        raise ValueError("secret_key must be at least 32 bytes for adequate security.")


# ---------------------------------------------------------------------------
# Encoding / decoding
# ---------------------------------------------------------------------------


def _encode_token(secret: bytes, payload: _TokenPayload) -> str:
    algo = os.getenv("JWT_ALGORITHM", "HS256")
    header = _b64url_encode(json.dumps({"alg": algo, "typ": "JWT"}).encode())
    body = _b64url_encode(json.dumps(payload).encode())
    signing_input = f"{header}.{body}"
    sig = _sign(secret, signing_input)
    return f"{signing_input}.{sig}"


def _decode_and_verify_signature(secret: bytes, token: str) -> _TokenPayload:
    try:
        parts = token.split(".")
        if len(parts) != 3:
            raise TokenError("Wrong format: unexpected number of token segments")
        header_b64, payload_b64, received_sig = parts
        signing_input = f"{header_b64}.{payload_b64}"
        expected_sig = _sign(secret, signing_input)
        if not _constant_time_compare(expected_sig, received_sig):
            raise TokenSignatureError("Token signature verification failed.")
        raw = json.loads(_b64url_decode(payload_b64))
        return _TokenPayload(
            sub=str(raw["sub"]),
            exp=int(raw["exp"]),
            typ=str(raw["typ"]),
        )
    except (KeyError, ValueError, json.JSONDecodeError) as exc:
        raise TokenError(f"Malformed token payload: {exc}") from exc


# ---------------------------------------------------------------------------
# Validation checks
# ---------------------------------------------------------------------------


def _check_type(payload: _TokenPayload) -> None:
    if payload["typ"] != _TOKEN_TYPE:
        raise TokenTypeError(f"Unexpected token type: {payload['typ']!r}")


def _check_expiry(payload: _TokenPayload) -> None:
    if int(time.time()) >= payload["exp"]:
        print(f"Token expired at {payload['exp']} (current time: {int(time.time())})")
        print("Payload:", payload)
        raise TokenExpiredError("Token has expired.")


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def create_token(
    user_id: str,
    ttl_seconds: int = _DEFAULT_TTL_SECONDS, 
) -> str:
    """Create and return a signed email verification token for the given user details."""
    secret_key = os.getenv("JWT_SECRET_KEY", "")
    key = secret_key.encode("utf-8")
    _validate_secret(key)
    now = int(time.time())
    payload = _TokenPayload(
        sub=str(user_id),
        exp=now + ttl_seconds,
        typ=_TOKEN_TYPE,
    )
    signed_token = _encode_token(key, payload)
    print(f"Created token: {signed_token} with payload: {payload}")
    return signed_token


def validate_token(
    signed_token: str,
) -> tuple[str, int]:
    """Validate the token and return the decoded payload if valid, otherwise raise an error."""
    secret_key = os.getenv("JWT_SECRET_KEY", "")
    key = secret_key.encode("utf-8")
    _validate_secret(key)
    payload = _decode_and_verify_signature(key, signed_token)
    _check_type(payload)
    try:
        _check_expiry(payload)
    except TokenExpiredError:
        print(f"token: {signed_token}")
        raise TokenExpiredError("Token has expired.")

    return payload["sub"], payload["exp"]
