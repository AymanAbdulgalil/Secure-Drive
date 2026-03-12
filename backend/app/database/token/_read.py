from __future__ import annotations

from uuid import UUID
from asyncpg import Connection

from ...models.token import RefreshToken
from ...models.types import SHA256Hex
from .._common import assert_found
from .exceptions import TokenNotFoundError


async def get_refresh_token_by_hash(
    *,
    conn: Connection,
    token_hash: SHA256Hex,
) -> RefreshToken:
    """Fetch a token row by its SHA-256 hash.

    Parameters
    ----------
    conn:
        Active asyncpg connection.
    token_hash:
        Hex-encoded SHA-256 digest of the raw token value.

    Returns
    -------
    RefreshToken
        The matching token row.

    Raises
    ------
    TokenNotFoundError
        If no row with the given hash exists.
    """
    row = await conn.fetchrow(
        "SELECT * FROM refresh_tokens WHERE token_hash = $1",
        token_hash,
    )
    return RefreshToken.model_validate(assert_found(row, TokenNotFoundError))


async def get_refresh_token_by_id(
    *,
    conn: Connection,
    token_id: UUID,
) -> RefreshToken:
    """Fetch a token row by its primary-key UUID.

    Parameters
    ----------
    conn:
        Active asyncpg connection.
    token_id:
        UUID primary key of the token row.

    Returns
    -------
    RefreshToken
        The matching token row.

    Raises
    ------
    TokenNotFoundError
        If no row with the given ID exists.
    """
    row = await conn.fetchrow(
        "SELECT * FROM refresh_tokens WHERE token_id = $1",
        token_id,
    )
    return RefreshToken.model_validate(assert_found(row, TokenNotFoundError))


async def get_active_refresh_tokens_for_user(
    *,
    conn: Connection,
    user_id: UUID,
) -> list[RefreshToken]:
    """Return all non-revoked, non-expired tokens that belong to a user.

    Results are ordered newest-first (``issued_at DESC``).

    Parameters
    ----------
    conn:
        Active asyncpg connection.
    user_id:
        UUID of the target user.

    Returns
    -------
    list[RefreshToken]
        Possibly-empty list of active tokens.
    """
    rows = await conn.fetch(
        """
        SELECT *
          FROM refresh_tokens
         WHERE user_id    = $1
           AND revoked    = FALSE
           AND expires_at > NOW() AT TIME ZONE 'utc'
         ORDER BY issued_at DESC
        """,
        user_id,
    )
    return [RefreshToken.model_validate(row) for row in rows]


async def get_refresh_token_family(
    *,
    conn: Connection,
    family_id: UUID,
) -> list[RefreshToken]:
    """Return every token that belongs to a rotation family.

    Tokens are ordered oldest-first (``issued_at ASC``) so callers can
    reconstruct the full rotation chain.

    Parameters
    ----------
    conn:
        Active asyncpg connection.
    family_id:
        UUID that groups all tokens issued within the same rotation lineage.

    Returns
    -------
    list[RefreshToken]
        All tokens in the family, regardless of revocation status.
    """
    rows = await conn.fetch(
        """
        SELECT *
          FROM refresh_tokens
         WHERE family_id = $1
         ORDER BY issued_at ASC
        """,
        family_id,
    )
    return [RefreshToken.model_validate(row) for row in rows]
