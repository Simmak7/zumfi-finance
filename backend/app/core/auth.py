import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import get_settings
from core.database import get_db
from core.redis_client import redis_client

settings = get_settings()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


# --------------- Access Tokens ---------------

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token with a unique JTI for revocation support."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "jti": uuid.uuid4().hex})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


async def blacklist_token(jti: str, ttl_seconds: int) -> None:
    """Add a token JTI to the Redis blacklist with TTL."""
    await redis_client.setex(f"blacklist:{jti}", ttl_seconds, "1")


async def is_token_blacklisted(jti: str) -> bool:
    """Check if a token JTI is blacklisted."""
    return await redis_client.exists(f"blacklist:{jti}") > 0


# --------------- Refresh Tokens ---------------

def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def create_refresh_token(user_id: int, db: AsyncSession) -> str:
    """Generate a cryptographically random refresh token, store its hash in DB."""
    from features.auth.models import RefreshToken

    raw_token = secrets.token_urlsafe(64)
    token_hash = _hash_token(raw_token)
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    refresh = RefreshToken(
        user_id=user_id,
        token_hash=token_hash,
        expires_at=expires_at,
    )
    db.add(refresh)
    await db.flush()

    return raw_token


async def verify_refresh_token(token: str, db: AsyncSession):
    """Verify a refresh token and return the associated user. Raises HTTPException on failure."""
    from features.auth.models import RefreshToken, User

    token_hash = _hash_token(token)
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked == False,
        )
    )
    refresh = result.scalar_one_or_none()

    if not refresh:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    if refresh.expires_at < datetime.now(timezone.utc):
        refresh.revoked = True
        await db.flush()
        raise HTTPException(status_code=401, detail="Refresh token expired")

    user_result = await db.execute(select(User).where(User.id == refresh.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user, refresh


async def revoke_refresh_token(token: str, db: AsyncSession) -> None:
    """Revoke a single refresh token by its raw value."""
    from features.auth.models import RefreshToken

    token_hash = _hash_token(token)
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.token_hash == token_hash)
        .values(revoked=True)
    )
    await db.flush()


async def revoke_all_user_tokens(user_id: int, db: AsyncSession) -> None:
    """Revoke all refresh tokens for a user."""
    from features.auth.models import RefreshToken

    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked == False)
        .values(revoked=True)
    )
    await db.flush()


# --------------- Current User Dependency ---------------

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Dependency: extract user from JWT token, check blacklist."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        sub: str = payload.get("sub")
        jti: str = payload.get("jti")
        if sub is None:
            raise credentials_exception
        user_id = int(sub)
    except (JWTError, ValueError):
        raise credentials_exception

    # Check if token has been blacklisted (logout)
    if jti and await is_token_blacklisted(jti):
        raise credentials_exception

    from features.auth.models import User

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception

    return user
