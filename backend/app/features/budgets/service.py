from collections import defaultdict
from datetime import date
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import select, func, extract, and_, cast, String
from sqlalchemy.ext.asyncio import AsyncSession

from features.budgets.models import Budget
from features.categories.models import Category
from features.statements.models import Transaction


class BudgetService:
    @staticmethod
    async def get_by_month(
        db: AsyncSession, owner_id: int, month: str
    ) -> list[Budget]:
        return await _get_effective_budgets(db, owner_id, month)

    @staticmethod
    async def create_or_update(
        db: AsyncSession, owner_id: int,
        category_id: int, month: str, planned_amount: Decimal,
    ) -> Budget:
        # Check if budget already exists for this category+month
        result = await db.execute(
            select(Budget).where(
                Budget.owner_id == owner_id,
                Budget.category_id == category_id,
                Budget.month == month,
            )
        )
        budget = result.scalar_one_or_none()

        if budget:
            budget.planned_amount = planned_amount
        else:
            budget = Budget(
                owner_id=owner_id,
                category_id=category_id,
                month=month,
                planned_amount=planned_amount,
            )
            db.add(budget)

        await db.flush()
        await db.refresh(budget)
        return budget

    @staticmethod
    async def delete(
        db: AsyncSession, owner_id: int, budget_id: int
    ) -> bool:
        result = await db.execute(
            select(Budget).where(
                Budget.id == budget_id,
                Budget.owner_id == owner_id,
            )
        )
        budget = result.scalar_one_or_none()
        if not budget:
            raise HTTPException(status_code=404, detail="Budget not found")

        await db.delete(budget)
        await db.flush()
        return True

    @staticmethod
    async def delete_by_category(
        db: AsyncSession, owner_id: int, category_id: int, month: str
    ) -> bool:
        """Remove a budget for a category from this month forward.

        Creates a record with planned_amount=0 so future months inherit
        'no budget' instead of falling back to an earlier value.
        """
        result = await db.execute(
            select(Budget).where(
                Budget.owner_id == owner_id,
                Budget.category_id == category_id,
                Budget.month == month,
            )
        )
        budget = result.scalar_one_or_none()

        if budget:
            budget.planned_amount = Decimal("0")
        else:
            budget = Budget(
                owner_id=owner_id,
                category_id=category_id,
                month=month,
                planned_amount=Decimal("0"),
            )
            db.add(budget)

        await db.flush()
        return True

    @staticmethod
    async def get_summary(
        db: AsyncSession, owner_id: int, month: str
    ) -> dict:
        """Planned vs actual spending per category for a month.

        Uses inheritance: each category's budget is the most recent record
        at or before the requested month.
        """
        year, mon = month.split("-")

        # Load effective budgets (inherited or explicit)
        budgets = await _get_effective_budgets(db, owner_id, month)

        # Load category names for budget categories
        cat_ids = [b.category_id for b in budgets]
        cat_names = {}
        if cat_ids:
            cat_result = await db.execute(
                select(Category).where(Category.id.in_(cat_ids))
            )
            for c in cat_result.scalars().all():
                cat_names[c.id] = c.name

        # Actual spending grouped by category_name (transactions use name, not id)
        spending_result = await db.execute(
            select(
                Transaction.category_name,
                func.coalesce(func.sum(Transaction.amount), 0).label("total"),
            )
            .where(
                Transaction.owner_id == owner_id,
                Transaction.type == "expense",
                Transaction.section != "in_and_out",
                extract("year", Transaction.date) == int(year),
                extract("month", Transaction.date) == int(mon),
            )
            .group_by(Transaction.category_name)
        )
        actual_by_name = {
            row.category_name: Decimal(str(row.total))
            for row in spending_result.all()
            if row.category_name
        }

        # Build summary items
        items = []
        total_planned = Decimal("0")
        total_actual = Decimal("0")

        for b in budgets:
            name = cat_names.get(b.category_id, "Unknown")
            actual = actual_by_name.get(name, Decimal("0"))
            remaining = b.planned_amount - actual
            pct = (
                float(actual / b.planned_amount * 100)
                if b.planned_amount > 0 else 0.0
            )
            items.append({
                "category_id": b.category_id,
                "category_name": name,
                "section": "expense",
                "planned_amount": b.planned_amount,
                "actual_amount": actual,
                "remaining": remaining,
                "percent_used": round(pct, 1),
                "is_inherited": b.month != month,
            })
            total_planned += b.planned_amount
            total_actual += actual

        return {
            "month": month,
            "total_planned": total_planned,
            "total_actual": total_actual,
            "categories": items,
        }

    @staticmethod
    async def copy_from_previous(
        db: AsyncSession, owner_id: int, month: str
    ) -> list[Budget]:
        """Copy budget allocations from the previous month."""
        prev_month = _previous_month(month)

        prev_budgets = await db.execute(
            select(Budget).where(
                Budget.owner_id == owner_id,
                Budget.month == prev_month,
            )
        )

        created = []
        for pb in prev_budgets.scalars().all():
            # Skip if already exists for new month
            existing = await db.execute(
                select(Budget).where(
                    Budget.owner_id == owner_id,
                    Budget.category_id == pb.category_id,
                    Budget.month == month,
                )
            )
            if existing.scalar_one_or_none():
                continue

            new_budget = Budget(
                owner_id=owner_id,
                category_id=pb.category_id,
                month=month,
                planned_amount=pb.planned_amount,
            )
            db.add(new_budget)
            created.append(new_budget)

        await db.flush()
        for b in created:
            await db.refresh(b)
        return created

    @staticmethod
    async def suggest_from_average(
        db: AsyncSession, owner_id: int, months: int = 3
    ) -> list[dict]:
        """Suggest budget amounts based on average spending over N months."""
        today = date.today()
        # Build list of month strings to look back
        month_strs = []
        y, m = today.year, today.month
        for _ in range(months):
            m -= 1
            if m == 0:
                m = 12
                y -= 1
            month_strs.append(f"{y:04d}-{m:02d}")

        if not month_strs:
            return []

        # Build date range for the query
        earliest = date(int(month_strs[-1][:4]), int(month_strs[-1][5:]), 1)

        # Group by category_name (transactions use name, not id)
        spending_result = await db.execute(
            select(
                Transaction.category_name,
                func.sum(Transaction.amount).label("total"),
            )
            .where(
                Transaction.owner_id == owner_id,
                Transaction.type == "expense",
                Transaction.section != "in_and_out",
                Transaction.date >= earliest,
                Transaction.date < date(today.year, today.month, 1),
                Transaction.category_name.isnot(None),
                Transaction.category_name != "Unknown",
            )
            .group_by(Transaction.category_name)
        )

        # Load category info (name → category)
        cat_result = await db.execute(
            select(Category).where(Category.owner_id == owner_id)
        )
        cats_by_name = {c.name: c for c in cat_result.scalars().all()}

        suggestions = []
        for row in spending_result.all():
            cat = cats_by_name.get(row.category_name)
            if not cat:
                continue
            avg = Decimal(str(row.total)) / months
            suggestions.append({
                "category_id": cat.id,
                "category_name": cat.name,
                "section": cat.section,
                "suggested_amount": round(avg, 2),
                "avg_months": months,
            })

        suggestions.sort(key=lambda x: x["suggested_amount"], reverse=True)
        return suggestions

    @staticmethod
    async def smart_suggest(
        db: AsyncSession, owner_id: int, months: int = 6
    ) -> dict:
        """AI-enhanced budget suggestions with trends and 50/30/20 rule."""
        today = date.today()

        # Build month strings for lookback
        month_strs = []
        y, m = today.year, today.month
        for _ in range(months):
            m -= 1
            if m == 0:
                m = 12
                y -= 1
            month_strs.append(f"{y:04d}-{m:02d}")

        if not month_strs:
            return _empty_smart_response()

        earliest = date(int(month_strs[-1][:4]), int(month_strs[-1][5:]), 1)
        current_month_start = date(today.year, today.month, 1)

        # --- Average monthly income ---
        income_result = await db.execute(
            select(
                extract("year", Transaction.date).label("yr"),
                extract("month", Transaction.date).label("mn"),
                func.sum(Transaction.amount).label("total"),
            )
            .where(
                Transaction.owner_id == owner_id,
                Transaction.type == "income",
                Transaction.section != "in_and_out",
                Transaction.date >= earliest,
                Transaction.date < current_month_start,
            )
            .group_by("yr", "mn")
        )
        income_rows = income_result.all()
        total_income_sum = sum(Decimal(str(r.total)) for r in income_rows)
        income_months_count = len(income_rows) or 1
        avg_income = total_income_sum / income_months_count

        # --- Per-category monthly spending ---
        spending_result = await db.execute(
            select(
                Transaction.category_name,
                extract("year", Transaction.date).label("yr"),
                extract("month", Transaction.date).label("mn"),
                func.sum(Transaction.amount).label("total"),
            )
            .where(
                Transaction.owner_id == owner_id,
                Transaction.type == "expense",
                Transaction.section != "in_and_out",
                Transaction.date >= earliest,
                Transaction.date < current_month_start,
                Transaction.category_name.isnot(None),
                Transaction.category_name != "Unknown",
            )
            .group_by(Transaction.category_name, "yr", "mn")
        )

        # Build per-category monthly history
        cat_monthly: dict[str, dict[str, Decimal]] = defaultdict(dict)
        for row in spending_result.all():
            ms = f"{int(row.yr):04d}-{int(row.mn):02d}"
            cat_monthly[row.category_name][ms] = Decimal(str(row.total))

        # --- Load categories ---
        cat_result = await db.execute(
            select(Category).where(Category.owner_id == owner_id)
        )
        cats_by_name = {c.name: c for c in cat_result.scalars().all()}

        # --- Load current effective budgets ---
        current_month = f"{today.year:04d}-{today.month:02d}"
        effective = await _get_effective_budgets(db, owner_id, current_month)
        current_budgets = {b.category_id: b.planned_amount for b in effective}

        # --- Classify and compute suggestions ---
        needs_names = {
            "groceries", "transport", "mortgage", "electricity", "water",
            "gas", "phone", "internet", "insurance", "rent", "fixed bills",
            "our flat",
        }
        savings_names = {"saving account", "savings", "investment"}

        suggestions = []
        cat_totals = {"needs": Decimal("0"), "wants": Decimal("0"), "savings": Decimal("0")}

        for cat_name, monthly_data in cat_monthly.items():
            cat = cats_by_name.get(cat_name)
            if not cat:
                continue

            # Monthly amounts ordered chronologically
            amounts = [monthly_data.get(ms, Decimal("0")) for ms in reversed(month_strs)]
            avg_amount = sum(amounts) / len(amounts) if amounts else Decimal("0")
            nonzero = [a for a in amounts if a > 0]
            latest = nonzero[-1] if nonzero else Decimal("0")

            # Trend: compare last 2 months avg to overall avg
            recent = amounts[-2:] if len(amounts) >= 2 else amounts
            recent_avg = sum(recent) / len(recent) if recent else Decimal("0")
            change_pct = (
                float((recent_avg - avg_amount) / avg_amount * 100)
                if avg_amount > 0 else 0.0
            )
            if change_pct > 15:
                direction = "increasing"
            elif change_pct < -15:
                direction = "decreasing"
            else:
                direction = "stable"

            # 50/30/20 classification
            lower = cat_name.lower()
            if cat.section == "fixed" or lower in needs_names:
                rule_cat = "needs"
            elif lower in savings_names or cat.section == "in_and_out":
                rule_cat = "savings"
            else:
                rule_cat = "wants"

            cat_totals[rule_cat] += avg_amount
            suggestions.append({
                "cat": cat,
                "avg_amount": avg_amount,
                "latest": latest,
                "amounts": amounts,
                "direction": direction,
                "change_pct": round(change_pct, 1),
                "rule_cat": rule_cat,
            })

        # --- Apply 50/30/20 ideal allocations ---
        ideal = {
            "needs": avg_income * Decimal("0.50"),
            "wants": avg_income * Decimal("0.30"),
            "savings": avg_income * Decimal("0.20"),
        }

        total_actual_spending = sum(cat_totals.values())

        result_items = []
        for s in suggestions:
            cat = s["cat"]
            pool = ideal[s["rule_cat"]]
            group_total = cat_totals[s["rule_cat"]]

            # Proportional allocation within the group
            if group_total > 0:
                ratio = s["avg_amount"] / group_total
                suggested = round(pool * ratio, -1)  # Round to nearest 10
            else:
                suggested = round(s["avg_amount"], -1)

            suggested = max(suggested, Decimal("0"))
            actual_ratio = (
                float(s["avg_amount"] / avg_income * 100) if avg_income > 0 else 0.0
            )
            ideal_ratio = (
                float(suggested / avg_income * 100) if avg_income > 0 else 0.0
            )

            # Generate reasoning
            direction_text = {
                "increasing": "trending up",
                "decreasing": "trending down",
                "stable": "stable",
            }[s["direction"]]
            rule_label = {"needs": "Needs (50%)", "wants": "Wants (30%)", "savings": "Savings (20%)"}
            reasoning = (
                f"Average spend: {s['avg_amount']:.0f}/mo ({direction_text}). "
                f"Category: {rule_label[s['rule_cat']]}. "
            )
            if suggested > s["avg_amount"]:
                reasoning += f"You have room to spend up to {suggested:.0f}."
            elif suggested < s["avg_amount"]:
                reasoning += f"Consider reducing to {suggested:.0f} to stay within healthy limits."
            else:
                reasoning += "Your spending is well-balanced."

            result_items.append({
                "category_id": cat.id,
                "category_name": cat.name,
                "section": cat.section,
                "suggested_amount": suggested,
                "current_budget": current_budgets.get(cat.id),
                "trend": {
                    "direction": s["direction"],
                    "monthly_amounts": s["amounts"],
                    "avg_amount": round(s["avg_amount"], 2),
                    "latest_amount": s["latest"],
                    "change_pct": s["change_pct"],
                },
                "rule_category": s["rule_cat"],
                "ideal_ratio_pct": round(ideal_ratio, 1),
                "actual_ratio_pct": round(actual_ratio, 1),
                "reasoning": reasoning,
            })

        result_items.sort(key=lambda x: x["suggested_amount"], reverse=True)

        return {
            "total_income": round(avg_income, 2),
            "recommended_total_budget": round(avg_income * Decimal("0.80"), 2),
            "needs_budget": round(ideal["needs"], 2),
            "wants_budget": round(ideal["wants"], 2),
            "savings_budget": round(ideal["savings"], 2),
            "suggestions": result_items,
        }


def _empty_smart_response() -> dict:
    z = Decimal("0")
    return {
        "total_income": z, "recommended_total_budget": z,
        "needs_budget": z, "wants_budget": z, "savings_budget": z,
        "suggestions": [],
    }


async def _get_effective_budgets(
    db: AsyncSession, owner_id: int, month: str
) -> list[Budget]:
    """Get the effective budget for each category at a given month.

    For each category, finds the most recent budget record with month <= target.
    Filters out records with planned_amount <= 0 (deleted budgets).
    """
    # Subquery: for each category, find the latest month <= target
    subq = (
        select(
            Budget.category_id,
            func.max(Budget.month).label("effective_month"),
        )
        .where(
            Budget.owner_id == owner_id,
            Budget.month <= month,
        )
        .group_by(Budget.category_id)
        .subquery()
    )

    # Join to get the actual budget records
    result = await db.execute(
        select(Budget).join(
            subq,
            and_(
                Budget.category_id == subq.c.category_id,
                Budget.month == subq.c.effective_month,
                Budget.owner_id == owner_id,
            ),
        )
    )
    budgets = list(result.scalars().all())

    # Filter out zero-amount entries (represent "deleted" budgets)
    return [b for b in budgets if b.planned_amount > 0]


def _previous_month(month: str) -> str:
    """Get the previous month string. '2026-01' -> '2025-12'."""
    y, m = int(month[:4]), int(month[5:])
    m -= 1
    if m == 0:
        m = 12
        y -= 1
    return f"{y:04d}-{m:02d}"
