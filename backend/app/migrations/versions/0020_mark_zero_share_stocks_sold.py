"""Mark zero-share stock holdings as sold.

Revision ID: 0020
Revises: 0019
Create Date: 2026-02-14
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0020"
down_revision: Union[str, None] = "0019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "UPDATE stock_holdings SET status = 'sold' "
        "WHERE shares < 0.0001 AND status = 'active'"
    )


def downgrade() -> None:
    # Cannot reliably reverse — we don't know which were manually sold
    pass
