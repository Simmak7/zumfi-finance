"""Unify category sections: merge duplicates, collapse income/expense to general.

Revision ID: 0012
Revises: 0011
Create Date: 2026-02-10
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0012"
down_revision: Union[str, None] = "0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # Step 1: Find and merge duplicate category names per owner
    # For each group of duplicates, keep the one with a color (or lowest ID)
    dupes = conn.execute(sa.text("""
        SELECT owner_id, name,
               array_agg(id ORDER BY (color IS NOT NULL AND color != '') DESC, id ASC) AS ids
        FROM categories
        WHERE section != 'in_and_out'
        GROUP BY owner_id, name
        HAVING COUNT(*) > 1
    """)).fetchall()

    for row in dupes:
        ids = row[2]  # list of category IDs
        winner_id = ids[0]
        loser_ids = ids[1:]

        for loser_id in loser_ids:
            # Reassign transactions
            conn.execute(sa.text(
                "UPDATE transactions SET category_id = :winner WHERE category_id = :loser"
            ), {"winner": winner_id, "loser": loser_id})

            # Reassign category_mappings (handle keyword uniqueness conflicts)
            # First delete mappings that would conflict
            conn.execute(sa.text("""
                DELETE FROM category_mappings
                WHERE category_id = :loser
                AND keyword IN (
                    SELECT keyword FROM category_mappings WHERE category_id = :winner
                )
            """), {"winner": winner_id, "loser": loser_id})

            # Then reassign remaining mappings
            conn.execute(sa.text(
                "UPDATE category_mappings SET category_id = :winner WHERE category_id = :loser"
            ), {"winner": winner_id, "loser": loser_id})

            # Reassign budgets (handle month uniqueness conflicts)
            conn.execute(sa.text("""
                DELETE FROM budgets
                WHERE category_id = :loser
                AND month IN (
                    SELECT month FROM budgets WHERE category_id = :winner
                )
            """), {"winner": winner_id, "loser": loser_id})
            conn.execute(sa.text(
                "UPDATE budgets SET category_id = :winner WHERE category_id = :loser"
            ), {"winner": winner_id, "loser": loser_id})

            # Delete the loser category
            conn.execute(sa.text(
                "DELETE FROM categories WHERE id = :loser"
            ), {"loser": loser_id})

    # Step 2: Update all non-in_and_out category sections to 'general'
    conn.execute(sa.text(
        "UPDATE categories SET section = 'general' WHERE section IN ('income', 'expense')"
    ))

    # Step 3: Swap the unique constraint
    op.drop_constraint("uq_category_owner_name_section", "categories", type_="unique")
    op.create_unique_constraint("uq_category_owner_name", "categories", ["owner_id", "name"])


def downgrade() -> None:
    # Reverse the constraint change
    op.drop_constraint("uq_category_owner_name", "categories", type_="unique")
    op.create_unique_constraint(
        "uq_category_owner_name_section", "categories", ["owner_id", "name", "section"]
    )

    # Set general back to expense (lossy — cannot un-merge)
    conn = op.get_bind()
    conn.execute(sa.text(
        "UPDATE categories SET section = 'expense' WHERE section = 'general'"
    ))
