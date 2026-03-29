"""Add total_invested to stock_holding_snapshots for cost basis tracking.

Revision ID: 0019
Revises: 0018
Create Date: 2026-02-14
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0019"
down_revision: Union[str, None] = "0018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "stock_holding_snapshots",
        sa.Column("total_invested", sa.Numeric(12, 2), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("stock_holding_snapshots", "total_invested")
