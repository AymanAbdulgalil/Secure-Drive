from __future__ import annotations

import hmac
import base64
import hashlib
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from ...models.types import SHA256Hex


__all__ = [
    "b64url_encode",
    "b64url_decode",
    "validate_secret",
    "hash_password",
    "verify_password",
    "sha256_hash",
    "hmac_sha256_sign",
    "hmac_sha256_verify"
]


def b64url_encode(data: bytes) -> str:
    """Encode bytes to a URL-safe Base64 string without padding."""
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def b64url_decode(encoded_str: str) -> bytes:
    """Decode a URL-safe Base64 string back to bytes."""
    # Add back the stripped padding before decoding
    padding = "=" * (4 - (len(encoded_str) % 4))
    return base64.urlsafe_b64decode(encoded_str + padding)


def validate_secret(secret: str, min_length: int = 32) -> bool:
    """
    Validates if a secret meets security standards.
    Standard: At least 32 characters (256 bits of entropy).
    """
    if len(secret) < min_length:
        raise ValueError(f"Secret is too weak! Must be at least {min_length} characters.")
    return True


ph = PasswordHasher()   # uses secure defaults for Argon2id.


def hash_password(password: str) -> str:
    """Hash a plaintext password using Argon2id."""
    return ph.hash(password)


def verify_password(*, plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against its Argon2 hash."""
    try:
        return ph.verify(hashed_password, plain_password)
    except VerifyMismatchError:
        return False


def sha256_hash(data: str) -> SHA256Hex:
    """
    Generate a SHA-256 hex digest of a string.
    WARNING: Use for data integrity/checksums, NEVER for passwords.
    """
    # hashlib requires bytes, so we encode the string to utf-8
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


def hmac_sha256_sign(*, plain_data: str, secret_key: str) -> str:
    """
    Sign a string using HMAC-SHA256. 
    Returns a string in the format: "original_data.signature"
    """
    signature: SHA256Hex = hmac.new(
        key=secret_key.encode("utf-8"),
        msg=plain_data.encode("utf-8"),
        digestmod=hashlib.sha256
    ).hexdigest()
    
    return f"{plain_data}.{signature}"


def hmac_sha256_verify(*, signed_data: str, secret_key: str) -> str:
    """
    Verify a signed string. 
    Returns the original data if the signature is valid, or None if tampered with.
    """
    
    parts = signed_data.rsplit(".", 1)
    if len(parts) < 2:
        raise ValueError(f"Signed data invalid format. Expected at least two '.' separated parts, got {len(parts)} instead.")
    
    signature: SHA256Hex = parts[-1]
    data: str = signed_data[:-(len(signature) + 1)]
    
    expected_signature = hmac.new(
        key=secret_key.encode("utf-8"),
        msg=data.encode("utf-8"),
        digestmod=hashlib.sha256
    ).hexdigest()

    # CRITICAL: Use compare_digest to prevent timing attacks!
    if not hmac.compare_digest(signature, expected_signature):
        raise ValueError("Passed signature and the data signature don't match according to the provided secret.")
        
    return data