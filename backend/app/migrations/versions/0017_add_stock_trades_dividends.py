"""Add stock_trades and stock_dividends tables for P&L data.

Revision ID: 0017
Revises: 0016
Create Date: 2026-02-13
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0017"
down_revision: Union[str, None] = "0016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "stock_trades",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("statement_id", sa.Integer(), sa.ForeignKey("statements.id"), nullable=True),
        sa.Column("ticker", sa.String(20), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("isin", sa.String(20), nullable=True),
        sa.Column("country", sa.String(5), nullable=True),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("date_acquired", sa.Date(), nullable=True),
        sa.Column("date_sold", sa.Date(), nullable=True),
        sa.Column("quantity", sa.Numeric(18, 8), nullable=False, server_default="0"),
        sa.Column("cost_basis", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("gross_proceeds", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("gross_pnl", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("fees", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("cost_basis_czk", sa.Numeric(12, 2), nullable=True),
        sa.Column("gross_proceeds_czk", sa.Numeric(12, 2), nullable=True),
        sa.Column("gross_pnl_czk", sa.Numeric(12, 2), nullable=True),
        sa.Column("rate_buy", sa.Numeric(12, 4), nullable=True),
        sa.Column("rate_sell", sa.Numeric(12, 4), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_stock_trades_owner", "stock_trades", ["owner_id"])
    op.create_index("idx_stock_trades_date_sold", "stock_trades", ["owner_id", "date_sold"])

    op.create_table(
        "stock_dividends",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("statement_id", sa.Integer(), sa.ForeignKey("statements.id"), nullable=True),
        sa.Column("ticker", sa.String(20), nullable=True),
        sa.Column("name", sa.String(200), nullable=True),
        sa.Column("isin", sa.String(20), nullable=True),
        sa.Column("country", sa.String(5), nullable=True),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("date", sa.Date(), nullable=True),
        sa.Column("description", sa.String(200), nullable=True),
        sa.Column("gross_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("withholding_tax", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("net_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_stock_dividends_owner", "stock_dividends", ["owner_id"])


def downgrade() -> None:
    op.drop_index("idx_stock_dividends_owner", table_name="stock_dividends")
    op.drop_table("stock_dividends")
    op.drop_index("idx_stock_trades_date_sold", table_name="stock_trades")
    op.drop_index("idx_stock_trades_owner", table_name="stock_trades")
    op.drop_table("stock_trades")
