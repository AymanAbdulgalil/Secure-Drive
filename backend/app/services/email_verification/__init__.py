"""
Email verification package.

Provides stateless email verification tokens and email delivery.

Submodules and tamplates:
    _tokens.py:               JWT-style stateless token creation and validation.
    _mailer.py:               SMTP email delivery.
    _body_template.html:      HTML email body template.
    _body_template.txt:       Plaintext email body template (fallback if html is not supported).
"""

from ._tokens import (
    create_token,
    validate_token,
)

from ._mailer import send_email

__all__ = [
    # Token functions and errors
    "create_token",
    "validate_token",
    # Mailer functions and errors
    "send_email",
]
