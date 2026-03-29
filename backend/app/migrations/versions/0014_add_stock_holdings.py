"""Add stock_holdings table and total_stocks to portfolio_snapshots.

Revision ID: 0014
Revises: 0013
Create Date: 2026-02-13
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0014"
down_revision: Union[str, None] = "0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "stock_holdings",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("ticker", sa.String(20), nullable=True),
        sa.Column("holding_type", sa.String(20), nullable=False, server_default="stock"),
        sa.Column("shares", sa.Numeric(18, 8), nullable=False, server_default="0"),
        sa.Column("avg_cost_per_share", sa.Numeric(18, 8), nullable=False),
        sa.Column("current_price", sa.Numeric(18, 8), nullable=True),
        sa.Column("currency", sa.String(3), nullable=False, server_default="CZK"),
        sa.Column("notes", sa.String(500), nullable=True),
        sa.Column("color", sa.String(7), nullable=True),
        sa.Column("status", sa.String(20), server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_stock_holdings_owner", "stock_holdings", ["owner_id"])

    op.add_column(
        "portfolio_snapshots",
        sa.Column("total_stocks", sa.Numeric(12, 2), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("portfolio_snapshots", "total_stocks")
    op.drop_index("idx_stock_holdings_owner", table_name="stock_holdings")
    op.drop_table("stock_holdings")
