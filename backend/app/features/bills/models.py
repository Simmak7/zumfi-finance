from datetime import datetime, timezone

from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Date, Text,
    ForeignKey, Index, Numeric,
)

from core.database import Base


class RecurringBill(Base):
    __tablename__ = "recurring_bills"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(200), nullable=False)
    expected_amount = Column(Numeric(12, 2), nullable=False)
    frequency = Column(String(20), nullable=False, default="monthly")
    due_day = Column(Integer, nullable=True)  # 1-31
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        Index("idx_recurring_bills_owner", "owner_id"),
    )


class Mortgage(Base):
    __tablename__ = "mortgages"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(200), nullable=False)
    original_amount = Column(Numeric(14, 2), nullable=False)
    interest_rate = Column(Numeric(5, 3), nullable=False)  # annual %
    term_months = Column(Integer, nullable=False)
    monthly_payment = Column(Numeric(12, 2), nullable=False)
    start_date = Column(Date, nullable=False)
    extra_payments = Column(Numeric(14, 2), default=0)
    property_id = Column(
        Integer, ForeignKey("property_investments.id"), nullable=True,
    )
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    currency = Column(String(3), nullable=False, default="CZK")
    fix_end_date = Column(Date, nullable=True)  # when fixed rate expires
    balance_override = Column(Numeric(14, 2), nullable=True)  # manual override
    is_active = Column(Boolean, default=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        Index("idx_mortgages_owner", "owner_id"),
    )


class MortgageEvent(Base):
    """Tracks historical changes: rate changes, extra payments, payment changes."""
    __tablename__ = "mortgage_events"

    id = Column(Integer, primary_key=True, index=True)
    mortgage_id = Column(Integer, ForeignKey("mortgages.id", ondelete="CASCADE"), nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    event_type = Column(String(30), nullable=False)
    # event_type values: "extra_payment", "rate_change", "payment_change",
    #                    "balance_override", "fix_period_change"
    event_date = Column(Date, nullable=False)
    amount = Column(Numeric(14, 2), nullable=True)        # for extra_payment
    old_rate = Column(Numeric(5, 3), nullable=True)        # for rate_change
    new_rate = Column(Numeric(5, 3), nullable=True)        # for rate_change
    old_payment = Column(Numeric(12, 2), nullable=True)    # for payment_change
    new_payment = Column(Numeric(12, 2), nullable=True)    # for payment_change
    new_balance = Column(Numeric(14, 2), nullable=True)    # for balance_override
    new_fix_end_date = Column(Date, nullable=True)         # for fix_period_change
    note = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        Index("idx_mortgage_events_mortgage", "mortgage_id"),
        Index("idx_mortgage_events_owner", "owner_id"),
    )


class MortgagePayment(Base):
    """Tracks confirmed mortgage payments, optionally linked to a transaction."""
    __tablename__ = "mortgage_payments"

    id = Column(Integer, primary_key=True, index=True)
    mortgage_id = Column(
        Integer,
        ForeignKey("mortgages.id", ondelete="CASCADE"),
        nullable=False,
    )
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    month = Column(String(7), nullable=False)  # "YYYY-MM"
    transaction_id = Column(
        Integer,
        ForeignKey("transactions.id", ondelete="SET NULL"),
        nullable=True,
    )
    paid_amount = Column(Numeric(12, 2), nullable=False)
    principal_portion = Column(Numeric(12, 2), nullable=True)
    interest_portion = Column(Numeric(12, 2), nullable=True)
    confirmed_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        Index("idx_mortgage_payments_mortgage", "mortgage_id"),
        Index("idx_mortgage_payments_owner", "owner_id"),
        Index(
            "uq_mortgage_payments_mortgage_month",
            "mortgage_id", "month",
            unique=True,
        ),
    )
