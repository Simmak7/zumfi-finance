"""Dashboard aggregation service.

Combines data from multiple features into a single summary endpoint
for the frontend dashboard.
"""

from decimal import Decimal
from datetime import datetime, date

from sqlalchemy import select, func, extract, case, literal_column
from sqlalchemy.ext.asyncio import AsyncSession

from features.statements.models import Transaction
from features.goals.models import Goal, GoalContribution
from features.auth.models import User
from features.categories.models import Category
from features.portfolio.models import PortfolioSnapshot
from features.bills.service import BillService
from features.goals.service import GoalService
from core.exchange_rates import get_rates_for_month, convert_amount


class DashboardService:
    @staticmethod
    async def get_last_data_month(db: AsyncSession, owner_id: int) -> str | None:
        """Return the latest YYYY-MM that has any financial data.

        Checks both transactions (from bank statements) and portfolio
        snapshots (from savings/stock statements that don't create
        transactions).  Returns the most recent month across both sources.
        """
        tx_result = await db.execute(
            select(func.max(Transaction.date)).where(
                Transaction.owner_id == owner_id,
            )
        )
        latest_tx = tx_result.scalar()

        snap_result = await db.execute(
            select(func.max(PortfolioSnapshot.snapshot_date)).where(
                PortfolioSnapshot.owner_id == owner_id,
                (PortfolioSnapshot.total_savings > 0)
                | (PortfolioSnapshot.total_investments > 0)
                | (PortfolioSnapshot.total_stocks > 0)
                | (PortfolioSnapshot.total_properties > 0),
            )
        )
        latest_snap = snap_result.scalar()

        candidates = [d for d in (latest_tx, latest_snap) if d is not None]
        if not candidates:
            return None
        latest_date = max(candidates)
        return f"{latest_date.year}-{latest_date.month:02d}"

    @staticmethod
    async def get_summary(db: AsyncSession, owner_id: int, month: str | None = None) -> dict:
        """Get dashboard summary with KPIs, category breakdown, and goals."""
        if not month:
            month = datetime.now().strftime("%Y-%m")

        year, mon = month.split("-")

        # Get user's preferred currency
        user_result = await db.execute(select(User).where(User.id == owner_id))
        user = user_result.scalar_one()
        preferred_currency = user.preferred_currency or "CZK"

        # Exchange rates for converting non-preferred currencies
        rates = await get_rates_for_month(db, month)

        def _conv(amount: float, cur: str) -> float:
            return convert_amount(amount, cur, preferred_currency, rates)

        # Total income for the month (all currencies, converted)
        income_result = await db.execute(
            select(
                Transaction.currency,
                func.coalesce(func.sum(Transaction.amount), 0),
            ).where(
                Transaction.owner_id == owner_id,
                Transaction.type == "income",
                Transaction.section != "in_and_out",
                extract("year", Transaction.date) == int(year),
                extract("month", Transaction.date) == int(mon),
            ).group_by(Transaction.currency)
        )
        total_income = sum(_conv(float(amt), cur) for cur, amt in income_result.all())

        # Total expenses for the month (all currencies, converted)
        expense_result = await db.execute(
            select(
                Transaction.currency,
                func.coalesce(func.sum(Transaction.amount), 0),
            ).where(
                Transaction.owner_id == owner_id,
                Transaction.type == "expense",
                Transaction.section != "in_and_out",
                extract("year", Transaction.date) == int(year),
                extract("month", Transaction.date) == int(mon),
            ).group_by(Transaction.currency)
        )
        total_expenses = sum(_conv(float(amt), cur) for cur, amt in expense_result.all())

        # Expense breakdown by category (all currencies, converted and merged)
        category_result = await db.execute(
            select(
                Transaction.category_name,
                Transaction.currency,
                func.sum(Transaction.amount).label("total"),
                Category.color,
            )
            .outerjoin(Category, Transaction.category_id == Category.id)
            .where(
                Transaction.owner_id == owner_id,
                Transaction.type == "expense",
                Transaction.section != "in_and_out",
                extract("year", Transaction.date) == int(year),
                extract("month", Transaction.date) == int(mon),
            )
            .group_by(Transaction.category_name, Transaction.currency, Category.color)
        )
        exp_map: dict[str, dict] = {}
        for row in category_result.all():
            cat = row.category_name or "Unknown"
            converted = _conv(float(row.total), row.currency)
            if cat in exp_map:
                exp_map[cat]["amount"] += converted
            else:
                exp_map[cat] = {"category": cat, "amount": converted, "color": row.color}
        expense_breakdown = sorted(exp_map.values(), key=lambda x: x["amount"], reverse=True)
        for item in expense_breakdown:
            item["amount"] = round(item["amount"], 2)

        # Income breakdown by category (all currencies, converted and merged)
        income_cat_result = await db.execute(
            select(
                Transaction.category_name,
                Transaction.currency,
                func.sum(Transaction.amount).label("total"),
                Category.color,
            )
            .outerjoin(Category, Transaction.category_id == Category.id)
            .where(
                Transaction.owner_id == owner_id,
                Transaction.type == "income",
                Transaction.section != "in_and_out",
                extract("year", Transaction.date) == int(year),
                extract("month", Transaction.date) == int(mon),
            )
            .group_by(Transaction.category_name, Transaction.currency, Category.color)
        )
        inc_map: dict[str, dict] = {}
        for row in income_cat_result.all():
            cat = row.category_name or "Unknown"
            converted = _conv(float(row.total), row.currency)
            if cat in inc_map:
                inc_map[cat]["amount"] += converted
            else:
                inc_map[cat] = {"category": cat, "amount": converted, "color": row.color}
        income_breakdown = list(inc_map.values())
        for item in income_breakdown:
            item["amount"] = round(item["amount"], 2)

        # Goals summary
        goals_result = await db.execute(
            select(Goal).where(Goal.owner_id == owner_id, Goal.status == "active")
        )
        goals = [
            {
                "id": g.id,
                "name": g.name,
                "target_amount": float(g.target_amount),
                "current_amount": float(g.current_amount),
                "color": g.color,
                "progress": round(
                    float(g.current_amount) / float(g.target_amount) * 100, 1
                ) if g.target_amount else 0,
            }
            for g in goals_result.scalars().all()
        ]

        # Transactions needing review
        review_result = await db.execute(
            select(func.count()).where(
                Transaction.owner_id == owner_id,
                Transaction.status == "review",
            )
        )
        review_count = review_result.scalar()

        savings_rate = (
            (total_income - total_expenses) / total_income * 100
            if total_income > 0
            else 0
        )

        # Already allocated to goals this month
        alloc_result = await db.execute(
            select(func.coalesce(func.sum(GoalContribution.amount), 0)).where(
                GoalContribution.owner_id == owner_id,
                GoalContribution.month == month,
            )
        )
        already_allocated = round(float(alloc_result.scalar()), 2)

        return {
            "month": month,
            "total_income": round(total_income, 2),
            "total_expenses": round(total_expenses, 2),
            "remaining_budget": round(total_income - total_expenses, 2),
            "already_allocated": already_allocated,
            "savings_rate": round(savings_rate, 1),
            "expense_breakdown": expense_breakdown,
            "income_breakdown": income_breakdown,
            "goals": goals,
            "review_count": review_count,
        }

    @staticmethod
    async def get_monthly_history(
        db: AsyncSession, owner_id: int, months: int = 6
    ) -> list[dict]:
        """Return income and expense totals per month for the last N months."""
        # Anchor to the last month with data, not today
        last_month_str = await DashboardService.get_last_data_month(db, owner_id)
        if last_month_str:
            anchor_year, anchor_month = int(last_month_str[:4]), int(last_month_str[5:7])
        else:
            now = datetime.now()
            anchor_year, anchor_month = now.year, now.month

        start_month = anchor_month - months + 1
        start_year = anchor_year
        while start_month <= 0:
            start_month += 12
            start_year -= 1
        start_date = date(start_year, start_month, 1)

        # Get user's preferred currency
        user_result = await db.execute(select(User).where(User.id == owner_id))
        user = user_result.scalar_one()
        preferred_currency = user.preferred_currency or "CZK"

        month_col = func.to_char(Transaction.date, "YYYY-MM").label("month")

        # Group by month AND currency so we can convert each currency's totals
        result = await db.execute(
            select(
                month_col,
                Transaction.currency,
                func.coalesce(
                    func.sum(
                        case(
                            (
                                (Transaction.type == "income") & (Transaction.section != "in_and_out"),
                                Transaction.amount,
                            ),
                            else_=0,
                        )
                    ),
                    0,
                ).label("total_income"),
                func.coalesce(
                    func.sum(
                        case(
                            (
                                (Transaction.type == "expense") & (Transaction.section != "in_and_out"),
                                Transaction.amount,
                            ),
                            else_=0,
                        )
                    ),
                    0,
                ).label("total_expenses"),
            )
            .where(
                Transaction.owner_id == owner_id,
                Transaction.section != "in_and_out",
                Transaction.date >= start_date,
            )
            .group_by(month_col, Transaction.currency)
            .order_by(month_col)
        )

        # Merge per-currency rows into per-month totals with conversion
        rates_cache: dict[str, dict] = {}
        month_totals: dict[str, dict] = {}
        for row in result.all():
            m_key = row.month
            cur = row.currency
            if m_key not in rates_cache:
                rates_cache[m_key] = await get_rates_for_month(db, m_key)
            rates = rates_cache[m_key]
            inc = convert_amount(float(row.total_income), cur, preferred_currency, rates)
            exp = convert_amount(float(row.total_expenses), cur, preferred_currency, rates)
            if m_key not in month_totals:
                month_totals[m_key] = {"total_income": 0.0, "total_expenses": 0.0}
            month_totals[m_key]["total_income"] += inc
            month_totals[m_key]["total_expenses"] += exp

        # Fill gaps so chart has continuous data points
        history = []
        y, m = start_year, start_month
        for _ in range(months):
            key = f"{y}-{m:02d}"
            if key in month_totals:
                history.append({
                    "month": key,
                    "total_income": round(month_totals[key]["total_income"], 2),
                    "total_expenses": round(month_totals[key]["total_expenses"], 2),
                })
            else:
                history.append({
                    "month": key,
                    "total_income": 0,
                    "total_expenses": 0,
                })
            m += 1
            if m > 12:
                m = 1
                y += 1

        return history

    @staticmethod
    async def get_category_trends(
        db: AsyncSession, owner_id: int, month: str | None = None, months: int = 12
    ) -> list[dict]:
        """Return monthly expense totals per category for the last N months."""
        if not month:
            month = datetime.now().strftime("%Y-%m")

        year, mon = int(month.split("-")[0]), int(month.split("-")[1])

        # Calculate start date going back N months from the selected month
        start_month = mon - months + 1
        start_year = year
        while start_month <= 0:
            start_month += 12
            start_year -= 1
        start_date = date(start_year, start_month, 1)

        # End date: last day of selected month
        end_month = mon + 1
        end_year = year
        if end_month > 12:
            end_month = 1
            end_year += 1
        end_date = date(end_year, end_month, 1)

        # Get user's preferred currency
        user_result = await db.execute(select(User).where(User.id == owner_id))
        user = user_result.scalar_one()
        preferred_currency = user.preferred_currency or "CZK"

        month_col = func.to_char(Transaction.date, "YYYY-MM").label("month")

        # Group by month, category, AND currency for cross-currency conversion
        result = await db.execute(
            select(
                month_col,
                Transaction.category_name,
                Transaction.currency,
                Category.color,
                func.sum(Transaction.amount).label("total"),
            )
            .outerjoin(Category, Transaction.category_id == Category.id)
            .where(
                Transaction.owner_id == owner_id,
                Transaction.type == "expense",
                Transaction.section != "in_and_out",
                Transaction.date >= start_date,
                Transaction.date < end_date,
            )
            .group_by(month_col, Transaction.category_name, Transaction.currency, Category.color)
            .order_by(month_col)
        )
        rows = result.all()

        # Build list of all months in range
        all_months = []
        y, m = start_year, start_month
        for _ in range(months):
            all_months.append(f"{y}-{m:02d}")
            m += 1
            if m > 12:
                m = 1
                y += 1

        # Group by category, converting each currency row to preferred
        rates_cache: dict[str, dict] = {}
        cat_map: dict[str, dict] = {}
        months_with_data: set[str] = set()
        for row in rows:
            cat_name = row.category_name or "Unknown"
            m_key = row.month
            if m_key not in rates_cache:
                rates_cache[m_key] = await get_rates_for_month(db, m_key)
            converted = convert_amount(float(row.total), row.currency, preferred_currency, rates_cache[m_key])
            if cat_name not in cat_map:
                cat_map[cat_name] = {"category": cat_name, "color": row.color, "months": {}}
            cat_map[cat_name]["months"][m_key] = cat_map[cat_name]["months"].get(m_key, 0) + converted
            months_with_data.add(m_key)

        # Rebuild month range: 12 months starting from first month with data
        if months_with_data:
            first_data_month = min(months_with_data)
            fy, fm = int(first_data_month.split("-")[0]), int(first_data_month.split("-")[1])
            all_months = []
            for _ in range(months):
                all_months.append(f"{fy}-{fm:02d}")
                fm += 1
                if fm > 12:
                    fm = 1
                    fy += 1

        # Build final response with all months filled
        categories = []
        for cat_name, info in cat_map.items():
            data = []
            for m_key in all_months:
                data.append({
                    "month": m_key,
                    "amount": round(info["months"].get(m_key, 0), 2),
                })
            categories.append({
                "category": info["category"],
                "color": info["color"],
                "data": data,
            })

        # Sort by total descending
        categories.sort(key=lambda c: sum(d["amount"] for d in c["data"]), reverse=True)
        return categories

    @staticmethod
    async def get_month_close_data(db: AsyncSession, owner_id: int, month: str) -> dict:
        """Aggregate all data needed for end-of-month close wizard."""
        # Core summary
        summary = await DashboardService.get_summary(db, owner_id, month)

        # Bills status
        try:
            bill_statuses = await BillService.get_status_for_month(db, owner_id, month)
            bills = [
                {
                    "id": bs.get("bill", {}).get("id") if isinstance(bs, dict) else bs.bill_id,
                    "name": bs.get("bill", {}).get("name", "") if isinstance(bs, dict) else getattr(bs, "name", ""),
                    "expected_amount": float(bs.get("bill", {}).get("expected_amount", 0)) if isinstance(bs, dict) else 0,
                    "due_day": bs.get("bill", {}).get("due_day") if isinstance(bs, dict) else None,
                    "status": bs.get("status", "pending") if isinstance(bs, dict) else getattr(bs, "status", "pending"),
                    "paid_amount": float(bs.get("paid_amount", 0) or 0) if isinstance(bs, dict) else 0,
                }
                for bs in bill_statuses
            ]
        except Exception:
            bills = []

        # Surplus and allocation suggestions
        try:
            surplus = await GoalService.get_surplus(db, owner_id, month)
        except Exception:
            surplus = {"available_surplus": 0, "total_income": 0, "total_expenses": 0, "already_allocated": 0}

        try:
            suggestions = await GoalService.suggest_allocation(db, owner_id, month)
        except Exception:
            suggestions = []

        return {
            "month": month,
            "summary": {
                "total_income": summary["total_income"],
                "total_expenses": summary["total_expenses"],
                "remaining_budget": summary["remaining_budget"],
                "savings_rate": summary["savings_rate"],
            },
            "review_count": summary.get("review_count", 0),
            "bills": bills,
            "surplus": surplus if isinstance(surplus, dict) else {
                "available_surplus": float(getattr(surplus, "available_surplus", 0)),
                "total_income": float(getattr(surplus, "total_income", 0)),
                "total_expenses": float(getattr(surplus, "total_expenses", 0)),
                "already_allocated": float(getattr(surplus, "already_allocated", 0)),
            },
            "allocation_suggestions": suggestions,
        }
