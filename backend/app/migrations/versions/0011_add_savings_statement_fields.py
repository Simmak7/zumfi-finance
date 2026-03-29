"""Add statement_type, closing_balance, linked_savings_id to statements.

Revision ID: 0011
Revises: 0010
Create Date: 2026-02-09
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0011"
down_revision: Union[str, None] = "0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "statements",
        sa.Column("statement_type", sa.String(20), server_default="bank", nullable=True),
    )
    op.add_column(
        "statements",
        sa.Column("closing_balance", sa.Numeric(12, 2), nullable=True),
    )
    op.add_column(
        "statements",
        sa.Column(
            "linked_savings_id",
            sa.Integer(),
            sa.ForeignKey("savings_accounts.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("statements", "linked_savings_id")
    op.drop_column("statements", "closing_balance")
    op.drop_column("statements", "statement_type")
