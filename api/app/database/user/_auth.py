from __future__ import annotations

from uuid import UUID
from asyncpg import Connection

from .exceptions import UserNotFoundError
from .._common import assert_found
from ...models.types import Email
from ...models.user import User


async def get_active_verified_user_by_email(
    *,
    conn: Connection,
    email: Email,
) -> User:
    """
    Fetch a user suitable for login — must be both active and verified.

    Deliberately raises the same ``UserNotFoundError`` whether the email is
    unknown, the account is inactive, or email verification is pending.  This
    prevents user-enumeration: the calling layer should treat any failure here
    identically to a wrong password.

    Raises:
        UserNotFoundError: No match found (reason is intentionally opaque).
    """
    row = await conn.fetchrow(
        """
        SELECT * FROM users
        WHERE email      = $1
          AND is_active  = TRUE
          AND verified   = TRUE
        """,
        email,
    )
    row = assert_found(row, UserNotFoundError)
    return User.model_validate(row)


async def record_login(
    *,
    conn: Connection,
    user_id: UUID,
) -> User:
    """
    Stamp ``last_login`` with the current UTC time and return the updated row.

    Raises:
        UserNotFoundError: No user exists with that UUID.
    """
    row = await conn.fetchrow(
        """
        UPDATE users
        SET last_login = NOW() AT TIME ZONE 'utc'
        WHERE user_id = $1
        RETURNING *
        """,
        user_id,
    )
    row = assert_found(row, UserNotFoundError)
    return User.model_validate(row)

