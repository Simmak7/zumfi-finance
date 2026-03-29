from datetime import datetime, timezone

from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime,
    ForeignKey, UniqueConstraint, Index,
)

from core.database import Base


class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(100), nullable=False)
    bank_name = Column(String(100), nullable=False)
    currency = Column(String(3), default="CZK")
    account_type = Column(String(20), nullable=False)  # checking/savings/card/cash
    is_default = Column(Boolean, default=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        UniqueConstraint("owner_id", "name", name="uq_account_owner_name"),
        Index("idx_accounts_owner", "owner_id"),
    )
