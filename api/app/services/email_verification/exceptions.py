"""Exceptions for the mailer service"""


class MailerError(Exception):
    """Base class for all mailer errors."""


class InvalidAddressError(MailerError):
    """Raised when an email address is malformed or empty."""


class SMTPConnectionError(MailerError):
    """Raised when a connection to the SMTP server cannot be established."""


class SMTPAuthenticationError(MailerError):
    """Raised when SMTP credentials are rejected."""


class SMTPSendError(MailerError):
    """Raised when the server refuses to deliver the message."""
