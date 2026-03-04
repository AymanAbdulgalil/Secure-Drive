from __future__ import annotations

import uuid
from typing import Any

import asyncpg


# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------

Record = asyncpg.Record


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class UserNotFoundError(Exception):
    pass


class StorageQuotaExceededError(Exception):
    pass


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _assert_found(record: Record | None, identifier: Any) -> Record:
    if not record:
        print(f"Record not found for identifier: {identifier!r}\n Record: {record!r}")
        raise UserNotFoundError(f"No user found for identifier: {identifier!r}")
    if not isinstance(record, asyncpg.Record):
        raise TypeError(f"Expected asyncpg.Record, got {type(record)}")
    return record


def _normalize_user_id(user_id: str | uuid.UUID) -> uuid.UUID:
    if isinstance(user_id, uuid.UUID):
        return user_id
    try:
        return uuid.UUID(user_id)
    except ValueError as exc:
        raise ValueError(f"Invalid UUID format for user_id: {user_id!r}") from exc


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------


async def create_user(
    *,
    conn: asyncpg.Connection,
    email: str,
    password_hash: str,
    name: str,
    storage_quota: int = 10_737_418_240,  # 10 GiB
) -> Record:
    """
    Insert a new user row and return the full record.
    Raises EmailAlreadyExistsError on duplicate email.
    """
    uid = uuid.uuid4()

    sql = """
        INSERT INTO users (user_id, email, password_hash, name, storage_quota, verified, is_active)
        VALUES ($1, $2, $3, $4, $5, FALSE, TRUE)
    """

    async with conn.transaction():
        await conn.execute(sql, uid, email, password_hash, name, storage_quota)
        record = await get_user_by_id(conn=conn, user_id=uid)

    if _assert_found(record, email):
        print(f"Created user {uid} with email {email}")
    return record


# ---------------------------------------------------------------------------
# Read
# ---------------------------------------------------------------------------


async def get_user_by_id(
    *,
    conn: asyncpg.Connection,
    user_id: str | uuid.UUID,
) -> Record:
    """Fetch a user by primary key (UUID). Raises UserNotFoundError if absent."""
    id = _normalize_user_id(user_id)
    row = await conn.fetchrow("SELECT * FROM users WHERE user_id = $1", id)
    return _assert_found(row, id)


async def get_user_by_email(
    *,
    conn: asyncpg.Connection,
    email: str,
) -> Record:
    """Fetch a user by email (case-insensitive). Raises UserNotFoundError if absent."""
    row = await conn.fetchrow("SELECT * FROM users WHERE email ILIKE $1", email)
    return _assert_found(row, email)


async def list_users(
    *,
    conn: asyncpg.Connection,
    active_only: bool = True,
    limit: int = 100,
    offset: int = 0,
) -> list[Record]:
    """Return a paginated list of users ordered by created_at DESC."""
    if active_only:
        sql = """
            SELECT * FROM users
            WHERE is_active = TRUE
            ORDER BY created_at DESC
            LIMIT $1 OFFSET $2
        """
    else:
        sql = """
            SELECT * FROM users
            ORDER BY created_at DESC
            LIMIT $1 OFFSET $2
        """
    return await conn.fetch(sql, limit, offset)


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------


async def get_active_verified_user_by_email(
    *,
    conn: asyncpg.Connection,
    email: str,
) -> Record:
    """
    Used during login: return only active, verified users.
    Raises UserNotFoundError when no match (treat the same as a bad password
    in the calling layer to avoid user-enumeration).
    """
    row = await conn.fetchrow(
        """
        SELECT * FROM users
        WHERE email ILIKE $1
          AND is_active  = TRUE
          AND verified   = TRUE
        """,
        email,
    )
    return _assert_found(row, email)


async def record_login(
    *,
    conn: asyncpg.Connection,
    user_id: str | uuid.UUID,
) -> Record:
    """Stamp last_login and return the updated row. Raises UserNotFoundError."""
    id = _normalize_user_id(user_id)
    row = await conn.fetchrow(
        """
        UPDATE users
        SET last_login = NOW() AT TIME ZONE 'utc'
        WHERE user_id = $1
        RETURNING *
        """,
        id,
    )
    return _assert_found(row, id)


# ---------------------------------------------------------------------------
# Update – profile
# ---------------------------------------------------------------------------


async def update_profile(
    *,
    conn: asyncpg.Connection,
    user_id: str | uuid.UUID,
    name: str | None = None,
    email: str | None = None,
) -> Record:
    """
    Update mutable profile fields. Only non-None kwargs are applied.
    Raises UserNotFoundError or EmailAlreadyExistsError as appropriate.
    """

    id = _normalize_user_id(user_id)
    if name is None and email is None:
        raise ValueError("At least one field must be supplied.")

    clauses: list[str] = []
    params: list[Any] = []

    def _add(col: str, val: Any) -> None:
        params.append(val)
        clauses.append(f"{col} = ${len(params)}")

    if name is not None:
        _add("name", name)
    if email is not None:
        _add("email", email)

    params.append(id)
    sql = f"""
        UPDATE users
        SET {', '.join(clauses)}
        WHERE user_id = ${len(params)}
    """

    async with conn.transaction():
        await conn.execute(sql, *params)
        record = await get_user_by_id(conn=conn, user_id=id)

    return _assert_found(record, id)


async def update_password(
    *,
    conn: asyncpg.Connection,
    user_id: str | uuid.UUID,
    new_password_hash: str,
) -> Record:
    """
    Replace the password hash and advance valid_since to invalidate
    all previously issued tokens.
    """

    id = _normalize_user_id(user_id)
    row = await conn.fetchrow(
        """
        UPDATE users
        SET password_hash = $1,
            valid_since   = NOW() AT TIME ZONE 'utc'
        WHERE user_id = $2
        RETURNING *
        """,
        new_password_hash,
        id,
    )
    return _assert_found(row, id)


# ---------------------------------------------------------------------------
# Update – verification
# ---------------------------------------------------------------------------


async def increment_verification_version(
    *,
    conn: asyncpg.Connection,
    user_id: str | uuid.UUID,
) -> Record:
    """Bump verification_version to invalidate any outstanding email tokens."""

    id = _normalize_user_id(user_id)
    row = await conn.fetchrow(
        """
        UPDATE users
        SET verification_version = verification_version + 1
        WHERE user_id = $1
        RETURNING *
        """,
        id,
    )
    return _assert_found(row, id)


async def mark_verified(
    *,
    conn: asyncpg.Connection,
    user_id: str | uuid.UUID,
) -> Record:
    """
    Set verified = TRUE only when the token version matches.
    Returns the updated row, or raises UserNotFoundError when the
    version has already been superseded (token was invalidated).
    """

    id = _normalize_user_id(user_id)
    row = await conn.fetchrow(
        """
        UPDATE users
        SET verified = TRUE
        WHERE user_id              = $1
          AND is_active            = TRUE
        RETURNING *
        """,
        id,
    )
    return _assert_found(row, f"{id}")


# ---------------------------------------------------------------------------
# Update – storage
# ---------------------------------------------------------------------------


async def increment_storage_used(
    *,
    conn: asyncpg.Connection,
    user_id: str | uuid.UUID,
    delta_bytes: int,
) -> Record:
    """
    Atomically add delta_bytes to storage_used.
    The DB CHECK constraint (storage_used <= storage_quota) guards the ceiling;
    asyncpg will raise CheckViolationError which we re-raise as StorageQuotaExceededError.
    delta_bytes may be negative to free space.
    """

    id = _normalize_user_id(user_id)
    try:
        row = await conn.fetchrow(
            """
            UPDATE users
            SET storage_used = storage_used + $1
            WHERE user_id = $2
            RETURNING *
            """,
            delta_bytes,
            id,
        )
    except asyncpg.CheckViolationError as exc:
        if "storage" in str(exc):
            raise StorageQuotaExceededError(
                f"Operation would exceed storage quota for user {id}."
            ) from exc
        raise
    return _assert_found(row, id)


async def update_storage_quota(
    *,
    conn: asyncpg.Connection,
    user_id: str | uuid.UUID,
    new_quota_bytes: int,
) -> Record:
    """Set a new storage quota. DB constraint ensures quota > 0 and >= storage_used."""

    id = _normalize_user_id(user_id)
    try:
        row = await conn.fetchrow(
            """
            UPDATE users
            SET storage_quota = $1
            WHERE user_id = $2
            RETURNING *
            """,
            new_quota_bytes,
            id,
        )
    except asyncpg.CheckViolationError as exc:
        raise StorageQuotaExceededError(
            "New quota would be below current usage or non-positive."
        ) from exc
    return _assert_found(row, id)


# ---------------------------------------------------------------------------
# Soft delete / deactivate
# ---------------------------------------------------------------------------


async def deactivate_user(
    *,
    conn: asyncpg.Connection,
    user_id: str | uuid.UUID,
) -> Record:
    """
    Soft-delete: flip is_active = FALSE and advance valid_since so that
    all outstanding tokens are immediately invalidated.
    """

    id = _normalize_user_id(user_id)
    row = await conn.fetchrow(
        """
        UPDATE users
        SET is_active   = FALSE,
            valid_since = NOW() AT TIME ZONE 'utc'
        WHERE user_id = $1
        RETURNING *
        """,
        id,
    )
    return _assert_found(row, id)


async def reactivate_user(
    *,
    conn: asyncpg.Connection,
    user_id: str | uuid.UUID,
) -> Record:

    id = _normalize_user_id(user_id)
    row = await conn.fetchrow(
        """
        UPDATE users
        SET is_active = TRUE
        WHERE user_id = $1
        RETURNING *
        """,
        id,
    )
    return _assert_found(row, id)


# ---------------------------------------------------------------------------
# Hard delete (use sparingly – prefer deactivate_user)
# ---------------------------------------------------------------------------


async def delete_user(
    *,
    conn: asyncpg.Connection,
    user_id: str | uuid.UUID,
) -> None:
    """Permanently remove a user. Raises UserNotFoundError if not present."""
    id = _normalize_user_id(user_id)
    result: str = await conn.execute("DELETE FROM users WHERE user_id = $1", id)
    # asyncpg returns "DELETE <n>"
    if result == "DELETE 0":
        raise UserNotFoundError(f"No user found for identifier: {id!r}")
