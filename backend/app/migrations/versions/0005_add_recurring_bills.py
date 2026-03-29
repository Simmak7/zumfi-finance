"""Add recurring_bills table.

Revision ID: 0005
Revises: 0004
Create Date: 2026-02-07
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "recurring_bills",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("expected_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("frequency", sa.String(20), nullable=False, server_default="monthly"),
        sa.Column("due_day", sa.Integer(), nullable=True),
        sa.Column("category_id", sa.Integer(), sa.ForeignKey("categories.id"), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_recurring_bills_id", "recurring_bills", ["id"])
    op.create_index("idx_recurring_bills_owner", "recurring_bills", ["owner_id"])


def downgrade() -> None:
    op.drop_table("recurring_bills")
