"""Google OAuth2 service for authentication and account linking."""
import httpx
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import get_settings
from core.auth import create_access_token, create_refresh_token
from features.auth.models import User
from features.categories.service import CategoryService

settings = get_settings()

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"


class GoogleOAuthService:
    @staticmethod
    def get_authorization_url() -> str:
        """Build the Google OAuth consent URL."""
        if not settings.google_oauth_enabled:
            raise HTTPException(status_code=400, detail="Google OAuth is not configured")

        params = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "redirect_uri": settings.GOOGLE_REDIRECT_URI,
            "response_type": "code",
            "scope": "openid email profile",
            "access_type": "offline",
            "prompt": "consent",
        }
        query = "&".join(f"{k}={v}" for k, v in params.items())
        return f"{GOOGLE_AUTH_URL}?{query}"

    @staticmethod
    async def exchange_code(code: str, db: AsyncSession) -> dict:
        """Exchange authorization code for tokens, find or create user."""
        if not settings.google_oauth_enabled:
            raise HTTPException(status_code=400, detail="Google OAuth is not configured")

        # Exchange code for Google tokens
        async with httpx.AsyncClient() as client:
            token_resp = await client.post(GOOGLE_TOKEN_URL, data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            })

        if token_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange Google authorization code")

        google_tokens = token_resp.json()
        access_token = google_tokens.get("access_token")

        # Fetch user info from Google
        async with httpx.AsyncClient() as client:
            userinfo_resp = await client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )

        if userinfo_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to fetch Google user info")

        google_user = userinfo_resp.json()
        google_id = google_user.get("id")
        email = google_user.get("email")
        name = google_user.get("name")
        avatar = google_user.get("picture")

        if not google_id or not email:
            raise HTTPException(status_code=400, detail="Invalid Google user data")

        user = await GoogleOAuthService._get_or_create_user(
            db, google_id=google_id, email=email, name=name, avatar_url=avatar
        )

        # Check if 2FA is enabled
        if user.totp_enabled:
            from datetime import timedelta
            two_fa_token = create_access_token(
                data={"sub": str(user.id), "purpose": "2fa"},
                expires_delta=timedelta(minutes=5),
            )
            return {"requires_2fa": True, "two_factor_token": two_fa_token}

        app_access_token = create_access_token(data={"sub": str(user.id)})
        app_refresh_token = await create_refresh_token(user.id, db)
        return {
            "access_token": app_access_token,
            "refresh_token": app_refresh_token,
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        }

    @staticmethod
    async def link_google_account(user_id: int, code: str, db: AsyncSession) -> None:
        """Link a Google account to an existing user."""
        if not settings.google_oauth_enabled:
            raise HTTPException(status_code=400, detail="Google OAuth is not configured")

        # Exchange code for Google tokens
        async with httpx.AsyncClient() as client:
            token_resp = await client.post(GOOGLE_TOKEN_URL, data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            })

        if token_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange Google authorization code")

        google_tokens = token_resp.json()
        async with httpx.AsyncClient() as client:
            userinfo_resp = await client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {google_tokens['access_token']}"},
            )

        if userinfo_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to fetch Google user info")

        google_user = userinfo_resp.json()
        google_id = google_user.get("id")

        # Check if another user already has this Google ID
        existing = await db.execute(
            select(User).where(User.google_id == google_id, User.id != user_id)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="This Google account is already linked to another user")

        user_result = await db.execute(select(User).where(User.id == user_id))
        user = user_result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        user.google_id = google_id
        user.avatar_url = google_user.get("picture")
        if user.auth_provider == "local":
            user.auth_provider = "local"  # Keep as local since they have a password
        await db.flush()

    @staticmethod
    async def _get_or_create_user(
        db: AsyncSession, google_id: str, email: str, name: str | None, avatar_url: str | None
    ) -> User:
        """Find user by google_id, then by email, or create new."""
        # 1. Lookup by google_id
        result = await db.execute(select(User).where(User.google_id == google_id))
        user = result.scalar_one_or_none()
        if user:
            user.avatar_url = avatar_url
            await db.flush()
            return user

        # 2. Lookup by email — link the Google account
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user:
            user.google_id = google_id
            user.avatar_url = avatar_url
            await db.flush()
            return user

        # 3. Create new user
        user = User(
            email=email,
            display_name=name,
            google_id=google_id,
            auth_provider="google",
            avatar_url=avatar_url,
            password_hash=None,
        )
        db.add(user)
        await db.flush()
        await db.refresh(user)

        await CategoryService.seed_defaults(db, owner_id=user.id)
        return user
