from pydantic import model_validator
from pydantic_settings import BaseSettings
from functools import lru_cache


_DEV_SECRET_KEYS = {"dev-secret-key-change-in-production", "change-this-to-a-random-secret-key-in-production"}


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Environment
    ENVIRONMENT: str = "development"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://finance:password@db:5432/finance_app"

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    # Ollama
    OLLAMA_HOST: str = "http://ollama:11434"

    # JWT Auth
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ALGORITHM: str = "HS256"

    # CORS
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173"

    # Google OAuth (empty = disabled)
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:3001/auth/google/callback"

    # Stripe donations (empty = disabled)
    STRIPE_SECRET_KEY: str = ""
    STRIPE_PUBLISHABLE_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""

    # Feedback email (SMTP via Gmail app password)
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    FEEDBACK_EMAIL: str = ""

    @property
    def smtp_host(self) -> str:
        return self.SMTP_HOST

    @property
    def smtp_port(self) -> int:
        return self.SMTP_PORT

    @property
    def smtp_user(self) -> str:
        return self.SMTP_USER

    @property
    def smtp_password(self) -> str:
        return self.SMTP_PASSWORD

    @property
    def feedback_email(self) -> str:
        return self.FEEDBACK_EMAIL

    @model_validator(mode="after")
    def validate_production_secrets(self):
        if self.ENVIRONMENT == "production":
            if self.SECRET_KEY in _DEV_SECRET_KEYS or len(self.SECRET_KEY) < 32:
                raise ValueError(
                    "SECRET_KEY must be changed from the default and be at least 32 characters in production"
                )
        if self.GOOGLE_CLIENT_ID and not self.GOOGLE_CLIENT_SECRET:
            raise ValueError("GOOGLE_CLIENT_SECRET is required when GOOGLE_CLIENT_ID is set")
        return self

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    @property
    def google_oauth_enabled(self) -> bool:
        return bool(self.GOOGLE_CLIENT_ID and self.GOOGLE_CLIENT_SECRET)

    class Config:
        env_file = ".env"
        extra = "allow"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
