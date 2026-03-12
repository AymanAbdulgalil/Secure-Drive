"""Exceptions for the data-access layer concerned with the ``files`` table, and file persistent storage."""


class FileError(Exception):
    """Base class for all file errors."""


class FileNotFoundError(FileError):
    """Raised when there is no file for a given identifier."""


class FileCreateError(FileError):
    """Raised when a file could not be created."""
