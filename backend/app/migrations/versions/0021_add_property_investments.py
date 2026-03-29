"""Add property investment tables and total_properties to portfolio_snapshots.

Revision ID: 0021
Revises: 0020
Create Date: 2026-02-26
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0021"
down_revision: Union[str, None] = "0020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "property_investments",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("owner_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("property_type", sa.String(20), nullable=False),
        sa.Column("country", sa.String(100), nullable=True),
        sa.Column("city", sa.String(100), nullable=True),
        sa.Column("address", sa.String(300), nullable=True),
        sa.Column("square_meters", sa.Numeric(8, 2), nullable=False),
        sa.Column("rooms", sa.Integer, nullable=True),
        sa.Column("has_balcony", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("has_garden", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("has_parking", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("renovation_state", sa.String(20), nullable=False, server_default="good"),
        sa.Column("floor", sa.String(20), nullable=True),
        sa.Column("purchase_price", sa.Numeric(14, 2), nullable=False),
        sa.Column("price_per_sqm", sa.Numeric(10, 2), nullable=True),
        sa.Column("estimated_value", sa.Numeric(14, 2), nullable=True),
        sa.Column("currency", sa.String(3), nullable=False, server_default="CZK"),
        sa.Column("purchase_date", sa.Date, nullable=True),
        sa.Column("notes", sa.String(500), nullable=True),
        sa.Column("color", sa.String(7), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )
    op.create_index("idx_properties_owner", "property_investments", ["owner_id"])

    op.create_table(
        "property_snapshots",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("owner_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "property_id", sa.Integer,
            sa.ForeignKey("property_investments.id"), nullable=False,
        ),
        sa.Column("snapshot_month", sa.String(7), nullable=False),
        sa.Column("estimated_value", sa.Numeric(14, 2), nullable=False),
        sa.Column("price_per_sqm", sa.Numeric(10, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True)),
    )
    op.create_unique_constraint(
        "uq_prop_snap_owner_prop_month",
        "property_snapshots",
        ["owner_id", "property_id", "snapshot_month"],
    )
    op.create_index(
        "idx_prop_snap_owner_month",
        "property_snapshots",
        ["owner_id", "snapshot_month"],
    )

    op.add_column(
        "portfolio_snapshots",
        sa.Column("total_properties", sa.Numeric(14, 2), nullable=True, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("portfolio_snapshots", "total_properties")
    op.drop_table("property_snapshots")
    op.drop_table("property_investments")
