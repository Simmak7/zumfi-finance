"""Tests for the categories feature: CRUD, classification, seed defaults, learning."""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from features.categories.service import CategoryService
from features.categories.models import Category, CategoryMapping
from features.auth.models import User


async def test_create_category(db_session: AsyncSession, test_user: User):
    cat = await CategoryService.create(
        db_session, owner_id=test_user.id, name="Rent", section="general"
    )
    assert cat.id is not None
    assert cat.name == "Rent"
    assert cat.section == "general"
    assert cat.owner_id == test_user.id


async def test_get_all_owner_filter(
    db_session: AsyncSession, test_user: User, second_user: User
):
    """Each user only sees their own categories."""
    await CategoryService.create(db_session, test_user.id, "Food", "general")
    await CategoryService.create(db_session, second_user.id, "Rent", "general")

    user1_cats = await CategoryService.get_all(db_session, test_user.id)
    user2_cats = await CategoryService.get_all(db_session, second_user.id)

    assert len(user1_cats) == 1
    assert user1_cats[0].name == "Food"
    assert len(user2_cats) == 1
    assert user2_cats[0].name == "Rent"


async def test_seed_defaults(db_session: AsyncSession, test_user: User):
    await CategoryService.seed_defaults(db_session, test_user.id)
    cats = await CategoryService.get_all(db_session, test_user.id)
    assert len(cats) > 0
    names = {c.name for c in cats}
    assert "Groceries" in names
    assert "Transport" in names
    assert "Maks" in names  # income category


async def test_classify_substring_match(db_session: AsyncSession, test_user: User):
    cat = await CategoryService.create(db_session, test_user.id, "Groceries", "general")
    await CategoryService.add_mapping(db_session, test_user.id, cat.id, "tesco")

    section, name, confidence, cat_id = await CategoryService.classify(
        db_session, test_user.id, "Payment at TESCO store"
    )
    assert section == "general"
    assert name == "Groceries"
    assert confidence == 0.9


async def test_classify_regex_match(db_session: AsyncSession, test_user: User):
    cat = await CategoryService.create(db_session, test_user.id, "Salary", "general")
    await CategoryService.add_mapping(
        db_session, test_user.id, cat.id, r"salary.*2026", match_type="regex"
    )

    section, name, confidence, cat_id = await CategoryService.classify(
        db_session, test_user.id, "Salary payment Jan 2026"
    )
    assert section == "general"
    assert name == "Salary"
    assert confidence == 1.0


async def test_classify_unknown(db_session: AsyncSession, test_user: User):
    section, name, confidence, cat_id = await CategoryService.classify(
        db_session, test_user.id, "xyzzy random unknown"
    )
    assert section == "unknown"
    assert name == "Unknown"
    assert confidence == 0.0


async def test_add_mapping(db_session: AsyncSession, test_user: User, test_categories):
    groceries = test_categories[0]
    mapping = await CategoryService.add_mapping(
        db_session, test_user.id, groceries.id, "albert"
    )
    assert mapping.keyword == "albert"
    assert mapping.category_id == groceries.id


async def test_learn_from_confirmation(db_session: AsyncSession, test_user: User):
    cat = await CategoryService.create(db_session, test_user.id, "Groceries", "general")
    count = await CategoryService.learn_from_confirmation(
        db_session, test_user.id,
        description="Payment at Rohlik.cz online store",
        category_name="Groceries",
    )
    assert count > 0  # Should create mappings for "rohlik.cz", "online", "store"

    mappings = await CategoryService.get_mappings(db_session, test_user.id)
    keywords = {m.keyword for m in mappings}
    assert "rohlik.cz" in keywords


async def test_learn_skips_stop_words(db_session: AsyncSession, test_user: User):
    cat = await CategoryService.create(db_session, test_user.id, "Bills", "general")
    count = await CategoryService.learn_from_confirmation(
        db_session, test_user.id,
        description="Card payment for the transfer",
        category_name="Bills",
    )
    # "card", "payment", "for", "the", "transfer" are all stop words
    assert count == 0
