"""TOTP two-factor authentication service."""
import base64
import hashlib
import io
import json
import secrets

import pyotp
import qrcode
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from features.auth.models import User

APP_NAME = "Zumfi Finance"


class TOTPService:
    @staticmethod
    def generate_secret() -> str:
        return pyotp.random_base32()

    @staticmethod
    def get_provisioning_uri(secret: str, email: str) -> str:
        totp = pyotp.TOTP(secret)
        return totp.provisioning_uri(name=email, issuer_name=APP_NAME)

    @staticmethod
    def verify_code(secret: str, code: str) -> bool:
        totp = pyotp.TOTP(secret)
        return totp.verify(code, valid_window=1)

    @staticmethod
    def generate_qr_base64(provisioning_uri: str) -> str:
        qr = qrcode.make(provisioning_uri)
        buffer = io.BytesIO()
        qr.save(buffer, format="PNG")
        return base64.b64encode(buffer.getvalue()).decode()

    @staticmethod
    def generate_recovery_codes(count: int = 8) -> list[str]:
        return [secrets.token_hex(8) for _ in range(count)]

    @staticmethod
    def hash_recovery_codes(codes: list[str]) -> str:
        hashed = [hashlib.sha256(c.encode()).hexdigest() for c in codes]
        return json.dumps(hashed)

    @staticmethod
    def verify_recovery_code(code: str, hashed_codes_json: str) -> tuple[bool, str]:
        """Verify a recovery code. Returns (valid, updated_json_with_code_removed)."""
        code_hash = hashlib.sha256(code.encode()).hexdigest()
        hashed_codes = json.loads(hashed_codes_json)

        if code_hash in hashed_codes:
            hashed_codes.remove(code_hash)
            return True, json.dumps(hashed_codes)

        return False, hashed_codes_json

    @staticmethod
    async def setup_2fa(db: AsyncSession, user_id: int) -> dict:
        """Generate TOTP secret and QR code for setup (not yet enabled)."""
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        if user.totp_enabled:
            raise HTTPException(status_code=400, detail="2FA is already enabled")

        secret = TOTPService.generate_secret()
        provisioning_uri = TOTPService.get_provisioning_uri(secret, user.email)
        qr_base64 = TOTPService.generate_qr_base64(provisioning_uri)

        # Store secret temporarily (not yet enabled)
        user.totp_secret = secret
        await db.flush()

        return {
            "secret": secret,
            "provisioning_uri": provisioning_uri,
            "qr_code_base64": qr_base64,
        }

    @staticmethod
    async def confirm_2fa(db: AsyncSession, user_id: int, code: str) -> list[str]:
        """Verify initial TOTP code, enable 2FA, generate recovery codes."""
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        if user.totp_enabled:
            raise HTTPException(status_code=400, detail="2FA is already enabled")

        if not user.totp_secret:
            raise HTTPException(status_code=400, detail="Please initiate 2FA setup first")

        if not TOTPService.verify_code(user.totp_secret, code):
            raise HTTPException(status_code=400, detail="Invalid verification code")

        # Enable 2FA and generate recovery codes
        recovery_codes = TOTPService.generate_recovery_codes()
        user.totp_enabled = True
        user.recovery_codes = TOTPService.hash_recovery_codes(recovery_codes)
        await db.flush()

        return recovery_codes

    @staticmethod
    async def disable_2fa(db: AsyncSession, user_id: int, code: str) -> None:
        """Disable 2FA after verifying current TOTP code."""
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        if not user.totp_enabled:
            raise HTTPException(status_code=400, detail="2FA is not enabled")

        if not TOTPService.verify_code(user.totp_secret, code):
            raise HTTPException(status_code=400, detail="Invalid verification code")

        user.totp_enabled = False
        user.totp_secret = None
        user.recovery_codes = None
        await db.flush()
