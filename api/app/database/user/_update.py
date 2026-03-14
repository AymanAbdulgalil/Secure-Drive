from __future__ import annotations

from uuid import UUID
from asyncpg import Connection, UniqueViolationError, CheckViolationError

from .exceptions import UserNotFoundError, EmailAlreadyExistsError, StorageQuotaExceededError
from .._common import assert_found
from ...models.user import User
from ...models.types import Email, SHA256Hex


async def update_name(
    *,
    conn: Connection,
    user_id: UUID,
    name: str,
) -> User:
    """
    Replace the user's display name.

    Raises:
        UserNotFoundError: No user exists with that UUID.
    """
    row = await conn.fetchrow(
        """
        UPDATE users
        SET name = $1
        WHERE user_id = $2
        RETURNING *
        """,
        name,
        user_id,
    )
    row = assert_found(row, UserNotFoundError)
    return User.model_validate(row)


async def update_email(
    *,
    conn: Connection,
    user_id: UUID,
    email: Email,
) -> User:
    """
    Replace the user's email address and reset ``verified`` to ``FALSE``.

    The caller is responsible for sending a new verification email after
    this update succeeds.

    Raises:
        EmailAlreadyExistsError: Another account already uses that email.
        UserNotFoundError: No user exists with that UUID.
    """
    try:
        row = await conn.fetchrow(
            """
            UPDATE users
            SET email    = $1,
                verified = FALSE
            WHERE user_id = $2
            RETURNING *
            """,
            email,
            user_id,
        )
    except UniqueViolationError:
        raise EmailAlreadyExistsError(f"User with email {email!r} already exists.")

    row = assert_found(row, UserNotFoundError)
    return User.model_validate(row)


async def update_password(
    *,
    conn: Connection,
    user_id: UUID,
    password_hash: SHA256Hex,
) -> User:
    """
    Replace the password hash and advance ``valid_since`` to the current UTC
    time, which immediately invalidates all previously issued JWT/session tokens.

    Raises:
        UserNotFoundError: No user exists with that UUID.
    """
    row = await conn.fetchrow(
        """
        UPDATE users
        SET password_hash = $1,
            valid_since   = NOW() AT TIME ZONE 'utc'
        WHERE user_id = $2
        RETURNING *
        """,
        password_hash,
        user_id,
    )
    row = assert_found(row, UserNotFoundError)
    return User.model_validate(row)


async def increment_storage_used(
    *,
    conn: Connection,
    user_id: UUID,
    delta_bytes: int,
) -> User:
    """
    Atomically adjust ``storage_used`` by ``delta_bytes`` (positive to
    consume space, negative to free it).

    The database ``CHECK`` constraint ``storage_used <= storage_quota`` acts
    as the authoritative ceiling; a violation is caught here and re-raised as
    a friendlier domain exception.

    Raises:
        StorageQuotaExceededError: The delta would push usage above quota.
        UserNotFoundError: No user exists with that UUID.
    """
    try:
        row = await conn.fetchrow(
            """
            UPDATE users
            SET storage_used = storage_used + $1
            WHERE user_id = $2
            RETURNING *
            """,
            delta_bytes,
            user_id,
        )
    except CheckViolationError as exc:
        if "storage" in str(exc):
            raise StorageQuotaExceededError(
                f"Operation would exceed storage quota for user {user_id}."
            ) from exc
        raise

    row = assert_found(row, UserNotFoundError)
    return User.model_validate(row)


async def update_storage_quota(
    *,
    conn: Connection,
    user_id: UUID,
    new_quota_bytes: int,
) -> User:
    """
    Set a new storage quota for the user.

    The database enforces ``storage_quota > 0`` and
    ``storage_quota >= storage_used``; either violation surfaces as
    ``StorageQuotaExceededError``.

    Raises:
        StorageQuotaExceededError: New quota is non-positive or below current usage.
        UserNotFoundError: No user exists with that UUID.
    """
    try:
        row = await conn.fetchrow(
            """
            UPDATE users
            SET storage_quota = $1
            WHERE user_id = $2
            RETURNING *
            """,
            new_quota_bytes,
            user_id,
        )
    except CheckViolationError as exc:
        raise StorageQuotaExceededError(
            "New quota would be below current usage or non-positive."
        ) from exc

    row = assert_found(row, UserNotFoundError)
    return User.model_validate(row)
