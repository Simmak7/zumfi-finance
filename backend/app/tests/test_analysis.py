"""Tests for the analysis feature: trends, anomalies, recurring, forecast."""

import pytest
from datetime import date
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession

from features.analysis.service import AnalysisService
from features.statements.models import Transaction
from features.auth.models import User


@pytest.mark.skip(reason="get_monthly_trends/detect_anomalies use PostgreSQL-only to_char()")
async def test_empty_data_returns_empty(db_session, test_user):
    trends = await AnalysisService.get_monthly_trends(db_session, test_user.id)
    assert trends == []

    anomalies = await AnalysisService.detect_anomalies(db_session, test_user.id)
    assert anomalies == []

    recurring = await AnalysisService.detect_recurring(db_session, test_user.id)
    assert recurring == []


async def test_predict_spending_empty(db_session, test_user):
    result = await AnalysisService.predict_spending(db_session, test_user.id)
    assert result["predicted_total_expenses"] == 0
    assert result["based_on_months"] == []


async def test_detect_recurring(db_session, test_user):
    """Same description, similar amount, across 3 months => recurring."""
    for month_num in [10, 11, 12]:
        tx = Transaction(
            owner_id=test_user.id,
            date=date(2025, month_num, 15),
            description="Netflix subscription",
            original_description="Netflix subscription",
            amount=Decimal("299.00"),
            type="expense",
            section="expense",
            category_name="Entertainment",
            status="classified",
        )
        db_session.add(tx)
    await db_session.flush()

    recurring = await AnalysisService.detect_recurring(db_session, test_user.id)
    assert len(recurring) >= 1
    names = [r["name"] for r in recurring]
    assert "Netflix subscription" in names
    assert recurring[0]["average_amount"] == 299.0


@pytest.mark.skip(reason="detect_anomalies uses PostgreSQL-only to_char()")
async def test_detect_anomalies(db_session, test_user):
    """One very high transaction among many small ones => anomaly."""
    # Add many small transactions
    for i in range(10):
        tx = Transaction(
            owner_id=test_user.id,
            date=date(2026, 1, i + 1),
            description=f"Grocery trip {i}",
            original_description=f"Grocery trip {i}",
            amount=Decimal("500.00"),
            type="expense",
            section="expense",
            category_name="Groceries",
            status="classified",
        )
        db_session.add(tx)

    # Add one anomaly
    anomaly_tx = Transaction(
        owner_id=test_user.id,
        date=date(2026, 1, 20),
        description="Grocery trip huge",
        original_description="Grocery trip huge",
        amount=Decimal("5000.00"),
        type="expense",
        section="expense",
        category_name="Groceries",
        status="classified",
    )
    db_session.add(anomaly_tx)
    await db_session.flush()

    anomalies = await AnalysisService.detect_anomalies(db_session, test_user.id)
    assert len(anomalies) >= 1
    amounts = [a["amount"] for a in anomalies]
    assert 5000.0 in amounts


async def test_predict_spending_with_data(db_session, test_user):
    """Forecast averages last 3 months of expense data."""
    for month_num, amount in [(10, "3000"), (11, "4000"), (12, "5000")]:
        tx = Transaction(
            owner_id=test_user.id,
            date=date(2025, month_num, 15),
            description=f"Expense {month_num}",
            original_description=f"Expense {month_num}",
            amount=Decimal(amount),
            type="expense",
            section="expense",
            category_name="General",
            status="classified",
        )
        db_session.add(tx)
    await db_session.flush()

    result = await AnalysisService.predict_spending(db_session, test_user.id)
    assert result["predicted_total_expenses"] == 4000.0  # (3000+4000+5000)/3
    assert len(result["based_on_months"]) == 3


async def test_top_categories(db_session, test_user, sample_transactions):
    top = await AnalysisService.get_top_categories(
        db_session, test_user.id, "2026-01"
    )
    assert len(top) == 2  # Groceries + Transport (income excluded)
    assert top[0]["category"] == "Groceries"  # 1500 > 250
    assert top[0]["amount"] == 1500.0
