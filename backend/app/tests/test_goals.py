"""Tests for the goals feature: CRUD, surplus, allocation, auto-complete."""

import pytest
from decimal import Decimal
from datetime import date, datetime, timezone
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from features.goals.service import GoalService
from features.goals.models import Goal, GoalContribution
from features.auth.models import User


def _set_created_at_past(goal):
    """Set created_at to a date before any test month (2025-01-01).

    GoalService filters goals by created_at < month_cutoff, so goals created
    "now" won't match allocations for past months like 2026-01.
    """
    goal.created_at = datetime(2025, 1, 1, tzinfo=timezone.utc)


async def test_create_goal(db_session, test_user):
    goal = await GoalService.create(
        db_session, test_user.id,
        name="Emergency Fund",
        target_amount=Decimal("100000"),
    )
    assert goal.id is not None
    assert goal.name == "Emergency Fund"
    assert goal.target_amount == Decimal("100000")
    assert goal.current_amount == Decimal("0")
    assert goal.status == "active"


async def test_create_goal_with_initial_amount(db_session, test_user):
    goal = await GoalService.create(
        db_session, test_user.id,
        name="Vacation",
        target_amount=Decimal("50000"),
        current_amount=Decimal("10000"),
        color="#FF5733",
        deadline=date(2026, 12, 31),
    )
    assert goal.current_amount == Decimal("10000")
    assert goal.color == "#FF5733"
    assert goal.deadline == date(2026, 12, 31)


async def test_update_goal(db_session, test_user):
    goal = await GoalService.create(
        db_session, test_user.id, name="Car", target_amount=Decimal("300000")
    )
    updated = await GoalService.update(
        db_session, test_user.id, goal.id, name="New Car"
    )
    assert updated.name == "New Car"
    assert updated.target_amount == Decimal("300000")


async def test_delete_goal(db_session, test_user):
    goal = await GoalService.create(
        db_session, test_user.id, name="Temp", target_amount=Decimal("1000")
    )
    result = await GoalService.delete(db_session, test_user.id, goal.id)
    assert result is True

    goals = await GoalService.get_all(db_session, test_user.id)
    assert len(goals) == 0


async def test_delete_nonexistent_raises_404(db_session, test_user):
    with pytest.raises(HTTPException) as exc_info:
        await GoalService.delete(db_session, test_user.id, 99999)
    assert exc_info.value.status_code == 404


async def test_owner_isolation(db_session, test_user, second_user):
    goal = await GoalService.create(
        db_session, test_user.id, name="Private Goal", target_amount=Decimal("50000")
    )

    other_goals = await GoalService.get_all(db_session, second_user.id)
    assert len(other_goals) == 0

    with pytest.raises(HTTPException):
        await GoalService.delete(db_session, second_user.id, goal.id)


async def test_surplus_calculation(db_session, test_user, sample_transactions):
    """Income=50000, Expenses=1750, No allocations => surplus=48250."""
    surplus = await GoalService.get_surplus(db_session, test_user.id, "2026-01")
    assert surplus["total_income"] == Decimal("50000.00")
    assert surplus["total_expenses"] == Decimal("1750.00")
    assert surplus["already_allocated"] == Decimal("0")
    assert surplus["available_surplus"] == Decimal("48250.00")


async def test_surplus_empty_month(db_session, test_user):
    surplus = await GoalService.get_surplus(db_session, test_user.id, "2026-06")
    assert surplus["total_income"] == Decimal("0")
    assert surplus["total_expenses"] == Decimal("0")
    assert surplus["available_surplus"] == Decimal("0")


async def test_allocate_updates_goal(db_session, test_user, sample_transactions):
    goal = await GoalService.create(
        db_session, test_user.id, name="Savings", target_amount=Decimal("100000")
    )
    _set_created_at_past(goal)
    await db_session.flush()
    updated = await GoalService.allocate(
        db_session, test_user.id, "2026-01",
        [{"goal_id": goal.id, "amount": Decimal("5000")}],
    )
    assert len(updated) == 1
    assert updated[0].current_amount == Decimal("5000")
    assert updated[0].status == "active"


async def test_allocate_auto_completes(db_session, test_user, sample_transactions):
    """Goal auto-completes when current_amount reaches target_amount."""
    goal = await GoalService.create(
        db_session, test_user.id,
        name="Small Goal",
        target_amount=Decimal("1000"),
    )
    _set_created_at_past(goal)
    await db_session.flush()
    updated = await GoalService.allocate(
        db_session, test_user.id, "2026-01",
        [{"goal_id": goal.id, "amount": Decimal("1000")}],
    )
    assert updated[0].status == "completed"
    assert updated[0].current_amount == Decimal("1000")


async def test_allocate_exceeds_surplus_raises_400(db_session, test_user, sample_transactions):
    goal = await GoalService.create(
        db_session, test_user.id, name="Greedy", target_amount=Decimal("999999")
    )
    _set_created_at_past(goal)
    await db_session.flush()
    with pytest.raises(HTTPException) as exc_info:
        await GoalService.allocate(
            db_session, test_user.id, "2026-01",
            [{"goal_id": goal.id, "amount": Decimal("999999")}],
        )
    assert exc_info.value.status_code == 400


async def test_suggest_allocation_proportional(db_session, test_user, sample_transactions):
    """Suggestions should distribute surplus proportionally to remaining targets."""
    goal_a = await GoalService.create(
        db_session, test_user.id, name="Goal A",
        target_amount=Decimal("30000"), current_amount=Decimal("10000"),
    )
    goal_b = await GoalService.create(
        db_session, test_user.id, name="Goal B",
        target_amount=Decimal("20000"), current_amount=Decimal("0"),
    )
    _set_created_at_past(goal_a)
    _set_created_at_past(goal_b)
    await db_session.flush()

    suggestions = await GoalService.suggest_allocation(
        db_session, test_user.id, "2026-01"
    )
    assert len(suggestions) == 2
    total_suggested = sum(s["suggested_amount"] for s in suggestions)
    assert total_suggested > 0
