"""Add Google OAuth fields to users table.

Revision ID: 0029
Revises: 0028
Create Date: 2026-03-04
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0029"
down_revision: Union[str, None] = "0028"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("google_id", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("auth_provider", sa.String(20), server_default="local"))
    op.add_column("users", sa.Column("avatar_url", sa.String(500), nullable=True))
    op.create_index("ix_users_google_id", "users", ["google_id"], unique=True)
    # Make password_hash nullable for Google-only users
    op.alter_column("users", "password_hash", nullable=True)


def downgrade() -> None:
    op.alter_column("users", "password_hash", nullable=False)
    op.drop_index("ix_users_google_id")
    op.drop_column("users", "avatar_url")
    op.drop_column("users", "auth_provider")
    op.drop_column("users", "google_id")
