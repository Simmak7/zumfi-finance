from datetime import datetime, timezone
from sqlalchemy import (
    Boolean, Column, Integer, String, Date, DateTime, ForeignKey,
    Numeric, Index, UniqueConstraint,
)
from core.database import Base


class SavingsAccount(Base):
    __tablename__ = "savings_accounts"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(200), nullable=False)
    institution = Column(String(200), nullable=True)
    balance = Column(Numeric(12, 2), nullable=False, default=0)
    interest_rate = Column(Numeric(5, 2), nullable=True)
    currency = Column(String(3), nullable=False, default="CZK")
    notes = Column(String(500), nullable=True)
    color = Column(String(7), nullable=True)
    status = Column(String(20), default="active")  # active, closed
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        Index("idx_savings_owner", "owner_id"),
    )


class Investment(Base):
    __tablename__ = "investments"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(200), nullable=False)
    ticker = Column(String(20), nullable=True)
    investment_type = Column(String(20), nullable=False)  # etf, stock, bond, crypto, other
    units = Column(Numeric(18, 8), nullable=False, default=0)
    avg_purchase_price = Column(Numeric(18, 8), nullable=False)
    current_price = Column(Numeric(18, 8), nullable=True)
    currency = Column(String(3), nullable=False, default="USD")
    notes = Column(String(500), nullable=True)
    color = Column(String(7), nullable=True)
    status = Column(String(20), default="active")  # active, sold
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        Index("idx_investments_owner", "owner_id"),
    )


class StockHolding(Base):
    __tablename__ = "stock_holdings"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(200), nullable=False)
    ticker = Column(String(20), nullable=True)
    isin = Column(String(20), nullable=True)
    holding_type = Column(String(20), nullable=False, default="stock")  # stock, etf
    shares = Column(Numeric(18, 8), nullable=False, default=0)
    avg_cost_per_share = Column(Numeric(18, 8), nullable=False)
    current_price = Column(Numeric(18, 8), nullable=True)
    currency = Column(String(3), nullable=False, default="CZK")
    notes = Column(String(500), nullable=True)
    color = Column(String(7), nullable=True)
    status = Column(String(20), default="active")  # active, sold
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        Index("idx_stock_holdings_owner", "owner_id"),
    )


class StockHoldingSnapshot(Base):
    """Per-holding monthly snapshot for tracking stock development over time."""
    __tablename__ = "stock_holding_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    ticker = Column(String(20), nullable=False)
    currency = Column(String(3), nullable=False)
    snapshot_month = Column(String(7), nullable=False)  # "YYYY-MM"
    name = Column(String(200), nullable=False)
    holding_type = Column(String(20), nullable=False, default="stock")
    shares = Column(Numeric(18, 8), nullable=False, default=0)
    price = Column(Numeric(18, 8), nullable=True)
    market_value = Column(Numeric(12, 2), nullable=True)
    total_invested = Column(Numeric(12, 2), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        UniqueConstraint(
            "owner_id", "ticker", "currency", "snapshot_month",
            name="uq_stock_snap_owner_ticker_curr_month",
        ),
        Index("idx_stock_snap_owner_month", "owner_id", "snapshot_month"),
    )


class StockTrade(Base):
    """Realized stock sell from a P&L statement."""
    __tablename__ = "stock_trades"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    statement_id = Column(Integer, ForeignKey("statements.id"), nullable=True)
    ticker = Column(String(20), nullable=False)
    name = Column(String(200), nullable=False)
    isin = Column(String(20), nullable=True)
    country = Column(String(5), nullable=True)
    currency = Column(String(3), nullable=False)
    date_acquired = Column(Date, nullable=True)
    date_sold = Column(Date, nullable=True)
    quantity = Column(Numeric(18, 8), nullable=False, default=0)
    cost_basis = Column(Numeric(12, 2), nullable=False, default=0)
    gross_proceeds = Column(Numeric(12, 2), nullable=False, default=0)
    gross_pnl = Column(Numeric(12, 2), nullable=False, default=0)
    fees = Column(Numeric(12, 2), nullable=False, default=0)
    cost_basis_czk = Column(Numeric(12, 2), nullable=True)
    gross_proceeds_czk = Column(Numeric(12, 2), nullable=True)
    gross_pnl_czk = Column(Numeric(12, 2), nullable=True)
    rate_buy = Column(Numeric(12, 4), nullable=True)
    rate_sell = Column(Numeric(12, 4), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        Index("idx_stock_trades_owner", "owner_id"),
        Index("idx_stock_trades_date_sold", "owner_id", "date_sold"),
        # DB-level dedup via functional unique index (migration 0018)
        # Key: (owner_id, ticker, currency, date_sold, date_acquired, quantity)
    )


class StockDividend(Base):
    """Dividend or other income from a P&L statement."""
    __tablename__ = "stock_dividends"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    statement_id = Column(Integer, ForeignKey("statements.id"), nullable=True)
    ticker = Column(String(20), nullable=True)
    name = Column(String(200), nullable=True)
    isin = Column(String(20), nullable=True)
    country = Column(String(5), nullable=True)
    currency = Column(String(3), nullable=False)
    date = Column(Date, nullable=True)
    description = Column(String(200), nullable=True)
    gross_amount = Column(Numeric(12, 2), nullable=False, default=0)
    withholding_tax = Column(Numeric(12, 2), nullable=False, default=0)
    net_amount = Column(Numeric(12, 2), nullable=False, default=0)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        Index("idx_stock_dividends_owner", "owner_id"),
        # DB-level dedup via functional unique index (migration 0018)
        # Key: (owner_id, isin, currency, date, net_amount)
    )


class PortfolioSnapshot(Base):
    __tablename__ = "portfolio_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    snapshot_date = Column(Date, nullable=False)
    total_savings = Column(Numeric(12, 2), nullable=False)
    total_investments = Column(Numeric(12, 2), nullable=False)
    total_stocks = Column(Numeric(12, 2), nullable=False, default=0)
    total_properties = Column(Numeric(14, 2), nullable=False, default=0)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        UniqueConstraint("owner_id", "snapshot_date", name="uq_snapshot_owner_date"),
        Index("idx_snapshots_owner_date", "owner_id", "snapshot_date"),
    )


class PropertyInvestment(Base):
    """Real estate property investment for tracking value over time."""
    __tablename__ = "property_investments"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(200), nullable=False)
    property_type = Column(String(20), nullable=False)  # flat, house

    # Location
    country = Column(String(100), nullable=True, default="Czech Republic")
    city = Column(String(100), nullable=True)
    address = Column(String(300), nullable=True)

    # Physical characteristics
    square_meters = Column(Numeric(8, 2), nullable=False)
    rooms = Column(Integer, nullable=True)
    has_balcony = Column(Boolean, nullable=False, default=False)
    has_garden = Column(Boolean, nullable=False, default=False)
    has_parking = Column(Boolean, nullable=False, default=False)
    renovation_state = Column(String(20), nullable=False, default="good")  # new, good, needs_renovation
    floor = Column(String(20), nullable=True)  # ground, middle, top (for flats)

    # Financial
    purchase_price = Column(Numeric(14, 2), nullable=False)
    price_per_sqm = Column(Numeric(10, 2), nullable=True)
    estimated_value = Column(Numeric(14, 2), nullable=True)  # manual override
    currency = Column(String(3), nullable=False, default="CZK")
    purchase_date = Column(Date, nullable=True)

    # Metadata
    notes = Column(String(500), nullable=True)
    color = Column(String(7), nullable=True)
    status = Column(String(20), nullable=False, default="active")  # active, sold
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        Index("idx_properties_owner", "owner_id"),
    )


class PropertySnapshot(Base):
    """Monthly snapshot of a property's estimated value."""
    __tablename__ = "property_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    property_id = Column(Integer, ForeignKey("property_investments.id"), nullable=False)
    snapshot_month = Column(String(7), nullable=False)  # "YYYY-MM"
    estimated_value = Column(Numeric(14, 2), nullable=False)
    price_per_sqm = Column(Numeric(10, 2), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        UniqueConstraint(
            "owner_id", "property_id", "snapshot_month",
            name="uq_prop_snap_owner_prop_month",
        ),
        Index("idx_prop_snap_owner_month", "owner_id", "snapshot_month"),
    )
