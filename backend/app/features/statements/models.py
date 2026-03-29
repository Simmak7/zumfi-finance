from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Date, DateTime, ForeignKey,
    Numeric, Text, Index,
)
from core.database import Base


class Statement(Base):
    __tablename__ = "statements"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    filename = Column(String(255), nullable=False)
    upload_date = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    period_start = Column(Date, nullable=True)
    period_end = Column(Date, nullable=True)
    bank_name = Column(String(100), nullable=True)
    status = Column(String(20), default="processing")  # processing, completed, failed
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)
    file_path = Column(String(500), nullable=True)  # path to stored original file
    statement_type = Column(String(20), default="bank")  # bank, savings
    closing_balance = Column(Numeric(12, 2), nullable=True)
    linked_savings_id = Column(
        Integer, ForeignKey("savings_accounts.id", ondelete="SET NULL"), nullable=True,
    )

    __table_args__ = (
        Index("idx_statements_owner", "owner_id"),
    )


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    statement_id = Column(Integer, ForeignKey("statements.id"), nullable=True)
    date = Column(Date, nullable=False)
    description = Column(Text, nullable=False)
    original_description = Column(Text, nullable=True)
    amount = Column(Numeric(12, 2), nullable=False)
    type = Column(String(10), nullable=False)  # 'income' or 'expense'
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    category_name = Column(String(100), nullable=True)  # Denormalized for quick access
    section = Column(String(20), nullable=True)
    status = Column(String(20), default="review")  # review, classified, confirmed
    confidence = Column(Numeric(3, 2), nullable=True)
    ai_suggested_category = Column(String(100), nullable=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)
    currency = Column(String(3), default="CZK")
    original_amount = Column(Numeric(12, 2), nullable=True)
    original_currency = Column(String(3), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        Index("idx_transactions_owner_date", "owner_id", "date"),
        Index("idx_transactions_category", "category_id"),
        Index("idx_transactions_status", "owner_id", "status"),
    )
