"""
Async data-access layer concerned with the ``users`` table.

All public functions accept an open ``asyncpg.Connection`` as a keyword-only
argument and return either a pydantic ``User`` class, or a plain Python value.
Domain exceptions are raised instead of returning ``None`` so callers can use
a straightforward try/except rather than null-checking and error guissing every result.
"""

from ._auth import get_active_verified_user_by_email, record_login
from ._create import create_user
from ._lifecycle import (
    deactivate_user,
    delete_user,
    invalidate_access_tokens,
    reactivate_user,
)
from ._read import count_users, get_user_by_email, get_user_by_id, list_users
from ._update import (
    increment_storage_used,
    mark_unverified,
    mark_verified,
    update_email,
    update_name,
    update_password,
    update_storage_quota,
)
from ._versions import increment_password_version, increment_verification_version

__all__ = [
    # Create
    "create_user",
    # Read
    "get_user_by_id",
    "get_user_by_email",
    "count_users",
    "list_users",
    # Auth helpers
    "get_active_verified_user_by_email",
    "record_login",
    # Update — profile
    "update_name",
    "update_email",
    "update_password",
    "increment_storage_used",
    "update_storage_quota",
    "mark_verified",
    "mark_unverified",
    # Update — verification
    "increment_verification_version",
    "increment_password_version",
    # Lifecycle
    "invalidate_access_tokens",
    "deactivate_user",
    "reactivate_user",
    "delete_user",
]
