"""Add portfolio tables (savings_accounts, investments, portfolio_snapshots).

Revision ID: 0009
Revises: 0008
Create Date: 2026-02-09
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "savings_accounts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("institution", sa.String(200), nullable=True),
        sa.Column("balance", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("interest_rate", sa.Numeric(5, 2), nullable=True),
        sa.Column("currency", sa.String(3), nullable=False, server_default="CZK"),
        sa.Column("notes", sa.String(500), nullable=True),
        sa.Column("color", sa.String(7), nullable=True),
        sa.Column("status", sa.String(20), server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_savings_accounts_id", "savings_accounts", ["id"])
    op.create_index("idx_savings_owner", "savings_accounts", ["owner_id"])

    op.create_table(
        "investments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("ticker", sa.String(20), nullable=True),
        sa.Column("investment_type", sa.String(20), nullable=False),
        sa.Column("units", sa.Numeric(18, 8), nullable=False, server_default="0"),
        sa.Column("avg_purchase_price", sa.Numeric(18, 8), nullable=False),
        sa.Column("current_price", sa.Numeric(18, 8), nullable=True),
        sa.Column("currency", sa.String(3), nullable=False, server_default="USD"),
        sa.Column("notes", sa.String(500), nullable=True),
        sa.Column("color", sa.String(7), nullable=True),
        sa.Column("status", sa.String(20), server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_investments_id", "investments", ["id"])
    op.create_index("idx_investments_owner", "investments", ["owner_id"])

    op.create_table(
        "portfolio_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("snapshot_date", sa.Date(), nullable=False),
        sa.Column("total_savings", sa.Numeric(12, 2), nullable=False),
        sa.Column("total_investments", sa.Numeric(12, 2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_portfolio_snapshots_id", "portfolio_snapshots", ["id"])
    op.create_index("idx_snapshots_owner_date", "portfolio_snapshots", ["owner_id", "snapshot_date"])
    op.create_unique_constraint("uq_snapshot_owner_date", "portfolio_snapshots", ["owner_id", "snapshot_date"])


def downgrade() -> None:
    op.drop_table("portfolio_snapshots")
    op.drop_table("investments")
    op.drop_table("savings_accounts")
