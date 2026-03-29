"""Add goal_snapshots table for per-goal monthly history.

Revision ID: 0023
Revises: 0022
Create Date: 2026-03-01
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0023"
down_revision: Union[str, None] = "0022"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "goal_snapshots",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("owner_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "goal_id", sa.Integer,
            sa.ForeignKey("goals.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("snapshot_month", sa.String(7), nullable=False),
        sa.Column("current_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("target_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint(
            "owner_id", "goal_id", "snapshot_month",
            name="uq_goal_snap_owner_goal_month",
        ),
    )
    op.create_index(
        "idx_goal_snap_owner_month", "goal_snapshots",
        ["owner_id", "snapshot_month"],
    )


def downgrade() -> None:
    op.drop_index("idx_goal_snap_owner_month")
    op.drop_table("goal_snapshots")
