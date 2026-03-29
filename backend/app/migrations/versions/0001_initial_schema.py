"""Initial schema -- baseline for existing tables.

Revision ID: 0001
Revises: None
Create Date: 2026-02-07
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(table_name: str) -> bool:
    """Check if a table already exists in the database."""
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT EXISTS ("
            "  SELECT 1 FROM information_schema.tables "
            "  WHERE table_name = :name"
            ")"
        ),
        {"name": table_name},
    )
    return result.scalar()


def upgrade() -> None:
    if _table_exists("users"):
        # Tables already created by create_all -- skip creation
        return

    # --- users ---
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("display_name", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_users_id", "users", ["id"])
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # --- categories ---
    op.create_table(
        "categories",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("section", sa.String(20), nullable=False),
        sa.Column("icon", sa.String(50), nullable=True),
        sa.Column("color", sa.String(7), nullable=True),
        sa.UniqueConstraint("owner_id", "name", "section", name="uq_category_owner_name_section"),
    )
    op.create_index("ix_categories_id", "categories", ["id"])

    # --- category_mappings ---
    op.create_table(
        "category_mappings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("category_id", sa.Integer(), sa.ForeignKey("categories.id"), nullable=False),
        sa.Column("keyword", sa.String(255), nullable=False),
        sa.Column("match_type", sa.String(20), server_default="substring"),
        sa.UniqueConstraint("owner_id", "keyword", name="uq_mapping_owner_keyword"),
    )
    op.create_index("ix_category_mappings_id", "category_mappings", ["id"])

    # --- statements ---
    op.create_table(
        "statements",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("upload_date", sa.DateTime(timezone=True)),
        sa.Column("period_start", sa.Date(), nullable=True),
        sa.Column("period_end", sa.Date(), nullable=True),
        sa.Column("bank_name", sa.String(100), nullable=True),
        sa.Column("status", sa.String(20), server_default="processing"),
    )
    op.create_index("ix_statements_id", "statements", ["id"])
    op.create_index("idx_statements_owner", "statements", ["owner_id"])

    # --- transactions ---
    op.create_table(
        "transactions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("statement_id", sa.Integer(), sa.ForeignKey("statements.id"), nullable=True),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("original_description", sa.Text(), nullable=True),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("type", sa.String(10), nullable=False),
        sa.Column("category_id", sa.Integer(), sa.ForeignKey("categories.id"), nullable=True),
        sa.Column("category_name", sa.String(100), nullable=True),
        sa.Column("section", sa.String(20), nullable=True),
        sa.Column("status", sa.String(20), server_default="review"),
        sa.Column("confidence", sa.Numeric(3, 2), nullable=True),
        sa.Column("ai_suggested_category", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_transactions_id", "transactions", ["id"])
    op.create_index("idx_transactions_owner_date", "transactions", ["owner_id", "date"])
    op.create_index("idx_transactions_category", "transactions", ["category_id"])
    op.create_index("idx_transactions_status", "transactions", ["owner_id", "status"])

    # --- goals ---
    op.create_table(
        "goals",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("target_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("current_amount", sa.Numeric(12, 2), server_default="0"),
        sa.Column("color", sa.String(7), nullable=True),
        sa.Column("deadline", sa.Date(), nullable=True),
        sa.Column("status", sa.String(20), server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_goals_id", "goals", ["id"])


def downgrade() -> None:
    op.drop_table("goals")
    op.drop_table("transactions")
    op.drop_table("statements")
    op.drop_table("category_mappings")
    op.drop_table("categories")
    op.drop_table("users")
