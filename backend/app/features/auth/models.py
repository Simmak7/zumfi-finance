from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey
from core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=True)
    display_name = Column(String(100), nullable=True)
    preferred_currency = Column(String(3), default="CZK")
    page_order = Column(Text, nullable=True)
    hidden_pages = Column(Text, nullable=True)
    show_zumfi_rabbit = Column(Boolean, default=True, nullable=False)
    language = Column(String(5), default="en", nullable=False)
    category_trend_order = Column(Text, nullable=True)

    # Google OAuth
    google_id = Column(String(255), unique=True, nullable=True, index=True)
    auth_provider = Column(String(20), default="local")
    avatar_url = Column(String(500), nullable=True)

    # 2FA / TOTP
    totp_secret = Column(String(32), nullable=True)
    totp_enabled = Column(Boolean, default=False, nullable=False)
    recovery_codes = Column(Text, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String(255), nullable=False, unique=True, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    revoked = Column(Boolean, default=False, nullable=False)
