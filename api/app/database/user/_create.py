from __future__ import annotations

from uuid import uuid4
from asyncpg import Connection, UniqueViolationError

from .exceptions import UserNotFoundError, UserCreateError, EmailAlreadyExistsError
from .._common import assert_found
from ...models.user import User, UserRegister


async def create_user(
    *,
    conn: Connection,
    user_data: UserRegister
) -> User:
    """
    Insert a new user and return the full row.

    Raises:
        EmailAlreadyExistsError: A user with that email already exists.
        UserCreateError: The INSERT returned no row (should not happen in
            normal operation, but guards against unexpected DB behaviour).
    """
    user_id = uuid4()

    try:
        row = await conn.fetchrow(
            """
            INSERT INTO users (user_id, email, password_hash, name, verified, is_active)
            VALUES ($1, $2, $3, $4, FALSE, TRUE)
            RETURNING *
            """,
            user_id,
            user_data.email,
            user_data.password,
            user_data.name,
        )
        row = assert_found(row, UserNotFoundError)

    except UserNotFoundError:
        raise UserCreateError(
            f"Could not create user.\n  - Name: {user_data.name}\n  - Email: {user_data.email}"
        )
    except UniqueViolationError:
        raise EmailAlreadyExistsError(f"User with email {user_data.email!r} already exists.")

    return User.model_validate(row)
