from pydantic import BaseModel

from .types import Email


class ResetPasswordRequest(BaseModel):
    new_password: str
    email: Email