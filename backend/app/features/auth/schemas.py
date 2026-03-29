from datetime import datetime
from pydantic import BaseModel, field_validator

from core.security import validate_password_strength


class RegisterRequest(BaseModel):
    email: str
    password: str
    display_name: str | None = None

    @field_validator("password")
    @classmethod
    def password_strong_enough(cls, v):
        validate_password_strength(v)
        return v


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    expires_in: int
    token_type: str = "bearer"


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def new_password_strong_enough(cls, v):
        validate_password_strength(v)
        return v


# Google OAuth
class GoogleCallbackRequest(BaseModel):
    code: str


# 2FA / TOTP
class TwoFactorVerifyRequest(BaseModel):
    two_factor_token: str
    totp_code: str


class TOTPConfirmRequest(BaseModel):
    code: str


class TOTPDisableRequest(BaseModel):
    code: str


class TOTPSetupResponse(BaseModel):
    secret: str
    provisioning_uri: str
    qr_code_base64: str


class TOTPConfirmResponse(BaseModel):
    recovery_codes: list[str]


# Forgot Password (via 2FA)
class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordVerifyRequest(BaseModel):
    reset_token: str
    totp_code: str


class ResetPasswordRequest(BaseModel):
    password_reset_token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def reset_password_strong_enough(cls, v):
        validate_password_strength(v)
        return v


class UserResponse(BaseModel):
    id: int
    email: str
    display_name: str | None
    auth_provider: str = "local"
    avatar_url: str | None = None
    totp_enabled: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}
