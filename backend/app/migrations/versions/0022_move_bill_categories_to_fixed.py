"""Move bill-type categories to fixed section.

Revision ID: 0022
Revises: 0021
Create Date: 2026-02-28
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0022"
down_revision: Union[str, None] = "0021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

FIXED_CATEGORY_NAMES = (
    "fixed bills", "electricity", "mortgage", "internet", "phone",
    "water", "gas", "insurance", "rent",
)


def upgrade() -> None:
    conn = op.get_bind()

    placeholders = ", ".join(f"'{n}'" for n in FIXED_CATEGORY_NAMES)

    # Move matching categories from general to fixed
    conn.execute(sa.text(
        f"UPDATE categories SET section = 'fixed' "
        f"WHERE LOWER(name) IN ({placeholders}) "
        f"AND section = 'general'"
    ))


def downgrade() -> None:
    conn = op.get_bind()

    placeholders = ", ".join(f"'{n}'" for n in FIXED_CATEGORY_NAMES)

    conn.execute(sa.text(
        f"UPDATE categories SET section = 'general' "
        f"WHERE LOWER(name) IN ({placeholders}) "
        f"AND section = 'fixed'"
    ))
