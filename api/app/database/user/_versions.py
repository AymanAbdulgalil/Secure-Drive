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


async def increment_password_version(
    *,
    conn: Connection,
    user_id: UUID,
) -> User:
    """
    Bump ``password_version`` by one, invalidating any outstanding
    password-reset tokens that embed the previous version number.

    Call this before issuing a fresh password reset email so that older links
    can no longer be replayed.

    Raises:
        UserNotFoundError: No user exists with that UUID.
    """
    row = await conn.fetchrow(
        """
        UPDATE users
        SET password_version = password_version + 1
        WHERE user_id = $1
        RETURNING *
        """,
        user_id,
    )
    row = assert_found(row, UserNotFoundError)
    return User.model_validate(dict(row))
