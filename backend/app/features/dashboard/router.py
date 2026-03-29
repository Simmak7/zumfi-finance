from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.auth import get_current_user
from features.auth.models import User
from features.dashboard.service import DashboardService

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/last-data-month")
async def get_last_data_month(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return the latest YYYY-MM that has transaction data, or null."""
    month = await DashboardService.get_last_data_month(db, owner_id=user.id)
    return {"month": month}


@router.get("/summary")
async def get_dashboard_summary(
    month: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get aggregated dashboard data for a month."""
    return await DashboardService.get_summary(db, owner_id=user.id, month=month)


@router.get("/month-close")
async def get_month_close_data(
    month: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get aggregated data for end-of-month close wizard."""
    return await DashboardService.get_month_close_data(db, owner_id=user.id, month=month)


@router.get("/monthly-history")
async def get_monthly_history(
    months: int = Query(default=6, ge=2, le=24),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get income/expense totals per month for the last N months."""
    return await DashboardService.get_monthly_history(db, owner_id=user.id, months=months)


@router.get("/category-trends")
async def get_category_trends(
    month: str = Query(None, pattern=r"^\d{4}-\d{2}$"),
    months: int = Query(default=12, ge=2, le=24),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get monthly expense totals per category for the last N months."""
    return await DashboardService.get_category_trends(
        db, owner_id=user.id, month=month, months=months
    )
