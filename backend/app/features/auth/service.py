from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import get_settings
from core.security import hash_password, verify_password, validate_password_strength
from core.auth import (
    create_access_token,
    create_refresh_token,
    verify_refresh_token,
    revoke_refresh_token,
    revoke_all_user_tokens,
)
from features.auth.models import User
from features.categories.service import CategoryService

settings = get_settings()


class AuthService:
    @staticmethod
    async def register(
        db: AsyncSession, email: str, password: str, display_name: str | None = None
    ) -> User:
        """Register a new user."""
        result = await db.execute(select(User).where(User.email == email))
        existing = result.scalar_one_or_none()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )

        user = User(
            email=email,
            password_hash=hash_password(password),
            display_name=display_name,
            auth_provider="local",
        )
        db.add(user)
        await db.flush()
        await db.refresh(user)

        await CategoryService.seed_defaults(db, owner_id=user.id)
        return user

    @staticmethod
    async def login(db: AsyncSession, email: str, password: str):
        """Authenticate and return access + refresh tokens. Handles 2FA check."""
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

        # Google-only users cannot login with password
        if user.auth_provider == "google" and not user.password_hash:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This account uses Google Sign-In. Please use the Google login button.",
            )

        if not verify_password(password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

        # Check if 2FA is enabled
        if user.totp_enabled:
            # Return a short-lived 2FA token instead of real tokens
            from datetime import timedelta
            two_fa_token = create_access_token(
                data={"sub": str(user.id), "purpose": "2fa"},
                expires_delta=timedelta(minutes=5),
            )
            return {"requires_2fa": True, "two_factor_token": two_fa_token}

        access_token = create_access_token(data={"sub": str(user.id)})
        refresh_token = await create_refresh_token(user.id, db)
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        }

    @staticmethod
    async def refresh_tokens(db: AsyncSession, refresh_token_str: str):
        """Verify refresh token, rotate it, return new token pair."""
        user, old_refresh = await verify_refresh_token(refresh_token_str, db)

        # Revoke the old refresh token (rotation)
        old_refresh.revoked = True
        await db.flush()

        access_token = create_access_token(data={"sub": str(user.id)})
        new_refresh = await create_refresh_token(user.id, db)
        return {
            "access_token": access_token,
            "refresh_token": new_refresh,
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        }

    @staticmethod
    async def change_password(
        db: AsyncSession, user: User, current_password: str, new_password: str
    ):
        """Change user password after verifying current one."""
        if user.auth_provider == "google" and not user.password_hash:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot change password for Google-only account",
            )

        if not verify_password(current_password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect",
            )

        user.password_hash = hash_password(new_password)
        await db.flush()

        # Revoke all refresh tokens to force re-login on other devices
        await revoke_all_user_tokens(user.id, db)

    @staticmethod
    async def verify_2fa(db: AsyncSession, two_factor_token: str, totp_code: str):
        """Complete 2FA login by verifying the TOTP code."""
        from jose import JWTError, jwt as jose_jwt
        from features.auth.totp import TOTPService

        try:
            payload = jose_jwt.decode(
                two_factor_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
            )
            if payload.get("purpose") != "2fa":
                raise HTTPException(status_code=401, detail="Invalid 2FA token")
            user_id = int(payload.get("sub"))
        except (JWTError, ValueError, TypeError):
            raise HTTPException(status_code=401, detail="Invalid or expired 2FA token")

        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user or not user.totp_enabled:
            raise HTTPException(status_code=401, detail="Invalid 2FA token")

        # Try TOTP code first
        if user.totp_secret and TOTPService.verify_code(user.totp_secret, totp_code):
            access_token = create_access_token(data={"sub": str(user.id)})
            refresh_token = await create_refresh_token(user.id, db)
            return {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            }

        # Try recovery code
        if user.recovery_codes:
            valid, updated_codes = TOTPService.verify_recovery_code(totp_code, user.recovery_codes)
            if valid:
                user.recovery_codes = updated_codes
                await db.flush()
                access_token = create_access_token(data={"sub": str(user.id)})
                refresh_token = await create_refresh_token(user.id, db)
                return {
                    "access_token": access_token,
                    "refresh_token": refresh_token,
                    "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
                }

        raise HTTPException(status_code=401, detail="Invalid verification code")

    @staticmethod
    async def forgot_password(db: AsyncSession, email: str):
        """Check if user exists and has 2FA enabled for password reset."""
        from datetime import timedelta

        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        # No email enumeration: same response for missing user or no 2FA
        if not user or not user.totp_enabled:
            return {"method": "none"}

        reset_token = create_access_token(
            data={"sub": str(user.id), "purpose": "password_reset_init"},
            expires_delta=timedelta(minutes=5),
        )
        return {"method": "2fa", "reset_token": reset_token}

    @staticmethod
    async def verify_reset_2fa(db: AsyncSession, reset_token: str, totp_code: str):
        """Verify TOTP/recovery code during password reset, return password_reset_token."""
        from datetime import timedelta
        from jose import JWTError, jwt as jose_jwt
        from features.auth.totp import TOTPService

        try:
            payload = jose_jwt.decode(
                reset_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
            )
            if payload.get("purpose") != "password_reset_init":
                raise HTTPException(status_code=401, detail="Invalid reset token")
            user_id = int(payload.get("sub"))
        except (JWTError, ValueError, TypeError):
            raise HTTPException(status_code=401, detail="Invalid or expired reset token")

        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user or not user.totp_enabled:
            raise HTTPException(status_code=401, detail="Invalid reset token")

        # Try TOTP code first, then recovery code
        verified = False
        if user.totp_secret and TOTPService.verify_code(user.totp_secret, totp_code):
            verified = True

        if not verified and user.recovery_codes:
            valid, updated_codes = TOTPService.verify_recovery_code(totp_code, user.recovery_codes)
            if valid:
                user.recovery_codes = updated_codes
                await db.flush()
                verified = True

        if not verified:
            raise HTTPException(status_code=401, detail="Invalid verification code")

        password_reset_token = create_access_token(
            data={"sub": str(user.id), "purpose": "password_reset"},
            expires_delta=timedelta(minutes=5),
        )
        return {"password_reset_token": password_reset_token}

    @staticmethod
    async def reset_password(db: AsyncSession, password_reset_token: str, new_password: str):
        """Reset password after 2FA verification."""
        from jose import JWTError, jwt as jose_jwt

        try:
            payload = jose_jwt.decode(
                password_reset_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
            )
            if payload.get("purpose") != "password_reset":
                raise HTTPException(status_code=401, detail="Invalid reset token")
            user_id = int(payload.get("sub"))
        except (JWTError, ValueError, TypeError):
            raise HTTPException(status_code=401, detail="Invalid or expired reset token")

        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=401, detail="Invalid reset token")

        user.password_hash = hash_password(new_password)
        await db.flush()

        await revoke_all_user_tokens(user.id, db)
