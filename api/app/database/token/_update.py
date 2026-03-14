from __future__ import annotations

from uuid import UUID
from asyncpg import Connection
from datetime import datetime, timezone

from ...models.token import RefreshToken
from .exceptions import TokenError, TokenExpiredError
from ._read import get_refresh_token_by_id


async def revoke_refresh_token(
    *,
    conn: Connection,
    token_id: UUID,
) -> bool:
    """Revoke a single token by ID.

    This is a no-op (and returns ``False``) if the token is already revoked,
    making the operation idempotent.

    Parameters
    ----------
    conn:
        Active asyncpg connection.
    token_id:
        UUID of the token to revoke.

    Returns
    -------
    bool
        ``True`` if a row was updated, ``False`` if it was already revoked or
        did not exist.
    """
    result = await conn.execute(
        """
        UPDATE refresh_tokens
           SET revoked    = TRUE,
               revoked_at = NOW() AT TIME ZONE 'utc'
         WHERE token_id = $1
           AND revoked  = FALSE
        """,
        token_id,
    )
    return int(result.split()[-1]) > 0


async def revoke_all_refresh_tokens_for_user(
    *,
    conn: Connection,
    user_id: UUID,
) -> int:
    """Revoke every active token belonging to a user.

    Typically called on password change, logout-all-devices, or after a
    detected compromise.

    Parameters
    ----------
    conn:
        Active asyncpg connection.
    user_id:
        UUID of the target user.

    Returns
    -------
    int
        Number of token rows updated.
    """
    result = await conn.execute(
        """
        UPDATE refresh_tokens
           SET revoked    = TRUE,
               revoked_at = NOW() AT TIME ZONE 'utc'
         WHERE user_id = $1
           AND revoked  = FALSE
        """,
        user_id,
    )
    return int(result.split()[-1])


async def revoke_refresh_token_family(
    *,
    conn: Connection,
    family_id: UUID,
) -> int:
    """Revoke every active token in a rotation family.

    Called as a replay-attack countermeasure when a token that should have
    been superseded is presented again.

    Parameters
    ----------
    conn:
        Active asyncpg connection.
    family_id:
        UUID that identifies the rotation family to nuke.

    Returns
    -------
    int
        Number of token rows updated.
    """
    result = await conn.execute(
        """
        UPDATE refresh_tokens
           SET revoked    = TRUE,
               revoked_at = NOW() AT TIME ZONE 'utc'
         WHERE family_id = $1
           AND revoked   = FALSE
        """,
        family_id,
    )
    return int(result.split()[-1])


async def rotate_refresh_token(
    *,
    conn: Connection,
    old_token_id: UUID,
    new_token_id: UUID,
) -> tuple[RefreshToken, RefreshToken]:
    """Atomically supersede ``old_token_id`` with ``new_token_id``.

    Both tokens must already exist in the database (created ahead of time).
    The old token is marked as revoked and linked to its successor via
    ``superseded_by``.

    Replay-attack detection
    -----------------------
    If either token is already revoked when rotation is attempted, the entire
    family is immediately revoked and a ``TokenError`` is raised.  This
    prevents an attacker who has stolen a previous token from silently
    re-using it.

    Parameters
    ----------
    conn:
        Active asyncpg connection.  A savepoint / nested transaction is
        opened internally; the caller's outer transaction (if any) is
        unaffected on success.
    old_token_id:
        UUID of the token being superseded.
    new_token_id:
        UUID of the replacement token.

    Returns
    -------
    tuple[RefreshToken, RefreshToken]
        ``(old_token, new_token)`` as they existed just before rotation.

    Raises
    ------
    TokenError
        If either token is already revoked (replay detected), or if the two
        tokens belong to different families.
    TokenExpiredError
        If either token has passed its ``expires_at`` timestamp.
    TokenNotFoundError
        If either ``token_id`` does not exist.
    """
    async with conn.transaction():
        old = await get_refresh_token_by_id(conn=conn, token_id=old_token_id)

        if old.revoked:
            # Possible replay attack — nuke the whole family as a precaution.
            await revoke_refresh_token_family(conn=conn, family_id=old.family_id)
            raise TokenError(
                "rotate_refresh_token: old token already revoked; "
                "entire family has been revoked (replay-attack countermeasure)"
            )

        now = datetime.now(tz=timezone.utc)
        if old.expires_at.replace(tzinfo=timezone.utc) <= now:
            raise TokenExpiredError("rotate_refresh_token: old token has expired")

        new = await get_refresh_token_by_id(conn=conn, token_id=new_token_id)

        if new.revoked:
            await revoke_refresh_token_family(conn=conn, family_id=new.family_id)
            raise TokenError(
                "rotate_refresh_token: new token already revoked; "
                "entire family has been revoked (replay-attack countermeasure)"
            )

        if new.expires_at.replace(tzinfo=timezone.utc) <= now:
            raise TokenExpiredError("rotate_refresh_token: new token has expired")

        if new.family_id != old.family_id:
            raise TokenError(
                "rotate_refresh_token: old and new tokens belong to different families "
                "(replay-attack countermeasure)"
            )

        # Mark the old token as consumed and point it at its successor.
        await conn.execute(
            """
            UPDATE refresh_tokens
               SET revoked       = TRUE,
                   revoked_at    = NOW() AT TIME ZONE 'utc',
                   superseded_by = $2
             WHERE token_id = $1
            """,
            old.token_id,
            new.token_id,
        )

    return old, new


async def update_refresh_token_last_used(
    *,
    conn: Connection,
    token_id: UUID,
) -> bool:
    """Stamp ``last_used_at`` to the current UTC time for a token.

    Parameters
    ----------
    conn:
        Active asyncpg connection.
    token_id:
        UUID of the token to update.

    Returns
    -------
    bool
        ``True`` if a row was updated, ``False`` if the token does not exist.
    """
    result = await conn.execute(
        """
        UPDATE refresh_tokens
           SET last_used_at = NOW() AT TIME ZONE 'utc'
         WHERE token_id = $1
        """,
        token_id,
    )
    return int(result.split()[-1]) > 0
