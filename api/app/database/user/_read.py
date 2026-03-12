from __future__ import annotations

from uuid import UUID
from asyncpg import Connection

from .exceptions import UserNotFoundError
from .._common import assert_found
from ...models.user import User
from ...models.types import Email


async def get_user_by_id(
    *,
    conn: Connection,
    user_id: UUID,
) -> User:
    """
    Fetch a single user by primary key.

    Raises:
        UserNotFoundError: No user exists with that UUID.
    """
    row = await conn.fetchrow("SELECT * FROM users WHERE user_id = $1", user_id)
    row = assert_found(row, UserNotFoundError)
    return User.model_validate(row)


async def get_user_by_email(
    *,
    conn: Connection,
    email: Email,
) -> User:
    """
    Fetch a single user by email address (case-insensitive).

    Raises:
        UserNotFoundError: No user exists with that email.
    """
    row = await conn.fetchrow("SELECT * FROM users WHERE email = $1", email)
    row = assert_found(row, UserNotFoundError)
    return User.model_validate(row)


async def count_users(
    *,
    conn: Connection,
    active_only: bool = True,
) -> int:
    """
    Return the total number of users.

    Args:
        active_only: When ``True`` (default), only count rows where
            ``is_active = TRUE``.
    """
    if active_only:
        count = await conn.fetchval("SELECT COUNT(*) FROM users WHERE is_active = TRUE")
    else:
        count = await conn.fetchval("SELECT COUNT(*) FROM users")
    # fetchval can return None if the table is empty on some drivers
    return count if count is not None else 0


async def list_users(
    *,
    conn: Connection,
    active_only: bool = True,
    limit: int = 100,
    offset: int = 0,
) -> tuple[list[User], int]:
    """
    Return a paginated slice of users ordered by ``created_at DESC``.

    Args:
        active_only: Restrict results to active users when ``True`` (default).
        limit: Maximum rows to return; clamped to ``[0, 1024]``.
        offset: Number of rows to skip; negative values are treated as 0.

    Returns:
        A ``(rows, remaining)`` tuple where ``remaining`` is the count of
        rows that exist beyond the current page.
    """
    safe_limit = max(min(limit, 1024), 0)
    safe_offset = max(offset, 0)

    base_sql = "SELECT * FROM users{where} ORDER BY created_at DESC LIMIT $1 OFFSET $2"
    where = " WHERE is_active = TRUE" if active_only else ""
    rows = await conn.fetch(base_sql.format(where=where), safe_limit, safe_offset)
    rows = [User.model_validate(row) for row in rows]

    total = await count_users(conn=conn, active_only=active_only)
    remaining = max(0, total - (safe_offset + len(rows)))
    return rows, remaining

