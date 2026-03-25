from __future__ import annotations

from uuid import UUID

from asyncpg import Connection

from ...models.user import User
from .._common import assert_found
from .exceptions import UserNotFoundError


async def increment_verification_version(
    *,
    conn: Connection,
    user_id: UUID,
) -> User:
    """
    Bump ``verification_version`` by one, invalidating any outstanding
    email-verification tokens that embed the previous version number.

    Call this before issuing a fresh verification email so that older links
    can no longer be replayed.

    Raises:
        UserNotFoundError: No user exists with that UUID.
    """
    row = await conn.fetchrow(
        """
        UPDATE users
        SET verification_version = verification_version + 1
        WHERE user_id = $1
        RETURNING *
        """,
        user_id,
    )
    row = assert_found(row, UserNotFoundError)
    return User.model_validate(dict(row))


async def mark_verified(
    *,
    conn: Connection,
    user_id: UUID,
    verification_version: int,
) -> User:
    """
    Set ``verified = TRUE`` only when the stored ``verification_version``
    matches the value embedded in the token.

    The version check is the replay-protection mechanism: if
    ``increment_verification_version`` has been called since the token was
    issued (e.g. the user requested a second link), the UPDATE matches zero
    rows and ``UserNotFoundError`` is raised.

    Raises:
        UserNotFoundError: Token version is stale, user is inactive, or the
            UUID does not exist.
    """
    row = await conn.fetchrow(
        """
        UPDATE users
        SET verified = TRUE
        WHERE user_id             = $1
          AND is_active           = TRUE
          AND verification_version = $2
        RETURNING *
        """,
        user_id,
        verification_version,
    )
    row = assert_found(row, UserNotFoundError)
    return User.model_validate(dict(row))
