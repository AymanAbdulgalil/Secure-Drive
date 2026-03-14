from __future__ import annotations

import hashlib
import secrets




__all__ = [
    "generate_refresh_token",
    "hash_refresh_token",
]

def create_refresh_token() -> str:
    """
    Generate a cryptographically secure opaque refresh token.
    Returns the RAW token — only ever seen once, returned to the client.
    Store only the hash of this.
    """
    return secrets.token_urlsafe(64)  # 86 chars, 512 bits of entropy


def hash_refresh_token(raw_token: str) -> str:
    """
    Hash a raw refresh token for safe DB storage.
    SHA-256 is sufficient — tokens are already high-entropy random strings.
    """
    return hashlib.sha256(raw_token.encode()).hexdigest()