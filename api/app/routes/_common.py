from __future__ import annotations

import asyncpg
from fastapi import Request, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from collections.abc import AsyncGenerator


async def get_db(request: Request) -> AsyncGenerator[asyncpg.Connection, None]:
    async with request.app.state.pool.acquire() as conn:
        yield conn


async def get_token(
    credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer()),
) -> AsyncGenerator[str, None]:
    token = credentials.credentials  # the raw token, "Bearer" already stripped
    # validate token, fetch user, etc.
    yield token
