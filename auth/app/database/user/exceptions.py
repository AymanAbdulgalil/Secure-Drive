"""Exceptions for the data-access layer concerned with the ``users`` table."""


class UserError(Exception):
    """Base class for all user errors."""


class UserNotFoundError(UserError):
    """Raised when no user exists for a given identifier."""


class UserCreateError(UserError):
    """Raised when a user could not be created."""


class StorageQuotaExceededError(UserError):
    """Raised when a user attempts to exceed their storage quota."""


class EmailAlreadyExistsError(UserError):
    """Raised when a user is created or updated with an email that already exists."""
