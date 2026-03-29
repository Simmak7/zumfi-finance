"""Add mortgage_payments table for tracking confirmed payments.

Revision ID: 0027
Revises: 0026
Create Date: 2026-03-03
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0027"
down_revision: Union[str, None] = "0026"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "mortgage_payments",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column(
            "mortgage_id", sa.Integer,
            sa.ForeignKey("mortgages.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("owner_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("month", sa.String(7), nullable=False),
        sa.Column(
            "transaction_id", sa.Integer,
            sa.ForeignKey("transactions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("paid_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("principal_portion", sa.Numeric(12, 2), nullable=True),
        sa.Column("interest_portion", sa.Numeric(12, 2), nullable=True),
        sa.Column("confirmed_at", sa.DateTime(timezone=True)),
    )
    op.create_index("idx_mortgage_payments_mortgage", "mortgage_payments", ["mortgage_id"])
    op.create_index("idx_mortgage_payments_owner", "mortgage_payments", ["owner_id"])
    op.create_index(
        "uq_mortgage_payments_mortgage_month",
        "mortgage_payments", ["mortgage_id", "month"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_mortgage_payments_mortgage_month")
    op.drop_index("idx_mortgage_payments_owner")
    op.drop_index("idx_mortgage_payments_mortgage")
    op.drop_table("mortgage_payments")
