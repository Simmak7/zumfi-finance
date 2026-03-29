"""Add TOTP 2FA fields to users table.

Revision ID: 0030
Revises: 0029
Create Date: 2026-03-04
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0030"
down_revision: Union[str, None] = "0029"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("totp_secret", sa.String(32), nullable=True))
    op.add_column("users", sa.Column("totp_enabled", sa.Boolean(), server_default="false", nullable=False))
    op.add_column("users", sa.Column("recovery_codes", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "recovery_codes")
    op.drop_column("users", "totp_enabled")
    op.drop_column("users", "totp_secret")
