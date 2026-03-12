"""
Async data-access layer concerned with the ``files`` table, and file persistent storage.

This module is the single boundary between the application layer and both the
PostgreSQL ``files`` table and the MinIO object store.  Every public function
operates on *both* surfaces atomically where required (create / delete), or on
only one surface where the operation is naturally scoped (pure-metadata reads
and updates, aggregate queries).

Public API
----------
Create
    create_file_meta_and_bytes

Read
    get_file_meta
    get_file_meta_by_sha256
    get_file_meta_and_bytes
    list_file_meta_by_owner
    list_file_meta_by_folder

Update
    rename_file_meta
    move_file_meta

Delete
    delete_file_meta_and_bytes

Aggregate / Utility
    count_file_meta_by_owner
    total_bytes_by_owner
    file_meta_and_bytes_exists

Exceptions re-exported for callers
-----------------------------------
``FileNotFoundError``, ``FileCreateError``, ``FileError``
(imported from ``.exceptions``).

Notes
-----
* All functions use keyword-only arguments (``*``) to prevent positional
  mismatches at call sites.
* The helper ``_ALLOWED_ORDER`` guards against SQL-injection in the
  ``ORDER BY`` clause of :func:`list_file_meta_by_owner`.
* MinIO I/O is intentionally kept outside the asyncpg transaction context
  where possible; the one exception is :func:`create_file_meta_and_bytes`,
  which writes to object storage only *after* the DB row has been committed
  successfully.
"""

from ._create import create_file_meta_and_bytes
from ._read import (
    get_file_meta,
    get_file_meta_by_sha256,
    get_file_meta_and_bytes,
    list_file_meta_by_owner,
    list_file_meta_by_folder,
)
from ._update import rename_file_meta, move_file_meta
from ._delete import delete_file_meta_and_bytes
from ._utils import (
    count_file_meta_by_owner,
    total_bytes_by_owner,
    file_meta_and_bytes_exists,
)


__all__ = [
    # Create
    "create_file_meta_and_bytes",
    # Read
    "get_file_meta",
    "get_file_meta_by_sha256",
    "get_file_meta_and_bytes",
    "list_file_meta_by_owner",
    "list_file_meta_by_folder",
    # Update
    "rename_file_meta",
    "move_file_meta",
    # Delete
    "delete_file_meta_and_bytes",
    # Aggregate / Utility
    "count_file_meta_by_owner",
    "total_bytes_by_owner",
    "file_meta_and_bytes_exists",
]
