"""Business logic for user settings management."""

import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from features.auth.models import User
from .schemas import VALID_CURRENCIES, VALID_LANGUAGES, DEFAULT_PAGE_ORDER


class SettingsService:
    """Service class for user settings operations."""

    @staticmethod
    def _parse_json_list(raw, default):
        if raw is None:
            return list(default)
        try:
            return json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return list(default)

    @staticmethod
    async def get_settings(db: AsyncSession, user_id: int) -> dict:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one()
        return {
            "user": user,
            "page_order": SettingsService._parse_json_list(
                user.page_order, DEFAULT_PAGE_ORDER
            ),
            "hidden_pages": SettingsService._parse_json_list(
                user.hidden_pages, []
            ),
            "category_trend_order": SettingsService._parse_json_list(
                user.category_trend_order, []
            ),
        }

    @staticmethod
    async def update_settings(
        db: AsyncSession,
        user_id: int,
        preferred_currency: str | None = None,
        page_order: list[str] | None = None,
        hidden_pages: list[str] | None = None,
        show_zumfi_rabbit: bool | None = None,
        language: str | None = None,
        category_trend_order: list[str] | None = None,
    ) -> dict:
        values = {}

        if preferred_currency is not None:
            if preferred_currency not in VALID_CURRENCIES:
                raise ValueError(
                    f"Invalid currency code: {preferred_currency}. "
                    f"Must be a valid ISO 4217 currency code."
                )
            values["preferred_currency"] = preferred_currency

        if page_order is not None:
            values["page_order"] = json.dumps(page_order)

        if hidden_pages is not None:
            values["hidden_pages"] = json.dumps(hidden_pages)

        if show_zumfi_rabbit is not None:
            values["show_zumfi_rabbit"] = show_zumfi_rabbit

        if language is not None:
            if language not in VALID_LANGUAGES:
                raise ValueError(
                    f"Invalid language: {language}. "
                    f"Must be one of {VALID_LANGUAGES}."
                )
            values["language"] = language

        if category_trend_order is not None:
            values["category_trend_order"] = json.dumps(category_trend_order)

        if values:
            await db.execute(
                update(User).where(User.id == user_id).values(**values)
            )
            await db.commit()

        return await SettingsService.get_settings(db, user_id)
