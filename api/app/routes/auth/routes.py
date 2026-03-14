from __future__ import annotations

from uuid import uuid4
from asyncpg import Connection
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import HTMLResponse

from .._common import get_db
from ...models.user import (
    UserRegister,
    UserLogin,
    UserResponse,
)
from ...models.token import RefreshToken
from ...models.types import Email
from ...database.user import (
    create_user,
    invalidate_access_tokens,
    mark_verified,
    increment_verification_version,
    get_user_by_email,
    get_user_by_id,
    record_login,
)
from ...database.token import create_refresh_token
from ...database.user.exceptions import (
    EmailAlreadyExistsError,
    UserCreateError,
)
from ...services.mailer import send_verification_email
from ...services.tokens import create_verification_token, decode_verification_token, create_access_token
from ...services.crypto import hash_password, verify_password


router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED
)
async def register(user_data: UserRegister, conn: Connection = Depends(get_db)):
    try:

        data = user_data
        data.password = hash_password(data.password)

        new_user = await create_user(
            conn=conn,
            user_data=data,
        )
    except EmailAlreadyExistsError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )
    except UserCreateError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )

    # Attempt to send verification email after the user is persisted
    try:
        token = create_verification_token(
                user_id=new_user.user_id,
                version=new_user.verification_version
            )
        send_verification_email(
            recipient=new_user.email,
            signed_token=token.tok,
        )
    except Exception as exc:
        # Email verification link was not sent — don't roll back, just warn the caller
        raise HTTPException(
            status_code=status.HTTP_201_CREATED,
            detail=f"Failed to send verification email: {exc}",
        )

    return UserResponse(
        name=new_user.name,
        email=new_user.email,
        created_at=new_user.created_at,
        storage_used=new_user.storage_used,
        storage_quota=new_user.storage_quota,
    )


@router.post("/resend-verification", status_code=status.HTTP_200_OK)
async def resend_verification(email: Email, conn: Connection = Depends(get_db)):
    # Find user by email
    user = await get_user_by_email(conn=conn, email=email)

    user = await increment_verification_version(conn=conn, user_id=user.user_id)

    try:
        send_verification_email(
            recipient=user.email,
            signed_token=create_verification_token(
                user_id=user.user_id,
                version=user.verification_version,
            ),
        )
    except Exception as exc:
        # Email verification link was not sent — don't roll back, just warn the caller
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send verification email: {exc}",
        )


@router.get("/verify/{signed_token}", status_code=status.HTTP_200_OK)
async def verify_email(
    signed_token: str,
    conn: Connection = Depends(get_db),
):
    token = decode_verification_token(signed_token=signed_token)    # also checks expiery
    user = await get_user_by_id(conn=conn, user_id=token.sub)

    if user.verification_version != token.ver:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The used verification token has been invalidated.",
        )
    await mark_verified(
        conn=conn,
        user_id=user.user_id,
        verification_version=user.verification_version
    )

    return HTMLResponse(
        content='<script>window.location.href="http://localhost:5173/login"</script>'
    )


@router.post(
    "/login", response_model=UserResponse, status_code=status.HTTP_200_OK
)
async def login(credentials: UserLogin, conn: Connection = Depends(get_db)):
    # Find user by email
    user = await get_user_by_email(conn=conn, email=credentials.email)

    if not verify_password(
        plain_password=credentials.password, hashed_password=user.password_hash
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    if not user.verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified.",
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is deactivated, activate before login.",
        )

    # Update last login
    await record_login(conn=conn, user_id=user.user_id)

    # Create tokens
    access_token = create_access_token(user.user_id, user.verification_version)
    refresh_token = RefreshToken(
        token_id=uuid4(),
        user_id=user.user_id,

    )
    refresh_token = create_refresh_token(conn=conn, refresh_token=refresh_token)

    return UserResponse(
        access_token=access_token,
        refresh_token=
    )


# @router.post("/refresh", response_model=BearerToken)
# async def refresh(
#     token_data: RefreshTokenRequest, get_db: Annotated[Session, Depends(get_db)]
# ):
#     """
#     Refresh an access token using a refresh token.
#     """
#     # Decode refresh token
#     payload = decode_token(token_data.refresh_token)
#     if not payload or payload.get("type") != "refresh":
#         raise HTTPException(
#             status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token"
#         )

#     # Check if token exists in database and is not revoked
#     token_hash = hash_token(token_data.refresh_token)
#     stored_token = (
#         get_db.query(RefreshToken)
#         .filter(RefreshToken.token_hash == token_hash, RefreshToken.revoked.is_(False))
#         .first()
#     )

#     if stored_token is None:
#         raise HTTPException(
#             status_code=status.HTTP_401_UNAUTHORIZED,
#             detail="Refresh token not found or revoked",
#         )

#     # Check if token is expired
#     if stored_token.expires_at < datetime.now(timezone.utc):  # type: ignore
#         raise HTTPException(
#             status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired"
#         )

#     # Get user
#     user = get_db.query(User).filter(User.user_id == stored_token.user_id).first()
#     if not user:
#         raise HTTPException(
#             status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found"
#         )

#     # Create new tokens
#     access_token = create_access_token(str(user.user_id))
#     new_refresh_token, refresh_expires = create_refresh_token(str(user.user_id))

#     # Revoke old refresh token and create new one
#     stored_token.revoked = True  # type: ignore
#     new_refresh_token_record = RefreshToken(
#         user_id=user.user_id,
#         token_hash=hash_token(new_refresh_token),
#         expires_at=refresh_expires,
#     )
#     get_db.add(new_refresh_token_record)
#     get_db.commit()

#     return BearerToken(
#         access_token=access_token,
#         refresh_token=new_refresh_token,
#         expires_in=ACCESS_TOKEN_TTL_SECONDS * 60,
#     )


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(
    current_user: str = Depends(get_current_user_id),
    conn: Connection = Depends(get_db),
):
    """
    Logout by revoking all access tokens.
    """

    await invalidate_access_tokens(conn=conn, user_id=current_user)
    return None


@router.get("/me", response_model=UserResponse, status_code=status.HTTP_200_OK)
async def get_current_user_info(current_user: UserResponse = Depends(get_current_user)):
    """
    Get current authenticated user information.
    """
    return current_user
