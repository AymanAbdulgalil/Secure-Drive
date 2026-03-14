from __future__ import annotations

from datetime import datetime, timezone

from ...models.token import RefreshToken


def is_refresh_token_valid(token: RefreshToken) -> bool:
    """Return ``True`` if ``token`` is neither revoked nor expired.

    This is a pure-Python check that does **not** hit the database.  Use it
    after fetching a token to avoid an extra round-trip for simple validity
    checks.

    Parameters
    ----------
    token:
        The token object to inspect.

    Returns
    -------
    bool
        ``True`` when the token is active and its expiry is in the future.
    """
    if token.revoked:
        return False

    expires = token.expires_at
    if expires.tzinfo is None:
        # Normalise naive datetimes (e.g. from older DB rows) to UTC.
        expires = expires.replace(tzinfo=timezone.utc)

    return expires > datetime.now(tz=timezone.utc)