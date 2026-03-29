from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Date, DateTime, ForeignKey, Numeric,
    UniqueConstraint, Index,
)
from core.database import Base


class Goal(Base):
    __tablename__ = "goals"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(200), nullable=False)
    target_amount = Column(Numeric(12, 2), nullable=False)
    current_amount = Column(Numeric(12, 2), default=0)
    monthly_allocation = Column(Numeric(12, 2), nullable=True)
    color = Column(String(7), nullable=True)
    deadline = Column(Date, nullable=True)
    status = Column(String(20), default="active")  # active, completed, archived
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )


class GoalContribution(Base):
    __tablename__ = "goal_contributions"

    id = Column(Integer, primary_key=True, index=True)
    goal_id = Column(Integer, ForeignKey("goals.id", ondelete="CASCADE"), nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    month = Column(String(7), nullable=False)  # "YYYY-MM"
    amount = Column(Numeric(12, 2), nullable=False)
    source = Column(String(50), default="manual")  # "manual", "surplus"
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )


class GoalSnapshot(Base):
    """Monthly snapshot of a goal's current_amount for historical tracking."""
    __tablename__ = "goal_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    goal_id = Column(Integer, ForeignKey("goals.id", ondelete="CASCADE"), nullable=False)
    snapshot_month = Column(String(7), nullable=False)  # "YYYY-MM"
    current_amount = Column(Numeric(12, 2), nullable=False)
    target_amount = Column(Numeric(12, 2), nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        UniqueConstraint(
            "owner_id", "goal_id", "snapshot_month",
            name="uq_goal_snap_owner_goal_month",
        ),
        Index("idx_goal_snap_owner_month", "owner_id", "snapshot_month"),
    )
