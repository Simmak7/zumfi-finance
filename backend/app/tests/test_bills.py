"""Tests for the bills feature: CRUD, owner isolation, status computation."""

import pytest
from datetime import date
from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from features.bills.service import BillService
from features.bills.models import RecurringBill
from features.auth.models import User
from features.categories.models import Category
from features.statements.models import Transaction


async def test_create_bill(db_session, test_user):
    bill = await BillService.create(db_session, test_user.id, {
        "name": "Netflix",
        "expected_amount": Decimal("299.00"),
        "frequency": "monthly",
        "due_day": 15,
    })
    assert bill.id is not None
    assert bill.name == "Netflix"
    assert bill.expected_amount == Decimal("299.00")
    assert bill.is_active is True


async def test_update_bill(db_session, test_user):
    bill = await BillService.create(db_session, test_user.id, {
        "name": "Netflix",
        "expected_amount": Decimal("299.00"),
        "frequency": "monthly",
    })
    updated = await BillService.update(db_session, test_user.id, bill.id, {
        "expected_amount": Decimal("349.00"),
    })
    assert updated.expected_amount == Decimal("349.00")
    assert updated.name == "Netflix"  # unchanged


async def test_delete_bill(db_session, test_user):
    bill = await BillService.create(db_session, test_user.id, {
        "name": "Spotify",
        "expected_amount": Decimal("169.00"),
        "frequency": "monthly",
    })
    result = await BillService.delete(db_session, test_user.id, bill.id)
    assert result is True

    remaining = await BillService.get_all(db_session, test_user.id)
    assert len(remaining) == 0


async def test_delete_nonexistent_raises_404(db_session, test_user):
    with pytest.raises(HTTPException):
        await BillService.delete(db_session, test_user.id, 99999)


async def test_owner_isolation(db_session, test_user, second_user):
    bill = await BillService.create(db_session, test_user.id, {
        "name": "Netflix",
        "expected_amount": Decimal("299.00"),
        "frequency": "monthly",
    })

    other_bills = await BillService.get_all(db_session, second_user.id)
    assert len(other_bills) == 0

    with pytest.raises(HTTPException):
        await BillService.update(db_session, second_user.id, bill.id, {"name": "Hacked"})

    with pytest.raises(HTTPException):
        await BillService.delete(db_session, second_user.id, bill.id)


async def test_get_all_active_only(db_session, test_user):
    await BillService.create(db_session, test_user.id, {
        "name": "Active Bill",
        "expected_amount": Decimal("100.00"),
        "frequency": "monthly",
    })
    inactive = await BillService.create(db_session, test_user.id, {
        "name": "Inactive Bill",
        "expected_amount": Decimal("200.00"),
        "frequency": "monthly",
        "is_active": False,
    })

    bills = await BillService.get_all(db_session, test_user.id)
    assert len(bills) == 1
    assert bills[0].name == "Active Bill"


async def test_status_paid_when_matching_transaction(
    db_session, test_user, sample_transactions
):
    """Bill named 'Tesco' should match the Tesco transaction in a fixed category."""
    # Create a fixed-section category and link the transaction to it
    fixed_cat = Category(owner_id=test_user.id, name="Fixed Bills", section="fixed")
    db_session.add(fixed_cat)
    await db_session.flush()
    await db_session.refresh(fixed_cat)

    # Update Tesco transaction to be in the fixed category
    tesco_tx = [t for t in sample_transactions if "Tesco" in t.description][0]
    tesco_tx.category_id = fixed_cat.id
    tesco_tx.section = "fixed"
    await db_session.flush()

    await BillService.create(db_session, test_user.id, {
        "name": "Tesco purchase",
        "expected_amount": Decimal("1500.00"),
        "frequency": "monthly",
        "due_day": 20,
        "category_id": fixed_cat.id,
    })

    statuses = await BillService.get_status_for_month(
        db_session, test_user.id, "2026-01"
    )
    assert len(statuses) == 1
    assert statuses[0]["status"] == "paid"
    assert statuses[0]["paid_amount"] == Decimal("1500.00")


async def test_status_pending_no_match(db_session, test_user, sample_transactions):
    """Bill with no matching transaction shows pending/overdue."""
    # Create a fixed-section category
    fixed_cat = Category(owner_id=test_user.id, name="Electricity", section="fixed")
    db_session.add(fixed_cat)
    await db_session.flush()
    await db_session.refresh(fixed_cat)

    await BillService.create(db_session, test_user.id, {
        "name": "Electricity",
        "expected_amount": Decimal("2000.00"),
        "frequency": "monthly",
        "due_day": 28,
        "category_id": fixed_cat.id,
    })

    statuses = await BillService.get_status_for_month(
        db_session, test_user.id, "2026-01"
    )
    assert len(statuses) == 1
    # Status depends on current date vs 2026-01, so just check it's not "paid"
    assert statuses[0]["status"] in ("pending", "overdue")
    assert statuses[0]["matched_transaction_id"] is None


# ── Missing bills detection tests ──


@pytest.fixture
async def fixed_category(db_session, test_user):
    """Create a fixed-section category."""
    cat = Category(owner_id=test_user.id, name="Electricity", section="fixed")
    db_session.add(cat)
    await db_session.flush()
    await db_session.refresh(cat)
    return cat


@pytest.fixture
async def fixed_category_2(db_session, test_user):
    """Create a second fixed-section category."""
    cat = Category(owner_id=test_user.id, name="Internet", section="fixed")
    db_session.add(cat)
    await db_session.flush()
    await db_session.refresh(cat)
    return cat


def _make_tx(owner_id, cat_id, desc, amount, tx_date):
    return Transaction(
        owner_id=owner_id,
        date=tx_date,
        description=desc,
        original_description=desc,
        amount=Decimal(str(amount)),
        type="expense",
        category_id=cat_id,
        category_name="Electricity",
        section="fixed",
        status="classified",
        confidence=Decimal("0.90"),
    )


async def test_missing_bills_detects_absent_transaction(
    db_session, test_user, fixed_category
):
    """A fixed transaction present in 3 prior months but absent in target month
    should appear in the missing list."""
    cat = fixed_category

    # Create transactions for Oct, Nov, Dec 2025
    for month in [10, 11, 12]:
        tx = _make_tx(test_user.id, cat.id, "CEZ Electricity", 2500, date(2025, month, 15))
        db_session.add(tx)
    await db_session.flush()

    # Check January 2026 — no transaction there
    result = await BillService.check_missing_bills(
        db_session, test_user.id, "2026-01"
    )
    assert result["all_paid"] is False
    assert len(result["missing"]) == 1
    assert result["missing"][0]["name"] == "CEZ Electricity"
    assert result["missing"][0]["typical_amount"] == Decimal("2500.00")
    assert result["missing"][0]["months_seen"] == 3


async def test_missing_bills_all_paid(
    db_session, test_user, fixed_category
):
    """When recurring transaction is present in target month, all_paid is True."""
    cat = fixed_category

    # Create transactions for Oct, Nov, Dec 2025 AND Jan 2026
    for month in [10, 11, 12]:
        tx = _make_tx(test_user.id, cat.id, "CEZ Electricity", 2500, date(2025, month, 15))
        db_session.add(tx)
    tx = _make_tx(test_user.id, cat.id, "CEZ Electricity", 2500, date(2026, 1, 15))
    db_session.add(tx)
    await db_session.flush()

    result = await BillService.check_missing_bills(
        db_session, test_user.id, "2026-01"
    )
    assert result["all_paid"] is True
    assert len(result["missing"]) == 0


async def test_missing_bills_ignores_sporadic_transaction(
    db_session, test_user, fixed_category
):
    """A transaction appearing in only 1 of the 3 prior months should NOT
    be flagged as missing."""
    cat = fixed_category

    # Only present in November
    tx = _make_tx(test_user.id, cat.id, "One-time repair", 5000, date(2025, 11, 10))
    db_session.add(tx)
    await db_session.flush()

    result = await BillService.check_missing_bills(
        db_session, test_user.id, "2026-01"
    )
    assert result["all_paid"] is True
    assert len(result["missing"]) == 0


async def test_missing_bills_multiple_bills(
    db_session, test_user, fixed_category, fixed_category_2
):
    """Multiple recurring fixed transactions: one missing, one present."""
    cat1 = fixed_category
    cat2 = fixed_category_2

    # Electricity in Oct, Nov, Dec — missing in Jan
    for month in [10, 11, 12]:
        db_session.add(_make_tx(test_user.id, cat1.id, "CEZ Electricity", 2500, date(2025, month, 15)))

    # Internet in Oct, Nov, Dec — present in Jan
    for month in [10, 11, 12]:
        db_session.add(_make_tx(test_user.id, cat2.id, "O2 Internet", 600, date(2025, month, 5)))
    db_session.add(_make_tx(test_user.id, cat2.id, "O2 Internet", 600, date(2026, 1, 5)))

    await db_session.flush()

    result = await BillService.check_missing_bills(
        db_session, test_user.id, "2026-01"
    )
    assert result["all_paid"] is False
    assert len(result["missing"]) == 1
    assert result["missing"][0]["name"] == "CEZ Electricity"


async def test_missing_bills_no_fixed_categories(
    db_session, test_user
):
    """When user has no fixed categories, should return all_paid True."""
    result = await BillService.check_missing_bills(
        db_session, test_user.id, "2026-01"
    )
    assert result["all_paid"] is True
    assert len(result["missing"]) == 0


async def test_missing_bills_no_prior_transactions(
    db_session, test_user, fixed_category
):
    """When there are no transactions in prior months, should return all_paid True."""
    result = await BillService.check_missing_bills(
        db_session, test_user.id, "2026-01"
    )
    assert result["all_paid"] is True
    assert len(result["missing"]) == 0
