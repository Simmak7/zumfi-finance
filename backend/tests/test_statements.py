"""Tests for the statements feature: transactions CRUD, search, bulk update, pagination."""

import pytest
from datetime import date
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession

from features.statements.service import StatementService
from features.statements.models import Transaction
from features.auth.models import User


async def test_get_transactions(db_session, test_user, sample_transactions):
    txs = await StatementService.get_transactions(db_session, test_user.id)
    assert len(txs) == 3


async def test_get_transactions_with_status_filter(
    db_session, test_user, sample_transactions
):
    txs = await StatementService.get_transactions(
        db_session, test_user.id, status_filter="classified"
    )
    assert len(txs) == 3

    txs_review = await StatementService.get_transactions(
        db_session, test_user.id, status_filter="review"
    )
    assert len(txs_review) == 0


async def test_search_by_text(db_session, test_user, sample_transactions):
    results, total = await StatementService.search_transactions(
        db_session, test_user.id, q="Tesco"
    )
    assert total == 1
    assert results[0].description == "Tesco purchase"


async def test_search_by_amount_range(db_session, test_user, sample_transactions):
    results, total = await StatementService.search_transactions(
        db_session, test_user.id, min_amount=Decimal("200"), max_amount=Decimal("300")
    )
    assert total == 1
    assert results[0].description == "Bolt ride"


async def test_search_by_date_range(db_session, test_user, sample_transactions):
    results, total = await StatementService.search_transactions(
        db_session, test_user.id,
        start_date=date(2026, 1, 10),
        end_date=date(2026, 1, 18),
    )
    assert total == 1
    assert results[0].description == "Tesco purchase"


async def test_search_by_type(db_session, test_user, sample_transactions):
    results, total = await StatementService.search_transactions(
        db_session, test_user.id, type_filter="income"
    )
    assert total == 1
    assert results[0].description == "Monthly salary"


async def test_search_by_category(db_session, test_user, sample_transactions):
    results, total = await StatementService.search_transactions(
        db_session, test_user.id, category_names=["Transport"]
    )
    assert total == 1
    assert results[0].category_name == "Transport"


async def test_search_pagination(db_session, test_user, sample_transactions):
    results, total = await StatementService.search_transactions(
        db_session, test_user.id, limit=2, offset=0
    )
    assert total == 3
    assert len(results) == 2

    results2, total2 = await StatementService.search_transactions(
        db_session, test_user.id, limit=2, offset=2
    )
    assert total2 == 3
    assert len(results2) == 1


async def test_bulk_update_transactions(db_session, test_user, sample_transactions):
    tx_ids = [t.id for t in sample_transactions[:2]]
    count = await StatementService.bulk_update_transactions(
        db_session, test_user.id, tx_ids,
        category_name="Reclassified", status="confirmed"
    )
    assert count == 2

    # Verify updates persisted
    txs = await StatementService.get_transactions(db_session, test_user.id)
    updated = [t for t in txs if t.id in tx_ids]
    for t in updated:
        assert t.category_name == "Reclassified"
        assert t.status == "confirmed"


async def test_update_single_transaction(db_session, test_user, sample_transactions):
    tx = sample_transactions[0]
    updated = await StatementService.update_transaction(
        db_session, test_user.id, tx.id,
        category_name="New Category", status="confirmed"
    )
    assert updated is not None
    assert updated.category_name == "New Category"
    assert updated.status == "confirmed"


async def test_update_nonexistent_returns_none(db_session, test_user):
    result = await StatementService.update_transaction(
        db_session, test_user.id, 99999, category_name="Ghost"
    )
    assert result is None


async def test_owner_isolation(db_session, test_user, second_user, sample_transactions):
    """Second user cannot see first user's transactions."""
    txs = await StatementService.get_transactions(db_session, second_user.id)
    assert len(txs) == 0

    results, total = await StatementService.search_transactions(
        db_session, second_user.id
    )
    assert total == 0


async def test_categorize_similar(db_session, test_user):
    """Categorize all transactions with matching description."""
    for i in range(3):
        tx = Transaction(
            owner_id=test_user.id,
            date=date(2026, 1, i + 1),
            description="Bolt ride",
            original_description="Bolt ride",
            amount=Decimal("200.00"),
            type="expense",
            section="unknown",
            category_name="Unknown",
            status="review",
        )
        db_session.add(tx)
    await db_session.flush()

    count = await StatementService.categorize_similar(
        db_session, test_user.id,
        description="Bolt ride",
        category_name="Transport",
    )
    assert count == 3
