"""Add mortgage_events table and new fields (currency, fix_end_date, balance_override) to mortgages.

Revision ID: 0026
Revises: 0025
Create Date: 2026-03-03
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0026"
down_revision: Union[str, None] = "0025"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # New columns on mortgages
    op.add_column("mortgages", sa.Column("currency", sa.String(3), server_default="CZK", nullable=False))
    op.add_column("mortgages", sa.Column("fix_end_date", sa.Date, nullable=True))
    op.add_column("mortgages", sa.Column("balance_override", sa.Numeric(14, 2), nullable=True))

    # Mortgage events table
    op.create_table(
        "mortgage_events",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column(
            "mortgage_id", sa.Integer,
            sa.ForeignKey("mortgages.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("owner_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("event_type", sa.String(30), nullable=False),
        sa.Column("event_date", sa.Date, nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=True),
        sa.Column("old_rate", sa.Numeric(5, 3), nullable=True),
        sa.Column("new_rate", sa.Numeric(5, 3), nullable=True),
        sa.Column("old_payment", sa.Numeric(12, 2), nullable=True),
        sa.Column("new_payment", sa.Numeric(12, 2), nullable=True),
        sa.Column("new_balance", sa.Numeric(14, 2), nullable=True),
        sa.Column("new_fix_end_date", sa.Date, nullable=True),
        sa.Column("note", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True)),
    )
    op.create_index("idx_mortgage_events_mortgage", "mortgage_events", ["mortgage_id"])
    op.create_index("idx_mortgage_events_owner", "mortgage_events", ["owner_id"])


def downgrade() -> None:
    op.drop_index("idx_mortgage_events_owner")
    op.drop_index("idx_mortgage_events_mortgage")
    op.drop_table("mortgage_events")
    op.drop_column("mortgages", "balance_override")
    op.drop_column("mortgages", "fix_end_date")
    op.drop_column("mortgages", "currency")
