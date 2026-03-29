"""Add page_order, hidden_pages, and show_zumfi_rabbit to users.

Revision ID: 0025
Revises: 0024
Create Date: 2026-03-02
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0025"
down_revision: Union[str, None] = "0024"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("page_order", sa.Text, nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("hidden_pages", sa.Text, nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("show_zumfi_rabbit", sa.Boolean, server_default="true", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("users", "show_zumfi_rabbit")
    op.drop_column("users", "hidden_pages")
    op.drop_column("users", "page_order")
