"""Tests for the dashboard feature: summary, expense breakdown, goals."""

import pytest
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession

from features.dashboard.service import DashboardService
from features.goals.service import GoalService
from features.auth.models import User


async def test_empty_summary(db_session, test_user):
    """Dashboard with no data returns zeroes."""
    summary = await DashboardService.get_summary(
        db_session, test_user.id, "2026-01"
    )
    assert summary["month"] == "2026-01"
    assert summary["total_income"] == 0
    assert summary["total_expenses"] == 0
    assert summary["remaining_budget"] == 0
    assert summary["savings_rate"] == 0
    assert summary["expense_breakdown"] == []
    assert summary["goals"] == []


async def test_summary_with_transactions(
    db_session, test_user, sample_transactions
):
    """Dashboard reflects income/expense totals from sample data."""
    summary = await DashboardService.get_summary(
        db_session, test_user.id, "2026-01"
    )
    assert summary["total_income"] == 50000.0
    assert summary["total_expenses"] == 1750.0
    assert summary["remaining_budget"] == 48250.0
    assert summary["savings_rate"] > 0


async def test_expense_breakdown(db_session, test_user, sample_transactions):
    summary = await DashboardService.get_summary(
        db_session, test_user.id, "2026-01"
    )
    breakdown = summary["expense_breakdown"]
    assert len(breakdown) == 2  # Groceries + Transport
    names = {item["category"] for item in breakdown}
    assert "Groceries" in names
    assert "Transport" in names


async def test_income_breakdown(db_session, test_user, sample_transactions):
    summary = await DashboardService.get_summary(
        db_session, test_user.id, "2026-01"
    )
    income = summary["income_breakdown"]
    assert len(income) == 1
    assert income[0]["category"] == "Salary"
    assert income[0]["amount"] == 50000.0


async def test_goals_in_summary(db_session, test_user, sample_transactions):
    await GoalService.create(
        db_session, test_user.id,
        name="Vacation", target_amount=Decimal("50000"),
        current_amount=Decimal("10000"), color="#3498db",
    )

    summary = await DashboardService.get_summary(
        db_session, test_user.id, "2026-01"
    )
    assert len(summary["goals"]) == 1
    goal = summary["goals"][0]
    assert goal["name"] == "Vacation"
    assert goal["progress"] == 20.0  # 10000/50000 * 100


async def test_review_count(db_session, test_user, sample_transactions):
    """All sample transactions are 'classified', so review_count should be 0."""
    summary = await DashboardService.get_summary(
        db_session, test_user.id, "2026-01"
    )
    assert summary["review_count"] == 0


@pytest.mark.skip(reason="get_monthly_history uses PostgreSQL-only func.to_char()")
async def test_monthly_history(db_session, test_user, sample_transactions):
    history = await DashboardService.get_monthly_history(
        db_session, test_user.id, months=6
    )
    assert isinstance(history, list)
