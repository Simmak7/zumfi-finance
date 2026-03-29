"""Add stock_holding_snapshots table and isin column to stock_holdings.

Revision ID: 0015
Revises: 0014
Create Date: 2026-02-13
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0015"
down_revision: Union[str, None] = "0014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add ISIN column to stock_holdings
    op.add_column(
        "stock_holdings",
        sa.Column("isin", sa.String(20), nullable=True),
    )

    # Per-holding monthly snapshots for tracking development
    op.create_table(
        "stock_holding_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("ticker", sa.String(20), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("snapshot_month", sa.String(7), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("holding_type", sa.String(20), nullable=False, server_default="stock"),
        sa.Column("shares", sa.Numeric(18, 8), nullable=False, server_default="0"),
        sa.Column("price", sa.Numeric(18, 8), nullable=True),
        sa.Column("market_value", sa.Numeric(12, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint(
            "owner_id", "ticker", "currency", "snapshot_month",
            name="uq_stock_snap_owner_ticker_curr_month",
        ),
    )
    op.create_index(
        "idx_stock_snap_owner_month",
        "stock_holding_snapshots",
        ["owner_id", "snapshot_month"],
    )


def downgrade() -> None:
    op.drop_index("idx_stock_snap_owner_month", table_name="stock_holding_snapshots")
    op.drop_table("stock_holding_snapshots")
    op.drop_column("stock_holdings", "isin")
