"""Add unique constraints to stock_trades and stock_dividends to prevent duplicates.

Revision ID: 0018
Revises: 0017
Create Date: 2026-02-14
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0018"
down_revision: Union[str, None] = "0017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Unique index for stock_trades: same trade cannot appear twice
    # Uses COALESCE for nullable date columns so NULLs are treated as equal
    op.execute("""
        CREATE UNIQUE INDEX uq_stock_trade_dedup
        ON stock_trades (
            owner_id,
            ticker,
            currency,
            COALESCE(date_sold, '1900-01-01'),
            COALESCE(date_acquired, '1900-01-01'),
            quantity
        )
    """)

    # Unique index for stock_dividends: same dividend cannot appear twice
    # Uses COALESCE for nullable columns so NULLs are treated as equal
    op.execute("""
        CREATE UNIQUE INDEX uq_stock_dividend_dedup
        ON stock_dividends (
            owner_id,
            COALESCE(isin, ''),
            currency,
            COALESCE(date, '1900-01-01'),
            net_amount
        )
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_stock_dividend_dedup")
    op.execute("DROP INDEX IF EXISTS uq_stock_trade_dedup")
