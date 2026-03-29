"""Add language field to users table.

Revision ID: 0031
Revises: 0030
Create Date: 2026-03-07
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0031"
down_revision: Union[str, None] = "0030"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("language", sa.String(5), nullable=True, server_default="en"))
    op.execute("UPDATE users SET language = 'en' WHERE language IS NULL")
    op.alter_column("users", "language", nullable=False)


def downgrade() -> None:
    op.drop_column("users", "language")
