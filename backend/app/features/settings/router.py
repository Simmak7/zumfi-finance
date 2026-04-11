"""API endpoints for user settings management."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from core.auth import get_current_user
from features.auth.models import User
from .service import SettingsService
from .schemas import UserSettingsUpdate, UserSettingsResponse

router = APIRouter()


def _build_response(user, page_order, hidden_pages, category_trend_order):
    return UserSettingsResponse(
        user_id=user.id,
        email=user.email,
        display_name=user.display_name,
        preferred_currency=user.preferred_currency or "CZK",
        page_order=page_order,
        hidden_pages=hidden_pages,
        show_zumfi_rabbit=user.show_zumfi_rabbit if user.show_zumfi_rabbit is not None else True,
        language=user.language or "en",
        category_trend_order=category_trend_order,
    )


@router.get("", response_model=UserSettingsResponse)
async def get_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current user's settings."""
    data = await SettingsService.get_settings(db, current_user.id)
    return _build_response(data["user"], data["page_order"], data["hidden_pages"], data["category_trend_order"])


@router.put("", response_model=UserSettingsResponse)
async def update_settings(
    data: UserSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update current user's settings (partial update)."""
    try:
        result = await SettingsService.update_settings(
            db,
            current_user.id,
            preferred_currency=data.preferred_currency,
            page_order=data.page_order,
            hidden_pages=data.hidden_pages,
            show_zumfi_rabbit=data.show_zumfi_rabbit,
            language=data.language,
            category_trend_order=data.category_trend_order,
        )
        return _build_response(result["user"], result["page_order"], result["hidden_pages"], result["category_trend_order"])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
