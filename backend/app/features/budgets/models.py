from sqlalchemy import (
    Column, Integer, String, ForeignKey, Numeric,
    UniqueConstraint, Index,
)

from core.database import Base


class Budget(Base):
    __tablename__ = "budgets"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    month = Column(String(7), nullable=False)  # "YYYY-MM"
    planned_amount = Column(Numeric(12, 2), nullable=False)

    __table_args__ = (
        UniqueConstraint(
            "owner_id", "category_id", "month",
            name="uq_budget_owner_category_month",
        ),
        Index("idx_budgets_owner_month", "owner_id", "month"),
    )
