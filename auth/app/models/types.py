from typing import Annotated

from pydantic import EmailStr, TypeAdapter
from pydantic.functional_validators import AfterValidator


def _validate_hex(value: str) -> str:
    if not all(c in "0123456789abcdefABCDEF" for c in value):
        raise ValueError(
            f"'{value}' is not a valid hex string. It contains illegal characters."
        )
    if len(value) != 64:
        raise ValueError(
            f"'{value}' is not a valid hex string. It's not 64 characters long."
        )
    return value.lower()


def _validate_email(value: str) -> str:
    try:
        TypeAdapter(EmailStr).validate_python(value)
    except Exception as exc:
        raise ValueError(f"'{value}' is not a valid email string") from exc
    return value.lower()


SHA256Hex = Annotated[str, AfterValidator(_validate_hex)]
Email = Annotated[str, AfterValidator(_validate_email)]