"""
Async data-access layer concerned with the ``refres_tokens`` table.

This module provides the full data-access layer for ``refresh_tokens`` rows.
All functions are async and accept an ``asyncpg.Connection`` as a keyword
argument so callers can participate in an existing transaction when required.

Sections
--------
Create   - insert a new token row.
Read     - fetch one or many token rows.
Update   - revoke, rotate, and housekeeping updates.
Delete   - batch-delete stale tokens.
Helpers  - pure-Python validation guards.

Exceptions
----------
All database errors are translated into the custom exception hierarchy
defined in ``.exceptions`` (``TokenNotFoundError``, ``TokenCreateError``,
``TokenExpiredError``, ``TokenError``, …).
"""

from ._create import create_refresh_token
from ._read import (
    get_active_refresh_tokens_for_user,
    get_refresh_token_by_hash,
    get_refresh_token_by_id,
    get_refresh_token_family,
)
from ._update import (
    revoke_all_refresh_tokens_for_user,
    revoke_refresh_token,
    revoke_refresh_token_family,
    rotate_refresh_token,
    update_refresh_token_last_used,
)
from ._delete import delete_stale_refresh_tokens
from ._helpers import is_refresh_token_valid


__all__ = [
    # Create
    "create_refresh_token",
    # Read
    "get_refresh_token_by_hash",
    "get_refresh_token_by_id",
    "get_active_refresh_tokens_for_user",
    "get_refresh_token_family",
    # Update
    "revoke_refresh_token",
    "revoke_all_refresh_tokens_for_user",
    "revoke_refresh_token_family",
    "rotate_refresh_token",
    "update_refresh_token_last_used",
    # Delete / maintenance
    "delete_stale_refresh_tokens",
    # Helpers
    "is_refresh_token_valid",
]