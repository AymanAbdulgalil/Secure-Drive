import re
from typing import Annotated
from pathlib import PurePosixPath
from pydantic import Field, TypeAdapter, EmailStr
from pydantic.functional_validators import AfterValidator
from pydantic.networks import IPvAnyAddress


_BUCKET_NAME_RE = re.compile(r"^[a-z0-9][a-z0-9\-]{1,61}[a-z0-9]$")
_IP_ADDRESS_RE = re.compile(r"^\d+\.\d+\.\d+\.\d+$")
_MIME_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9!#$&\-^_]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-^_.+]*$")


def _validate_bucket_name(value: str) -> str:
    if not _BUCKET_NAME_RE.match(value):
        raise ValueError(
            f"'{value}' is not a valid bucket name: must be 3-63 characters, "
            "lowercase letters, numbers, and hyphens only, "
            "and must start and end with a letter or number"
        )
    if _IP_ADDRESS_RE.match(value):
        raise ValueError(
            f"'{value}' is not a valid bucket name: must not be an IP address"
        )
    if value.startswith("xn--"):
        raise ValueError(
            f"'{value}' is not a valid bucket name: must not start with 'xn--'"
        )
    return value


def _validate_mime(value: str) -> str:
    if not _MIME_RE.match(value):
        raise ValueError(f"'{value}' is not a valid MIME type")
    return value.lower()


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


def _validate_logical_path(value: PurePosixPath) -> PurePosixPath:
    if not value.is_absolute():
        raise ValueError(f"'{value}' is not an absolute path")
    if ".." in value.parts:
        raise ValueError(f"'{value}' contains '..' which is not allowed")
    if "" in value.parts:
        raise ValueError(f"'{value}' contains empty path segments")
    return value


Bucket = Annotated[str, AfterValidator(_validate_bucket_name)]
MimeType = Annotated[str, AfterValidator(_validate_mime)]
SHA256Hex = Annotated[str, AfterValidator(_validate_hex)]
Email = Annotated[str, AfterValidator(_validate_email)]
LogicalPath = Annotated[PurePosixPath, AfterValidator(_validate_logical_path)]
