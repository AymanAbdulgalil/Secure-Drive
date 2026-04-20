"""
core/app/services/auth_verify.py

Local JWT verification for the core service.
Both auth and core share JWT_SECRET — core verifies access tokens without
making a network call to auth. If you later want token revocation/introspection,
replace _get_current_user with an httpx call to auth's /introspect endpoint.
"""

import os
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

_bearer = HTTPBearer()

_ALGORITHM = "HS256"


def _decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(
            token,
            os.environ["JWT_SECRET"],
            algorithms=[_ALGORITHM],
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
) -> dict:
    """
    FastAPI dependency — drop-in replacement for whatever you currently use in
    routes/files.py. Returns the decoded JWT payload dict.

    Usage in a route:
        @router.get("/files")
        async def list_files(user: Annotated[dict, Depends(get_current_user)]):
            user_id = user["sub"]
    """
    return _decode_access_token(credentials.credentials)


# Type alias for cleaner route signatures
CurrentUser = Annotated[dict, Depends(get_current_user)]