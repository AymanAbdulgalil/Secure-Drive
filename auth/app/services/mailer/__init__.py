"""
Email verification package.

Provides stateless email verification delivery.

Submodules and tamplates:
    _mailer.py:               SMTP email delivery.
    _body_template.html:      HTML email body template.
    _body_template.txt:       Plaintext email body template (fallback if html is not supported).
"""

from ._mailer import send_password_reset_email, send_verification_email

__all__ = ["send_verification_email", "send_password_reset_email"]
