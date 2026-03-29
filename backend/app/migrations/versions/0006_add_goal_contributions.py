"""Add goal_contributions table and monthly_allocation to goals.

Revision ID: 0006
Revises: 0005
Create Date: 2026-02-07
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add monthly_allocation to goals
    op.add_column("goals", sa.Column("monthly_allocation", sa.Numeric(12, 2), nullable=True))

    # Create goal_contributions table
    op.create_table(
        "goal_contributions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("goal_id", sa.Integer(), sa.ForeignKey("goals.id", ondelete="CASCADE"), nullable=False),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("month", sa.String(7), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("source", sa.String(50), server_default="manual"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_goal_contributions_id", "goal_contributions", ["id"])
    op.create_index("idx_goal_contributions_goal", "goal_contributions", ["goal_id"])
    op.create_index("idx_goal_contributions_owner_month", "goal_contributions", ["owner_id", "month"])


def downgrade() -> None:
    op.drop_table("goal_contributions")
    op.drop_column("goals", "monthly_allocation")
