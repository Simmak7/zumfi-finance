"""Pydantic schemas for user settings endpoints."""

from pydantic import BaseModel, Field, field_validator
from core.currencies import ALL_CURRENCY_CODES

VALID_CURRENCIES = ALL_CURRENCY_CODES
VALID_LANGUAGES = ["en", "cs", "uk"]

# Canonical page keys matching front-end route identifiers
VALID_PAGE_KEYS = [
    "dashboard",
    "transactions",
    "budget",
    "portfolio",
    "bills",
    "import",
    "help",
]

# Pages that cannot be hidden
NON_HIDEABLE_PAGES = {"dashboard"}

DEFAULT_PAGE_ORDER = list(VALID_PAGE_KEYS)


class UserSettingsUpdate(BaseModel):
    """Schema for updating user settings. All fields optional for partial updates."""
    preferred_currency: str | None = Field(None, pattern="^[A-Z]{3}$")
    page_order: list[str] | None = None
    hidden_pages: list[str] | None = None
    show_zumfi_rabbit: bool | None = None
    language: str | None = None
    category_trend_order: list[str] | None = None

    @field_validator("language")
    @classmethod
    def validate_language(cls, v):
        if v is None:
            return v
        if v not in VALID_LANGUAGES:
            raise ValueError(f"Invalid language: {v}. Must be one of {VALID_LANGUAGES}")
        return v

    @field_validator("page_order")
    @classmethod
    def validate_page_order(cls, v):
        if v is None:
            return v
        if set(v) != set(VALID_PAGE_KEYS):
            raise ValueError(
                f"page_order must contain exactly these keys: {VALID_PAGE_KEYS}"
            )
        if len(v) != len(VALID_PAGE_KEYS):
            raise ValueError("page_order must not contain duplicates")
        return v

    @field_validator("hidden_pages")
    @classmethod
    def validate_hidden_pages(cls, v):
        if v is None:
            return v
        for page in v:
            if page not in VALID_PAGE_KEYS:
                raise ValueError(f"Invalid page key: {page}")
            if page in NON_HIDEABLE_PAGES:
                raise ValueError(f"Cannot hide page: {page}")
        return list(set(v))


class UserSettingsResponse(BaseModel):
    """Schema for user settings response."""
    user_id: int
    email: str
    display_name: str | None
    preferred_currency: str
    page_order: list[str]
    hidden_pages: list[str]
    show_zumfi_rabbit: bool
    language: str
    category_trend_order: list[str]
