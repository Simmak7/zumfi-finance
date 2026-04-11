"""Shared test fixtures for the Finance APP backend test suite.

Uses in-memory SQLite via aiosqlite so tests run without Docker/PostgreSQL.
Each test function gets a fresh database (function-scoped fixtures).
"""

import os
import sys
from datetime import date
from decimal import Decimal
from types import ModuleType

import pytest
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

# Override settings BEFORE any app code imports them
os.environ["DATABASE_URL"] = "sqlite+aiosqlite://"
os.environ["SECRET_KEY"] = "test-secret-key"
os.environ["REDIS_URL"] = "redis://localhost:6379/0"

# Clear cached settings so our env vars take effect
from core.config import get_settings
get_settings.cache_clear()

# Build a replacement database module that uses SQLite-compatible engine
_sqlite_engine = create_async_engine("sqlite+aiosqlite://", echo=False)
_sqlite_session_factory = async_sessionmaker(
    _sqlite_engine, class_=AsyncSession, expire_on_commit=False
)


class Base(DeclarativeBase):
    pass


async def get_db():
    """Dependency that yields an async database session."""
    async with _sqlite_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Create all tables."""
    async with _sqlite_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


# Inject our replacement module BEFORE database.py would be imported
_db_module = ModuleType("core.database")
_db_module.engine = _sqlite_engine
_db_module.async_session_factory = _sqlite_session_factory
_db_module.Base = Base
_db_module.get_db = get_db
_db_module.init_db = init_db
sys.modules["core.database"] = _db_module

# Now safe to import app code — it will get our patched database module
from core.auth import create_access_token
from core.security import hash_password
from features.auth.models import User
from features.accounts.models import Account
from features.categories.models import Category, CategoryMapping
from features.statements.models import Statement, Transaction
from features.budgets.models import Budget
from features.bills.models import RecurringBill
from features.goals.models import Goal, GoalContribution
from features.portfolio.models import SavingsAccount, Investment, PortfolioSnapshot


@pytest.fixture
async def db_engine():
    """Create a fresh in-memory SQLite engine per test."""
    engine = create_async_engine("sqlite+aiosqlite://", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture
async def db_session(db_engine):
    """Yield an async session bound to the test engine."""
    session_factory = async_sessionmaker(
        db_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with session_factory() as session:
        yield session
        await session.rollback()


@pytest.fixture
async def test_user(db_session: AsyncSession):
    """Create and return a test user."""
    user = User(
        email="test@example.com",
        password_hash=hash_password("testpass123"),
        display_name="Test User",
    )
    db_session.add(user)
    await db_session.flush()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def second_user(db_session: AsyncSession):
    """Create a second user for multi-user isolation tests."""
    user = User(
        email="other@example.com",
        password_hash=hash_password("otherpass123"),
        display_name="Other User",
    )
    db_session.add(user)
    await db_session.flush()
    await db_session.refresh(user)
    return user


@pytest.fixture
def auth_token(test_user: User) -> str:
    """JWT token for the test_user."""
    return create_access_token(data={"sub": str(test_user.id)})


@pytest.fixture
async def test_app(db_engine):
    """FastAPI app with database dependency overridden to use test engine."""
    from main import app

    session_factory = async_sessionmaker(
        db_engine, class_=AsyncSession, expire_on_commit=False
    )

    async def _override_get_db():
        async with session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = _override_get_db
    yield app
    app.dependency_overrides.clear()


@pytest.fixture
async def client(test_app, auth_token):
    """Authenticated httpx AsyncClient against the test app."""
    import httpx

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=test_app),
        base_url="http://test",
        headers={"Authorization": f"Bearer {auth_token}"},
    ) as ac:
        yield ac


@pytest.fixture
async def test_categories(db_session: AsyncSession, test_user: User):
    """Create 3 categories: Groceries, Transport, Salary (all general)."""
    cats = []
    for name, section in [
        ("Groceries", "general"),
        ("Transport", "general"),
        ("Salary", "general"),
    ]:
        cat = Category(owner_id=test_user.id, name=name, section=section)
        db_session.add(cat)
        cats.append(cat)
    await db_session.flush()
    for c in cats:
        await db_session.refresh(c)
    return cats


@pytest.fixture
async def sample_transactions(
    db_session: AsyncSession, test_user: User, test_categories
):
    """Create 3 transactions: 2 expenses + 1 income for 2026-01."""
    groceries, transport, salary = test_categories
    txs = []

    for desc, amount, tx_type, cat_name, section, tx_date in [
        ("Tesco purchase", Decimal("1500.00"), "expense", "Groceries", "expense", date(2026, 1, 15)),
        ("Bolt ride", Decimal("250.00"), "expense", "Transport", "expense", date(2026, 1, 20)),
        ("Monthly salary", Decimal("50000.00"), "income", "Salary", "income", date(2026, 1, 5)),
    ]:
        tx = Transaction(
            owner_id=test_user.id,
            date=tx_date,
            description=desc,
            original_description=desc,
            amount=amount,
            type=tx_type,
            category_name=cat_name,
            section=section,
            status="classified",
            confidence=Decimal("0.90"),
        )
        db_session.add(tx)
        txs.append(tx)

    await db_session.flush()
    for t in txs:
        await db_session.refresh(t)
    return txs
