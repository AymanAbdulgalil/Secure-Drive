from __future__ import annotations

from datetime import datetime

from asyncpg import Connection

from ...models.token import RefreshToken, RefreshTokenCreate
from .._common import assert_found
from .exceptions import TokenCreateError, TokenNotFoundError


async def create_refresh_token(
    *,
    conn: Connection,
    refresh_token: RefreshTokenCreate,
    expires_at: datetime,
) -> RefreshToken:
    """Insert a new refresh token and return the persisted row.

    Parameters
    ----------
    conn:
        Active asyncpg connection (or connection acquired from a pool).
    refresh_token:
        Validated creation payload containing ``user_id``, ``token_hash``,
        ``family_id``, optional ``device_info``, and optional ``ip_address``.
    expires_at:
        Absolute UTC expiry timestamp for the new token.

    Returns
    -------
    RefreshToken
        The fully-populated row as returned by the database.

    Raises
    ------
    TokenCreateError
        If the ``INSERT`` produces no row (should never happen under normal
        conditions, but guards against unexpected DB-side triggers/rules).
    """
    row = await conn.fetchrow(
        """
        INSERT INTO refresh_tokens (
            user_id, token_hash, family_id,
            expires_at
        )
        VALUES ($1, $2, $3, $4)
        RETURNING *
        """,
        refresh_token.user_id,
        refresh_token.token_hash,
        refresh_token.family_id,
        expires_at,
    )
    try:
        row = assert_found(row, TokenNotFoundError)
    except TokenNotFoundError:
        raise TokenCreateError(
            f"Could not create a refresh token for user: {refresh_token.user_id}"
        )
    return RefreshToken.model_validate(dict(row))
