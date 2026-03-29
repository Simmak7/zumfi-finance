"""Add mortgages table for mortgage tracking.

Revision ID: 0024
Revises: 0023
Create Date: 2026-03-01
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0024"
down_revision: Union[str, None] = "0023"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "mortgages",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("owner_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("original_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("interest_rate", sa.Numeric(5, 3), nullable=False),
        sa.Column("term_months", sa.Integer, nullable=False),
        sa.Column("monthly_payment", sa.Numeric(12, 2), nullable=False),
        sa.Column("start_date", sa.Date, nullable=False),
        sa.Column("extra_payments", sa.Numeric(14, 2), server_default="0"),
        sa.Column(
            "property_id", sa.Integer,
            sa.ForeignKey("property_investments.id"), nullable=True,
        ),
        sa.Column(
            "category_id", sa.Integer,
            sa.ForeignKey("categories.id"), nullable=True,
        ),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True)),
    )
    op.create_index("idx_mortgages_owner", "mortgages", ["owner_id"])


def downgrade() -> None:
    op.drop_index("idx_mortgages_owner")
    op.drop_table("mortgages")
