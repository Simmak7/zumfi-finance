"""Add accounts table and account_id FK on transactions/statements.

Revision ID: 0002
Revises: 0001
Create Date: 2026-02-07
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "accounts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("bank_name", sa.String(100), nullable=False),
        sa.Column("currency", sa.String(3), server_default="CZK"),
        sa.Column("account_type", sa.String(20), nullable=False),
        sa.Column("is_default", sa.Boolean(), server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("owner_id", "name", name="uq_account_owner_name"),
    )
    op.create_index("ix_accounts_id", "accounts", ["id"])
    op.create_index("idx_accounts_owner", "accounts", ["owner_id"])

    # Add account_id FK to transactions
    op.add_column("transactions", sa.Column("account_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_transactions_account_id", "transactions", "accounts",
        ["account_id"], ["id"],
    )

    # Add account_id FK to statements
    op.add_column("statements", sa.Column("account_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_statements_account_id", "statements", "accounts",
        ["account_id"], ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_statements_account_id", "statements", type_="foreignkey")
    op.drop_column("statements", "account_id")
    op.drop_constraint("fk_transactions_account_id", "transactions", type_="foreignkey")
    op.drop_column("transactions", "account_id")
    op.drop_index("idx_accounts_owner", table_name="accounts")
    op.drop_index("ix_accounts_id", table_name="accounts")
    op.drop_table("accounts")
