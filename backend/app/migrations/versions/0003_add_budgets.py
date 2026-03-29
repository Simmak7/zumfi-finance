"""Add budgets table.

Revision ID: 0003
Revises: 0002
Create Date: 2026-02-07
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "budgets",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("category_id", sa.Integer(), sa.ForeignKey("categories.id"), nullable=False),
        sa.Column("month", sa.String(7), nullable=False),
        sa.Column("planned_amount", sa.Numeric(12, 2), nullable=False),
        sa.UniqueConstraint(
            "owner_id", "category_id", "month",
            name="uq_budget_owner_category_month",
        ),
    )
    op.create_index("ix_budgets_id", "budgets", ["id"])
    op.create_index("idx_budgets_owner_month", "budgets", ["owner_id", "month"])


def downgrade() -> None:
    op.drop_index("idx_budgets_owner_month", table_name="budgets")
    op.drop_index("ix_budgets_id", table_name="budgets")
    op.drop_table("budgets")
