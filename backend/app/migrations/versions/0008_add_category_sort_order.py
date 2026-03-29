"""Add sort_order to categories.

Revision ID: 0008
Revises: 0007
Create Date: 2026-02-09
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("categories", sa.Column("sort_order", sa.Integer(), nullable=True, server_default="0"))


def downgrade() -> None:
    op.drop_column("categories", "sort_order")
