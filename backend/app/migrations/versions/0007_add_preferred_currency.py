"""Add preferred_currency to users.

Revision ID: 0007
Revises: 0006
Create Date: 2026-02-08
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add preferred_currency column to users table
    op.add_column(
        "users",
        sa.Column("preferred_currency", sa.String(3), server_default="CZK", nullable=True)
    )


def downgrade() -> None:
    # Remove preferred_currency column from users table
    op.drop_column("users", "preferred_currency")
