"""Move Saving account category to in_and_out section.

Revision ID: 0013
Revises: 0012
Create Date: 2026-02-10
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0013"
down_revision: Union[str, None] = "0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # Update category section to in_and_out
    conn.execute(sa.text(
        "UPDATE categories SET section = 'in_and_out' "
        "WHERE LOWER(name) IN ('saving account', 'savings account')"
    ))

    # Update all linked transactions to in_and_out
    conn.execute(sa.text(
        "UPDATE transactions SET section = 'in_and_out' "
        "WHERE category_id IN ("
        "    SELECT id FROM categories "
        "    WHERE LOWER(name) IN ('saving account', 'savings account')"
        ")"
    ))


def downgrade() -> None:
    conn = op.get_bind()

    # Revert category section to general
    conn.execute(sa.text(
        "UPDATE categories SET section = 'general' "
        "WHERE LOWER(name) IN ('saving account', 'savings account') "
        "AND section = 'in_and_out'"
    ))

    # Revert transaction sections to their type
    conn.execute(sa.text(
        "UPDATE transactions SET section = type "
        "WHERE category_id IN ("
        "    SELECT id FROM categories "
        "    WHERE LOWER(name) IN ('saving account', 'savings account')"
        ")"
    ))
