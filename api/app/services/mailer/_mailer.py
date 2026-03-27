from __future__ import annotations

import os
import re
import smtplib
import socket
from dataclasses import dataclass
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr, parseaddr
from functools import lru_cache
from pathlib import Path
from urllib.parse import quote

from .exceptions import (
    InvalidAddressError,
    MailerError,
    SMTPAuthenticationError,
    SMTPConnectionError,
    SMTPSendError,
)

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# ---------------------------------------------------------------------------
# Config dataclass
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class _EmailConfig:
    BASE_URL: str
    ENDPOINT: str
    SMTP_HOST: str
    SMTP_PORT: int
    SMTP_USERNAME: str
    SMTP_PASSWORD: str
    SMTP_SECURITY: str
    SMTP_ADDRESS: str
    SUBJECT: str
    SENDER_NAME: str
    URL_PLACEHOLDER: str
    TEXT_BODY_TEMPLATE: str
    HTML_BODY_TEMPLATE: str | None = None

    def __post_init__(self):
        self.validate()

    def validate(self) -> None:
        str_fields = [
            ("BASE_URL", self.BASE_URL),
            ("SMTP_HOST", self.SMTP_HOST),
            ("SMTP_USERNAME", self.SMTP_USERNAME),
            ("SMTP_PASSWORD", self.SMTP_PASSWORD),
            ("SMTP_SECURITY", self.SMTP_SECURITY),
            ("SMTP_ADDRESS", self.SMTP_ADDRESS),
            ("SUBJECT", self.SUBJECT),
            ("SENDER_NAME", self.SENDER_NAME),
            ("URL_PLACEHOLDER", self.URL_PLACEHOLDER),
            ("TEXT_BODY_TEMPLATE", self.TEXT_BODY_TEMPLATE),
        ]

        missing = [name for name, value in str_fields if not value or not value.strip()]
        if missing:
            raise MailerError(
                f"Missing or empty required configuration variables: {', '.join(missing)}"
            )

        if not 0 < self.SMTP_PORT < 65536:
            raise ValueError(
                f"Configuration variable SMTP_PORT must be a valid port number "
                f"(0 < port < 65536), got {self.SMTP_PORT!r}."
            )

        if self.SMTP_SECURITY.lower() not in ("ssl", "tls"):
            raise MailerError(
                f"Unsupported SMTP_SECURITY value: {self.SMTP_SECURITY!r}. "
                "Expected 'ssl' or 'tls'."
            )


def _parse_smtp_port() -> int:
    raw = os.getenv("SMTP_PORT", "")
    if not raw.strip():
        raise MailerError(
            "Missing or empty required configuration variables: SMTP_PORT"
        )
    try:
        return int(raw)
    except ValueError:
        raise MailerError(f"SMTP_PORT must be a valid integer, got {raw!r}.")


@lru_cache(maxsize=None)
def _load_config(
    *, title: str, route: str, html_file: str, text_file: str
) -> _EmailConfig:
    _dir = Path(__file__).parent

    try:
        html_body_template: str | None = (_dir / html_file).read_text(encoding="utf-8")
    except OSError:
        html_body_template = None  # HTML body is optional

    try:
        text_body_template = (_dir / text_file).read_text(encoding="utf-8")
    except FileNotFoundError as exc:
        raise MailerError(
            f"Email text body template file not found: {exc.filename}"
        ) from exc
    except OSError as exc:
        raise MailerError(f"Error loading email body template: {exc}") from exc

    base_url = os.getenv("BASE_URL", "")

    return _EmailConfig(
        BASE_URL=base_url,
        ENDPOINT=f"{base_url}/{route}",
        SMTP_HOST=os.getenv("SMTP_HOST", ""),
        SMTP_PORT=_parse_smtp_port(),
        SMTP_USERNAME=os.getenv("SMTP_USERNAME", ""),
        SMTP_PASSWORD=os.getenv("SMTP_PASSWORD", ""),
        SMTP_SECURITY=os.getenv("SMTP_SECURITY", ""),
        SMTP_ADDRESS=os.getenv("SMTP_ADDRESS", ""),
        SUBJECT=title,
        SENDER_NAME="Secure Drive",
        URL_PLACEHOLDER="BASE_URL_WITH_ROUTE_AND_TOKEN",
        HTML_BODY_TEMPLATE=html_body_template,
        TEXT_BODY_TEMPLATE=text_body_template,
    )


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _validate_address(address: str, field: str = "address") -> str:
    if not isinstance(address, str) or not address.strip():
        raise InvalidAddressError(f"{field} must be a non-empty string.")

    _, addr = parseaddr(address.strip())

    if not addr or not _EMAIL_RE.match(addr):
        raise InvalidAddressError(
            f"{field} '{address}' does not appear to be a valid email address."
        )

    return addr


def _build_message(
    sender: str,
    sender_name: str | None,
    recipient: str,
    subject: str,
    body: str,
    html_body: str | None,
) -> MIMEMultipart:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = formataddr((sender_name or "", sender))
    msg["To"] = recipient

    msg.attach(MIMEText(body, "plain", "utf-8"))
    if html_body:
        msg.attach(MIMEText(html_body, "html", "utf-8"))

    return msg


def _send_smtp_message(
    *, config: _EmailConfig, timeout: int, signed_token: str, recipient: str
) -> None:

    if not isinstance(timeout, int) or timeout <= 0:
        raise ValueError("timeout must be a positive integer.")
    if not isinstance(signed_token, str) or not signed_token.strip():
        raise ValueError("signed_token must be a non-empty string.")

    sender_addr = _validate_address(config.SMTP_ADDRESS, "sender")
    recipient_addr = _validate_address(recipient, "recipient")

    reset_url = f"{config.ENDPOINT}/{quote(signed_token, safe='')}"

    text_body = config.TEXT_BODY_TEMPLATE.replace(
        config.URL_PLACEHOLDER, reset_url
    ).strip()
    if not text_body:
        raise MailerError("Rendered text body is empty after URL substitution.")

    html_body: str | None = None
    if config.HTML_BODY_TEMPLATE:
        html_body = (
            config.HTML_BODY_TEMPLATE.replace(config.URL_PLACEHOLDER, reset_url).strip()
            or None
        )

    msg = _build_message(
        sender=sender_addr,
        sender_name=config.SENDER_NAME,
        recipient=recipient_addr,
        subject=config.SUBJECT,
        body=text_body,
        html_body=html_body,
    )

    smtp_cls = (
        smtplib.SMTP_SSL if config.SMTP_SECURITY.lower() == "ssl" else smtplib.SMTP
    )

    try:
        with smtp_cls(
            config.SMTP_HOST.strip(), config.SMTP_PORT, timeout=timeout
        ) as server:
            server.ehlo()

            if config.SMTP_SECURITY.lower() == "tls":
                try:
                    server.starttls()
                    server.ehlo()
                except smtplib.SMTPException as exc:
                    raise SMTPConnectionError(
                        f"STARTTLS negotiation failed: {exc}"
                    ) from exc

            try:
                server.login(config.SMTP_USERNAME, config.SMTP_PASSWORD)
            except smtplib.SMTPAuthenticationError as exc:
                raise SMTPAuthenticationError(
                    f"SMTP authentication failed for user {config.SMTP_USERNAME!r}: {exc}"
                ) from exc

            try:
                refused = server.sendmail(
                    sender_addr, [recipient_addr], msg.as_string()
                )
            except smtplib.SMTPRecipientsRefused as exc:
                raise SMTPSendError(
                    f"Recipient {recipient_addr!r} was refused by the server: {exc}"
                ) from exc
            except smtplib.SMTPSenderRefused as exc:
                raise SMTPSendError(
                    f"Sender {sender_addr!r} was refused by the server: {exc}"
                ) from exc
            except smtplib.SMTPDataError as exc:
                raise SMTPSendError(f"Server rejected the message data: {exc}") from exc

            if refused:
                raise SMTPSendError(
                    f"Message delivery failed for recipients: {refused}"
                )

    except (socket.gaierror, socket.timeout, ConnectionRefusedError) as exc:
        raise SMTPConnectionError(
            f"Could not connect to SMTP server "
            f"{config.SMTP_HOST!r}:{config.SMTP_PORT}: {exc}"
        ) from exc
    except smtplib.SMTPConnectError as exc:
        raise SMTPConnectionError(
            f"SMTP connection error for {config.SMTP_HOST!r}:{config.SMTP_PORT}: {exc}"
        ) from exc
    except smtplib.SMTPServerDisconnected as exc:
        raise SMTPConnectionError(
            f"SMTP server disconnected unexpectedly: {exc}"
        ) from exc
    except (SMTPConnectionError, SMTPAuthenticationError, SMTPSendError, MailerError):
        raise
    except smtplib.SMTPException as exc:
        raise MailerError(f"Unexpected SMTP error: {exc}") from exc


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def send_verification_email(
    *,
    recipient: str,
    signed_token: str,
    timeout: int = 30,
) -> None:
    """
    Send a verification email via SMTP.

    Parameters
    ----------
    recipient    : Recipient email address (e.g. "address@example.com").
    signed_token : Unique signed verification token appended to the verification endpoint.
    timeout      : Socket timeout in seconds (default 30).

    Raises
    ------
    InvalidAddressError     : sender or recipient address is malformed.
    SMTPConnectionError     : cannot reach or connect to the SMTP server.
    SMTPAuthenticationError : credentials rejected by the server.
    SMTPSendError           : server refuses to accept the message.
    MailerError             : misconfiguration or any other mailer-level error.
    ValueError              : timeout is invalid.
    """

    config = _load_config(
        title="Verify your email address for Secure Drive",
        route="api/v1/auth/verify",
        html_file="_email_verify.html",
        text_file="_email_verify.txt",
    )

    _send_smtp_message(
        config=config, timeout=timeout, signed_token=signed_token, recipient=recipient
    )


def send_password_reset_email(
    *,
    recipient: str,
    signed_token: str,
    timeout: int = 30,
) -> None:
    """
    Send a password reset email via SMTP.

    Parameters
    ----------
    recipient    : Recipient email address (e.g. "address@example.com").
    signed_token : Unique signed password reset token appended to the password reset endpoint.
    timeout      : Socket timeout in seconds (default 30).

    Raises
    ------
    InvalidAddressError     : sender or recipient address is malformed.
    SMTPConnectionError     : cannot reach or connect to the SMTP server.
    SMTPAuthenticationError : credentials rejected by the server.
    SMTPSendError           : server refuses to accept the message.
    MailerError             : misconfiguration or any other mailer-level error.
    ValueError              : timeout is invalid.
    """

    config = _load_config(
        title="Password reset request",
        route="api/v1/auth/reset-password",
        html_file="_password_reset.html",
        text_file="_password_reset.txt",
    )

    _send_smtp_message(
        config=config, timeout=timeout, signed_token=signed_token, recipient=recipient
    )
