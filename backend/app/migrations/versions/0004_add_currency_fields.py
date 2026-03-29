"""Add currency fields to transactions.

Revision ID: 0004
Revises: 0003
Create Date: 2026-02-07
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "transactions",
        sa.Column("currency", sa.String(3), server_default="CZK"),
    )
    op.add_column(
        "transactions",
        sa.Column("original_amount", sa.Numeric(12, 2), nullable=True),
    )
    op.add_column(
        "transactions",
        sa.Column("original_currency", sa.String(3), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("transactions", "original_currency")
    op.drop_column("transactions", "original_amount")
    op.drop_column("transactions", "currency")
