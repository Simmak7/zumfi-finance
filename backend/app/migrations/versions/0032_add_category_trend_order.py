"""Add category_trend_order to users table.

Revision ID: 0032
Revises: 0031
"""
from alembic import op
import sqlalchemy as sa

revision = "0032"
down_revision = "0031"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("category_trend_order", sa.Text(), nullable=True))


def downgrade():
    op.drop_column("users", "category_trend_order")
