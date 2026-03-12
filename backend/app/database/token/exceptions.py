"""Exceptions for the data-access layer concerned with the ``refres_tokens`` table."""


class TokenError(Exception):
    """Base class for all token errors."""


class TokenCreateError(TokenError):
    """Raesed when a token could not be created."""


class TokenNotFoundError(TokenError):
    """Raised when a token cannot be found."""


class TokenTypeError(TokenError):
    """Raised when the token type is not recognized."""


class TokenVersionError(TokenError):
    """Raised when the user's record version differs from the token's version."""


class TokenExpiredError(TokenError):
    """Raised when the token has passed its expiry time."""


class TokenSubjectError(TokenError):
    """Raised when the token subject (user ID) is missing or malformed/mismatched."""


class TokenSignatureError(TokenError):
    """Raised when the token signature does not match."""