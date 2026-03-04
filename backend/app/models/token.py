from pydantic import BaseModel


class LoginResponse(BaseModel):
    access_token: str
    # refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class VerificationResult(BaseModel):
    user_id: str
    expires_at: int
