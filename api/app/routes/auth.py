from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

from asyncpg import Connection
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import HTMLResponse

from ..database.token import (
    create_refresh_token,
    get_refresh_token_by_hash,
    rotate_refresh_token,
)
from ..database.token.exceptions import (
    TokenError,
    TokenExpiredError,
    TokenNotFoundError,
)
from ..database.user import (
    create_user,
    get_user_by_email,
    get_user_by_id,
    increment_password_version,
    increment_verification_version,
    invalidate_access_tokens,
    mark_verified,
    record_login,
    update_password,
)
from ..database.user.exceptions import (
    EmailAlreadyExistsError,
    UserCreateError,
    UserNotFoundError,
)
from ..models.reset_password import ResetPasswordRequest
from ..models.token import RefreshTokenCreate, RefreshTokenRequest
from ..models.types import Email
from ..models.user import (
    UserLogin,
    UserRegister,
    UserResponse,
)
from ..services.crypto import verify_password
from ..services.mailer import send_password_reset_email, send_verification_email
from ..services.tokens import (
    create_access_token,
    create_password_reset_token,
    create_verification_token,
    decode_access_token,
    decode_verification_token,
    generate_refresh_token,
    hash_refresh_token,
)
from ..services.tokens._password import decode_password_reset_token
from ._common import get_db, get_token

router = APIRouter(prefix="/auth", tags=["Authentication"])

REFRESH_TOKEN_TTL = timedelta(days=30)


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_200_OK)
async def register(user_data: UserRegister, conn: Connection = Depends(get_db)):
    try:
        new_user = await create_user(
            conn=conn,
            user_data=user_data,
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
            user_id=new_user.user_id, version=new_user.verification_version
        )
        send_verification_email(
            recipient=new_user.email,
            signed_token=token.tok,  # type: ignore
        )
    except Exception as exc:
        # Email verification link was not sent — don't roll back, just warn the caller
        print(f"Failed to send verification email: {exc}")
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
    try:
        user = await get_user_by_email(conn=conn, email=email)
    except UserNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No user with this email exists, register the user first.",
        )

    user = await increment_verification_version(conn=conn, user_id=user.user_id)

    try:
        token = create_verification_token(
            user_id=user.user_id,
            version=user.verification_version,
        )
        send_verification_email(
            recipient=user.email,
            signed_token=token.tok,  # type: ignore
        )
    except Exception as exc:
        # Email verification link was not sent — just warn the caller
        print(f"Failed to send verification email: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send verification email: {exc}",
        )


@router.get("/verify/{signed_token}", status_code=status.HTTP_200_OK)
async def verify_email(
    signed_token: str,
    conn: Connection = Depends(get_db),
):
    token = decode_verification_token(signed_token=signed_token)  # also checks expiry
    user = await get_user_by_id(conn=conn, user_id=token.sub)

    if user.verification_version != token.ver:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The used verification token has been invalidated.",
        )
    await mark_verified(
        conn=conn, user_id=user.user_id, verification_version=user.verification_version
    )

    return HTMLResponse(
        content='<script>window.location.href="http://localhost:5173/login"</script>'
    )


@router.post("/login", response_model=UserResponse, status_code=status.HTTP_200_OK)
async def login(credentials: UserLogin, conn: Connection = Depends(get_db)):
    # Find user by email
    try:
        user = await get_user_by_email(conn=conn, email=credentials.email)
    except UserNotFoundError:
        print("Email not found.")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User or password incorrect.",
        )

    if not verify_password(
        plain_password=credentials.password, hashed_password=user.password_hash
    ):
        print("Password doesn't match.")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User or password incorrect.",
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

    # Create access token
    access_token = create_access_token(user.user_id, user.verification_version)

    # Generate a raw refresh token, hash it for storage, and persist
    raw_token = generate_refresh_token()
    now = datetime.now(tz=timezone.utc)
    refresh_token_create = RefreshTokenCreate(
        user_id=user.user_id,
        token_hash=hash_refresh_token(raw_token),
        family_id=uuid4(),
    )
    await create_refresh_token(
        conn=conn,
        refresh_token=refresh_token_create,
        expires_at=now + REFRESH_TOKEN_TTL,
    )

    return UserResponse(
        name=user.name,
        email=user.email,
        created_at=user.created_at,
        storage_used=user.storage_used,
        storage_quota=user.storage_quota,
        access_token=access_token.tok,
        refresh_token=raw_token,  # raw token returned once; only hash is stored
    )


@router.post("/refresh", status_code=status.HTTP_200_OK)
async def refresh(
    token_data: RefreshTokenRequest,
    conn: Connection = Depends(get_db),
):
    """
    Exchange a valid refresh token for a new access token + refresh token pair.
    The old refresh token is consumed; presenting it again will revoke the
    entire family (replay-attack countermeasure).
    """
    # 1. Hash the incoming raw token and look it up
    token_hash = hash_refresh_token(token_data.refresh_token)
    try:
        old_token = await get_refresh_token_by_hash(conn=conn, token_hash=token_hash)
    except TokenNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token not found.",
        )

    # 2. Pre-create the replacement token in the DB (rotate_refresh_token
    #    requires both rows to already exist before it runs)
    raw_new_token = generate_refresh_token()
    now = datetime.now(tz=timezone.utc)
    new_token = await create_refresh_token(
        conn=conn,
        refresh_token=RefreshTokenCreate(
            user_id=old_token.user_id,
            token_hash=hash_refresh_token(raw_new_token),
            family_id=old_token.family_id,  # preserve the rotation family
        ),
        expires_at=now + REFRESH_TOKEN_TTL,
    )

    # 3. Atomically revoke the old token and link it to the new one.
    #    Any replay of the old token will nuke the whole family from here on.
    try:
        await rotate_refresh_token(
            conn=conn,
            old_token_id=old_token.token_id,
            new_token_id=new_token.token_id,
        )
    except TokenExpiredError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has expired. Please log in again.",
        )
    except TokenError:
        # Covers replay detection — family already nuked inside rotate_refresh_token
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token is invalid. Please log in again.",
        )

    # 4. Issue a fresh access token for the token's owner
    user = await get_user_by_id(conn=conn, user_id=old_token.user_id)
    access_token = create_access_token(user.user_id, user.verification_version)

    return {
        "access_token": access_token.tok,
        "refresh_token": raw_new_token,  # raw token returned once; only hash is stored
    }


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
async def forgot_password(email: Email, conn: Connection = Depends(get_db)):
    """
    Attempt to send a password reset email to the given email, if exists. returns 200 regardless.
    """
    try:
        user = await get_user_by_email(conn=conn, email=email)
    except UserNotFoundError:
        print("Email not found.")
        return None

    user = await increment_password_version(conn=conn, user_id=user.user_id)

    try:
        token = create_password_reset_token(
            user_id=user.user_id, version=user.password_version
        )
        send_password_reset_email(
            recipient=user.email,
            signed_token=token.tok,  # type: ignore
        )
    except Exception as exc:
        # Password reset link was not sent — don't roll back, don't also warn the caller, just log
        print(f"Failed to send password reset email: {exc}")


@router.get("/reset-password/{signed_token}", status_code=status.HTTP_200_OK)
async def validate_password_reset_token(
    signed_token: str,
    conn: Connection = Depends(get_db),
):
    token = decode_password_reset_token(signed_token=signed_token)  # also checks expiry
    user = await get_user_by_id(conn=conn, user_id=token.sub)

    if user.password_version != token.ver:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The used password reset token has been invalidated.",
        )

    return HTMLResponse(
        content='<script>window.location.href="http://localhost:5173/reset-password"</script>'
    )


@router.post("/reset-password", status_code=status.HTTP_200_OK)
async def reset_password(
    request: ResetPasswordRequest,
    conn: Connection = Depends(get_db),
):
    user = await get_user_by_email(conn=conn, email=request.email)
    await update_password(
        conn=conn, user_id=user.user_id, password=request.new_password
    )

    return HTMLResponse(
        content='<script>window.location.href="http://localhost:5173/reset-password"</script>'
    )


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(
    token: str = Depends(get_token),
    conn: Connection = Depends(get_db),
):
    """
    Logout by revoking all access tokens.
    """
    tok = decode_access_token(token)

    await invalidate_access_tokens(conn=conn, user_id=tok.sub)
    return None


@router.get("/me", response_model=UserResponse, status_code=status.HTTP_200_OK)
async def me(conn: Connection = Depends(get_db), token=Depends(get_token)):
    """
    Get current authenticated user information.
    """
    tok = decode_access_token(token)
    user = await get_user_by_id(conn=conn, user_id=tok.sub)
    return user
