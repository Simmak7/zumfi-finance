from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth import get_current_user
from core.database import get_db
from features.auth.models import User
from features.budgets.schemas import (
    BudgetCreate, BudgetUpdate, BudgetResponse,
    BudgetSummaryResponse, BudgetSuggestionItem,
    SmartSuggestionResponse,
)
from features.budgets.service import BudgetService

router = APIRouter(prefix="/budgets", tags=["budgets"])


@router.get("/", response_model=list[BudgetResponse])
async def list_budgets(
    month: str = Query(..., description="Month in YYYY-MM format"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await BudgetService.get_by_month(db, owner_id=user.id, month=month)


@router.post("/", response_model=BudgetResponse)
async def create_or_update_budget(
    body: BudgetCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await BudgetService.create_or_update(
        db,
        owner_id=user.id,
        category_id=body.category_id,
        month=body.month,
        planned_amount=body.planned_amount,
    )


@router.delete("/{budget_id}")
async def delete_budget(
    budget_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await BudgetService.delete(db, owner_id=user.id, budget_id=budget_id)
    return {"message": "Budget deleted"}


@router.delete("/category/{category_id}")
async def delete_budget_by_category(
    category_id: int,
    month: str = Query(..., description="Month in YYYY-MM format"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await BudgetService.delete_by_category(
        db, owner_id=user.id, category_id=category_id, month=month
    )
    return {"message": "Budget removed from this month forward"}


@router.get("/summary", response_model=BudgetSummaryResponse)
async def get_budget_summary(
    month: str = Query(..., description="Month in YYYY-MM format"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await BudgetService.get_summary(db, owner_id=user.id, month=month)


@router.post("/copy-previous", response_model=list[BudgetResponse])
async def copy_previous_month(
    month: str = Query(..., description="Target month in YYYY-MM format"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await BudgetService.copy_from_previous(
        db, owner_id=user.id, month=month
    )


@router.get("/smart-suggestions", response_model=SmartSuggestionResponse)
async def get_smart_suggestions(
    months: int = Query(6, ge=3, le=12, description="Months to analyze"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await BudgetService.smart_suggest(
        db, owner_id=user.id, months=months
    )


@router.get("/suggestions", response_model=list[BudgetSuggestionItem])
async def get_budget_suggestions(
    months: int = Query(3, ge=1, le=12, description="Months to average"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await BudgetService.suggest_from_average(
        db, owner_id=user.id, months=months
    )
