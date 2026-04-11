"""Tests for the budgets feature: CRUD, summary, owner isolation."""

import pytest
from datetime import date
from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from features.budgets.service import BudgetService
from features.auth.models import User


async def test_create_budget(db_session, test_user, test_categories):
    groceries = test_categories[0]
    budget = await BudgetService.create_or_update(
        db_session, test_user.id, groceries.id, "2026-01", Decimal("5000.00")
    )
    assert budget.id is not None
    assert budget.planned_amount == Decimal("5000.00")
    assert budget.month == "2026-01"


async def test_update_existing_budget(db_session, test_user, test_categories):
    groceries = test_categories[0]
    budget1 = await BudgetService.create_or_update(
        db_session, test_user.id, groceries.id, "2026-01", Decimal("5000.00")
    )
    budget2 = await BudgetService.create_or_update(
        db_session, test_user.id, groceries.id, "2026-01", Decimal("7000.00")
    )
    assert budget1.id == budget2.id  # Same record updated
    assert budget2.planned_amount == Decimal("7000.00")


async def test_get_by_month(db_session, test_user, test_categories):
    groceries, transport, _ = test_categories
    await BudgetService.create_or_update(
        db_session, test_user.id, groceries.id, "2026-01", Decimal("5000")
    )
    await BudgetService.create_or_update(
        db_session, test_user.id, transport.id, "2026-01", Decimal("2000")
    )
    await BudgetService.create_or_update(
        db_session, test_user.id, groceries.id, "2026-02", Decimal("4000")
    )

    jan = await BudgetService.get_by_month(db_session, test_user.id, "2026-01")
    assert len(jan) == 2

    # February: Groceries has explicit entry, Transport inherits from January
    feb = await BudgetService.get_by_month(db_session, test_user.id, "2026-02")
    assert len(feb) == 2


async def test_delete_budget(db_session, test_user, test_categories):
    groceries = test_categories[0]
    budget = await BudgetService.create_or_update(
        db_session, test_user.id, groceries.id, "2026-01", Decimal("5000")
    )
    result = await BudgetService.delete(db_session, test_user.id, budget.id)
    assert result is True

    remaining = await BudgetService.get_by_month(db_session, test_user.id, "2026-01")
    assert len(remaining) == 0


async def test_delete_nonexistent_raises_404(db_session, test_user):
    with pytest.raises(HTTPException) as exc_info:
        await BudgetService.delete(db_session, test_user.id, 99999)
    assert exc_info.value.status_code == 404


async def test_owner_isolation(db_session, test_user, second_user, test_categories):
    """User A cannot see or delete User B's budgets."""
    groceries = test_categories[0]
    budget = await BudgetService.create_or_update(
        db_session, test_user.id, groceries.id, "2026-01", Decimal("5000")
    )

    other_budgets = await BudgetService.get_by_month(db_session, second_user.id, "2026-01")
    assert len(other_budgets) == 0

    with pytest.raises(HTTPException) as exc_info:
        await BudgetService.delete(db_session, second_user.id, budget.id)
    assert exc_info.value.status_code == 404


async def test_summary_with_data(db_session, test_user, test_categories):
    from features.statements.models import Transaction

    groceries = test_categories[0]
    # Create a transaction with category_id set (summary groups by category_id)
    tx = Transaction(
        owner_id=test_user.id,
        date=date(2026, 1, 15),
        description="Tesco purchase",
        original_description="Tesco purchase",
        amount=Decimal("1500.00"),
        type="expense",
        category_id=groceries.id,
        category_name="Groceries",
        section="expense",
        status="classified",
    )
    db_session.add(tx)
    await db_session.flush()

    await BudgetService.create_or_update(
        db_session, test_user.id, groceries.id, "2026-01", Decimal("3000")
    )
    summary = await BudgetService.get_summary(db_session, test_user.id, "2026-01")

    assert summary["month"] == "2026-01"
    assert summary["total_planned"] == Decimal("3000")
    assert len(summary["categories"]) == 1
    cat_item = summary["categories"][0]
    assert cat_item["category_name"] == "Groceries"
    assert cat_item["actual_amount"] == Decimal("1500.00")
    assert cat_item["remaining"] == Decimal("1500.00")
