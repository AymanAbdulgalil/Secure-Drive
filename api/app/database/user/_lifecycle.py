from __future__ import annotations

from uuid import UUID
from asyncpg import Connection

from .exceptions import UserNotFoundError
from .._common import assert_found
from ...models.user import User


async def invalidate_access_tokens(
    *,
    conn: Connection,
    user_id: UUID,
) -> User:
    """
    Advance ``valid_since`` to now, invalidating every access token issued
    before this moment (tokens carry an ``iat`` claim that is compared against
    this field).

    Use this for a targeted "log out everywhere" without touching account state.

    Raises:
        UserNotFoundError: No user exists with that UUID.
    """
    row = await conn.fetchrow(
        """
        UPDATE users
        SET valid_since = NOW() AT TIME ZONE 'utc'
        WHERE user_id = $1
        RETURNING *
        """,
        user_id,
    )
    row = assert_found(row, UserNotFoundError)
    return User.model_validate(row)


async def deactivate_user(
    *,
    conn: Connection,
    user_id: UUID,
) -> User:
    """
    Soft-delete: set ``is_active = FALSE`` and advance ``valid_since`` so that
    all outstanding tokens are immediately invalidated.

    The row is preserved for audit purposes.  Use ``reactivate_user`` to
    reverse this operation.

    Raises:
        UserNotFoundError: No user exists with that UUID.
    """
    row = await conn.fetchrow(
        """
        UPDATE users
        SET is_active   = FALSE,
            valid_since = NOW() AT TIME ZONE 'utc'
        WHERE user_id = $1
        RETURNING *
        """,
        user_id,
    )
    row = assert_found(row, UserNotFoundError)
    return User.model_validate(row)


async def reactivate_user(
    *,
    conn: Connection,
    user_id: UUID,
) -> User:
    """
    Reverse a soft-delete: set ``is_active = TRUE`` and advance ``valid_since``
    so that any tokens issued before deactivation remain invalid.

    Raises:
        UserNotFoundError: No user exists with that UUID.
    """
    row = await conn.fetchrow(
        """
        UPDATE users
        SET is_active   = TRUE,
            valid_since = NOW() AT TIME ZONE 'utc'
        WHERE user_id = $1
        RETURNING *
        """,
        user_id,
    )
    row = assert_found(row, UserNotFoundError)
    return User.model_validate(row)


async def delete_user(
    *,
    conn: Connection,
    user_id: UUID,
) -> None:
    """
    Permanently remove a user row. This is irreversible.

    Prefer ``deactivate_user`` when a soft-delete is acceptable.

    Raises:
        UserNotFoundError: No user exists with that UUID.
    """
    # asyncpg returns a status string like "DELETE 1" rather than a row count
    result: str = await conn.execute("DELETE FROM users WHERE user_id = $1", user_id)
    if result == "DELETE 0":
        raise UserNotFoundError(f"No user found for identifier: {user_id!r}")
