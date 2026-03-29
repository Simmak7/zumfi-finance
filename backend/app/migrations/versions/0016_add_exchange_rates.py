"""Add exchange_rates table for CNB currency rate caching.

Revision ID: 0016
Revises: 0015
Create Date: 2026-02-13
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0016"
down_revision: Union[str, None] = "0015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "exchange_rates",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("rate_date", sa.Date(), nullable=False),
        sa.Column("currency_code", sa.String(3), nullable=False),
        sa.Column("rate_to_czk", sa.Numeric(12, 6), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("rate_date", "currency_code", name="uq_exchange_rate_date_code"),
    )
    op.create_index("idx_exchange_rates_date", "exchange_rates", ["rate_date"])


def downgrade() -> None:
    op.drop_index("idx_exchange_rates_date", table_name="exchange_rates")
    op.drop_table("exchange_rates")
