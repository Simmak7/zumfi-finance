from fastapi import APIRouter, Depends, Request
from jose import jwt
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth import (
    get_current_user, blacklist_token, revoke_refresh_token,
)
from core.config import get_settings
from core.database import get_db
from core.rate_limit import limiter
from features.auth.models import User
from features.auth.schemas import (
    RegisterRequest, LoginRequest, TokenResponse, UserResponse,
    RefreshTokenRequest, ChangePasswordRequest, GoogleCallbackRequest,
    TwoFactorVerifyRequest, TOTPConfirmRequest, TOTPDisableRequest,
    TOTPSetupResponse, TOTPConfirmResponse,
    ForgotPasswordRequest, ResetPasswordVerifyRequest, ResetPasswordRequest,
)
from features.auth.service import AuthService
from features.auth.oauth import GoogleOAuthService
from features.auth.totp import TOTPService

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


@router.post("/register", response_model=UserResponse)
@limiter.limit("3/minute")
async def register(request: Request, body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register a new user account."""
    user = await AuthService.register(
        db, email=body.email, password=body.password, display_name=body.display_name
    )
    return user


@router.post("/login")
@limiter.limit("5/minute")
async def login(request: Request, body: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Login and receive JWT tokens. May return 2FA challenge."""
    result = await AuthService.login(db, email=body.email, password=body.password)
    return result


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("10/minute")
async def refresh(request: Request, body: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    """Exchange a refresh token for a new token pair."""
    result = await AuthService.refresh_tokens(db, body.refresh_token)
    return result


@router.post("/logout")
async def logout(
    request: Request,
    body: RefreshTokenRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Logout: blacklist current access token and revoke refresh token."""
    # Blacklist the access token
    auth_header = request.headers.get("authorization", "")
    token = auth_header.replace("Bearer ", "")
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        jti = payload.get("jti")
        exp = payload.get("exp", 0)
        if jti:
            import time
            ttl = max(int(exp - time.time()), 0)
            await blacklist_token(jti, ttl)
    except Exception:
        pass  # Best effort blacklisting

    # Revoke the refresh token
    await revoke_refresh_token(body.refresh_token, db)
    return {"message": "Logged out successfully"}


@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change the current user's password."""
    await AuthService.change_password(
        db, current_user, body.current_password, body.new_password
    )
    return {"message": "Password changed successfully"}


# --------------- Google OAuth ---------------

@router.get("/google/login")
async def google_login():
    """Get Google OAuth authorization URL."""
    url = GoogleOAuthService.get_authorization_url()
    return {"authorization_url": url}


@router.post("/google/callback")
@limiter.limit("5/minute")
async def google_callback(request: Request, body: GoogleCallbackRequest, db: AsyncSession = Depends(get_db)):
    """Exchange Google authorization code for app tokens."""
    result = await GoogleOAuthService.exchange_code(body.code, db)
    return result


@router.post("/google/link")
async def google_link(
    body: GoogleCallbackRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Link a Google account to the current user."""
    await GoogleOAuthService.link_google_account(current_user.id, body.code, db)
    return {"message": "Google account linked successfully"}


# --------------- Two-Factor Authentication ---------------

@router.post("/verify-2fa")
@limiter.limit("5/minute")
async def verify_2fa(request: Request, body: TwoFactorVerifyRequest, db: AsyncSession = Depends(get_db)):
    """Complete 2FA login with TOTP code or recovery code."""
    result = await AuthService.verify_2fa(db, body.two_factor_token, body.totp_code)
    return result


@router.post("/2fa/setup", response_model=TOTPSetupResponse)
async def setup_2fa(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate TOTP secret and QR code for 2FA setup."""
    result = await TOTPService.setup_2fa(db, current_user.id)
    return result


@router.post("/2fa/confirm", response_model=TOTPConfirmResponse)
async def confirm_2fa(
    body: TOTPConfirmRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Confirm 2FA setup with initial TOTP code. Returns recovery codes."""
    recovery_codes = await TOTPService.confirm_2fa(db, current_user.id, body.code)
    return {"recovery_codes": recovery_codes}


@router.post("/2fa/disable")
async def disable_2fa(
    body: TOTPDisableRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Disable 2FA after verifying current TOTP code."""
    await TOTPService.disable_2fa(db, current_user.id, body.code)
    return {"message": "Two-factor authentication disabled"}


# --------------- Forgot Password (via 2FA) ---------------

@router.post("/forgot-password")
@limiter.limit("5/minute")
async def forgot_password(request: Request, body: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Start password reset. Returns 2FA challenge if user has TOTP enabled."""
    result = await AuthService.forgot_password(db, body.email)
    return result


@router.post("/reset-password-verify")
@limiter.limit("5/minute")
async def reset_password_verify(request: Request, body: ResetPasswordVerifyRequest, db: AsyncSession = Depends(get_db)):
    """Verify TOTP/recovery code for password reset."""
    result = await AuthService.verify_reset_2fa(db, body.reset_token, body.totp_code)
    return result


@router.post("/reset-password")
@limiter.limit("3/minute")
async def reset_password(request: Request, body: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Set new password after 2FA verification."""
    await AuthService.reset_password(db, body.password_reset_token, body.new_password)
    return {"message": "Password reset successfully. Please log in with your new password."}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current authenticated user."""
    return current_user
