"""Analytics engine for financial insights.

Migrated from legacy backend/analysis.py with improvements:
- Queries PostgreSQL instead of reloading JSON every call
- Owner-scoped queries
- Cleaner date handling (native date objects)
"""

import statistics
from datetime import datetime, date
from collections import defaultdict
from decimal import Decimal

from sqlalchemy import select, func, extract
from sqlalchemy.ext.asyncio import AsyncSession

from features.statements.models import Transaction
from features.auth.models import User


class AnalysisService:
    @staticmethod
    async def get_monthly_trends(db: AsyncSession, owner_id: int) -> list[dict]:
        """Spending per category: current month vs historical average."""
        result = await db.execute(
            select(Transaction).where(
                Transaction.owner_id == owner_id,
                Transaction.type == "expense",
                Transaction.section != "in_and_out",
                Transaction.category_name != "Unknown",
            )
        )
        txs = result.scalars().all()
        if not txs:
            return []

        now = datetime.now()
        current_month = now.strftime("%Y-%m")

        monthly_cat_sums: dict[tuple[str, str], float] = {}
        for tx in txs:
            month_str = tx.date.strftime("%Y-%m")
            cat = tx.category_name or "Unknown"
            key = (month_str, cat)
            monthly_cat_sums[key] = monthly_cat_sums.get(key, 0) + float(tx.amount)

        current_spending: dict[str, float] = {}
        history_spending: dict[str, list[float]] = defaultdict(list)

        for (m, cat), amount in monthly_cat_sums.items():
            if m == current_month:
                current_spending[cat] = amount
            else:
                history_spending[cat].append(amount)

        trends = []
        for cat, current_amount in current_spending.items():
            history = history_spending.get(cat, [])
            avg = sum(history) / len(history) if history else 0
            diff_percent = ((current_amount - avg) / avg * 100) if avg > 0 else 0

            trends.append({
                "category": cat,
                "current": round(current_amount, 2),
                "average": round(avg, 2),
                "diff_percent": round(diff_percent, 1),
            })

        return trends

    # ── Anomaly Detection ──────────────────────────────────────────

    @staticmethod
    async def _fetch_anomaly_context(
        db: AsyncSession, owner_id: int, month: str
    ) -> dict:
        """Fetch all data needed by anomaly detectors in minimal queries."""
        year, mon = int(month.split("-")[0]), int(month.split("-")[1])

        # 6 months back for baseline
        start_m, start_y = mon - 6, year
        while start_m <= 0:
            start_m += 12
            start_y -= 1
        start_date = date(start_y, start_m, 1)

        end_m, end_y = mon + 1, year
        if end_m > 12:
            end_m = 1
            end_y += 1
        end_date = date(end_y, end_m, 1)

        # Get preferred currency
        user_result = await db.execute(select(User).where(User.id == owner_id))
        user = user_result.scalar_one()
        currency = user.preferred_currency or "CZK"

        month_col = func.to_char(Transaction.date, "YYYY-MM").label("month")

        # Query 1: monthly aggregates by type + category
        agg_result = await db.execute(
            select(
                month_col,
                Transaction.type,
                Transaction.category_name,
                func.sum(Transaction.amount).label("total"),
            )
            .where(
                Transaction.owner_id == owner_id,
                Transaction.section != "in_and_out",
                Transaction.currency == currency,
                Transaction.date >= start_date,
                Transaction.date < end_date,
            )
            .group_by(month_col, Transaction.type, Transaction.category_name)
        )
        rows = agg_result.all()

        # Query 2: top expense transactions for the selected month
        tx_result = await db.execute(
            select(Transaction)
            .where(
                Transaction.owner_id == owner_id,
                Transaction.type == "expense",
                Transaction.section != "in_and_out",
                Transaction.currency == currency,
                extract("year", Transaction.date) == year,
                extract("month", Transaction.date) == mon,
            )
            .order_by(Transaction.amount.desc())
            .limit(10)
        )
        top_txs = tx_result.scalars().all()

        # Parse aggregates into per-month buckets
        month_income: dict[str, float] = defaultdict(float)
        month_expense: dict[str, float] = defaultdict(float)
        month_cat_expense: dict[str, dict[str, float]] = defaultdict(
            lambda: defaultdict(float)
        )

        for row in rows:
            m_key = row.month
            cat = row.category_name or "Unknown"
            amount = float(row.total)
            if row.type == "income":
                month_income[m_key] += amount
            elif row.type == "expense":
                month_expense[m_key] += amount
                month_cat_expense[m_key][cat] += amount

        # Split current month vs history
        cur_exp_by_cat: dict[str, float] = {}
        hist_exp_by_cat: dict[str, list[float]] = defaultdict(list)
        hist_monthly_income: list[float] = []
        hist_monthly_expenses: list[float] = []
        cur_income = 0.0
        cur_expenses = 0.0

        for m_key in sorted(month_income.keys() | month_expense.keys()):
            if m_key == month:
                cur_income = month_income.get(m_key, 0)
                cur_expenses = month_expense.get(m_key, 0)
                cur_exp_by_cat = dict(month_cat_expense.get(m_key, {}))
            else:
                hist_monthly_income.append(month_income.get(m_key, 0))
                hist_monthly_expenses.append(month_expense.get(m_key, 0))
                for cat, amt in month_cat_expense.get(m_key, {}).items():
                    hist_exp_by_cat[cat].append(amt)

        return {
            "month": month,
            "cur_exp_by_cat": cur_exp_by_cat,
            "hist_exp_by_cat": dict(hist_exp_by_cat),
            "cur_income": cur_income,
            "cur_expenses": cur_expenses,
            "hist_monthly_income": hist_monthly_income,
            "hist_monthly_expenses": hist_monthly_expenses,
            "top_transactions": top_txs,
        }

    @staticmethod
    def _detect_category_spikes(ctx: dict) -> list[dict]:
        anomalies = []
        for cat, current in ctx["cur_exp_by_cat"].items():
            history = ctx["hist_exp_by_cat"].get(cat, [])
            if len(history) < 2:
                continue
            avg = statistics.mean(history)
            if avg <= 0:
                continue
            pct = (current - avg) / avg * 100
            if pct > 50 and (current - avg) > 500:
                anomalies.append({
                    "type": "category_spike",
                    "description": f"{cat} spending rose {round(pct)}%",
                    "amount": round(current, 2),
                    "category": cat,
                    "reason": f"Avg: {avg:,.0f}, this month: {current:,.0f}",
                    "severity": min(100, pct * 0.5),
                })
        return anomalies

    @staticmethod
    def _detect_deficit(ctx: dict) -> list[dict]:
        if ctx["cur_income"] <= 0:
            return []
        deficit = ctx["cur_expenses"] - ctx["cur_income"]
        if deficit <= 0:
            return []
        severity = min(100, (deficit / ctx["cur_income"]) * 100)
        return [{
            "type": "deficit",
            "description": "You spent more than you earned",
            "amount": round(deficit, 2),
            "category": None,
            "reason": (
                f"Income: {ctx['cur_income']:,.0f}, "
                f"Expenses: {ctx['cur_expenses']:,.0f}"
            ),
            "severity": severity,
        }]

    @staticmethod
    def _detect_savings_crash(ctx: dict) -> list[dict]:
        if ctx["cur_income"] <= 0:
            return []
        cur_rate = (
            (ctx["cur_income"] - ctx["cur_expenses"]) / ctx["cur_income"] * 100
        )
        hist_rates = []
        for inc, exp in zip(
            ctx["hist_monthly_income"], ctx["hist_monthly_expenses"]
        ):
            if inc > 0:
                hist_rates.append((inc - exp) / inc * 100)
        if len(hist_rates) < 2:
            return []
        avg_rate = statistics.mean(hist_rates)
        drop = avg_rate - cur_rate
        if drop <= 15:
            return []
        return [{
            "type": "savings_crash",
            "description": (
                f"Savings rate dropped to {cur_rate:.0f}% "
                f"(avg {avg_rate:.0f}%)"
            ),
            "amount": round(drop / 100 * ctx["cur_income"], 2),
            "category": None,
            "reason": f"You saved {drop:.0f}pp less than usual",
            "severity": min(100, drop * 2),
        }]

    @staticmethod
    def _detect_spending_spike(ctx: dict) -> list[dict]:
        history = ctx["hist_monthly_expenses"]
        if len(history) < 2:
            return []
        avg = statistics.mean(history)
        if avg <= 0:
            return []
        pct = (ctx["cur_expenses"] - avg) / avg * 100
        if pct <= 30:
            return []
        return [{
            "type": "spending_spike",
            "description": f"Overall spending is {round(pct)}% above average",
            "amount": round(ctx["cur_expenses"], 2),
            "category": None,
            "reason": f"Avg: {avg:,.0f}, this month: {ctx['cur_expenses']:,.0f}",
            "severity": min(100, pct * 0.6),
        }]

    @staticmethod
    def _detect_large_transactions(ctx: dict) -> list[dict]:
        anomalies = []
        for tx in ctx["top_transactions"]:
            cat = tx.category_name or "Unknown"
            history = ctx["hist_exp_by_cat"].get(cat, [])
            if len(history) < 2:
                continue
            cat_avg = statistics.mean(history)
            if cat_avg <= 0:
                continue
            amt = float(tx.amount)
            if amt > 2 * cat_avg and amt > 1000:
                anomalies.append({
                    "type": "large_transaction",
                    "description": (tx.description or "Transaction")[:60],
                    "amount": round(amt, 2),
                    "category": cat,
                    "reason": (
                        f"{amt / cat_avg:.1f}x the typical monthly "
                        f"spend for {cat}"
                    ),
                    "severity": min(80, (amt / cat_avg - 1) * 30),
                })
        return anomalies

    @staticmethod
    async def detect_anomalies(
        db: AsyncSession, owner_id: int, month: str | None = None
    ) -> list[dict]:
        """Detect unusual financial activities for a given month."""
        if not month:
            month = datetime.now().strftime("%Y-%m")

        ctx = await AnalysisService._fetch_anomaly_context(db, owner_id, month)

        all_anomalies = []
        all_anomalies.extend(AnalysisService._detect_category_spikes(ctx))
        all_anomalies.extend(AnalysisService._detect_deficit(ctx))
        all_anomalies.extend(AnalysisService._detect_savings_crash(ctx))
        all_anomalies.extend(AnalysisService._detect_spending_spike(ctx))
        all_anomalies.extend(AnalysisService._detect_large_transactions(ctx))

        # Dedup: skip large_transaction if category already in a spike
        spike_cats = {
            a["category"] for a in all_anomalies if a["type"] == "category_spike"
        }
        all_anomalies = [
            a for a in all_anomalies
            if not (a["type"] == "large_transaction" and a["category"] in spike_cats)
        ]

        all_anomalies.sort(key=lambda a: a["severity"], reverse=True)
        return all_anomalies[:3]

    # ── Other Analytics ────────────────────────────────────────────

    @staticmethod
    async def detect_recurring(db: AsyncSession, owner_id: int) -> list[dict]:
        """Identify subscriptions: same desc, similar amount, 2+ months."""
        result = await db.execute(
            select(Transaction).where(
                Transaction.owner_id == owner_id,
                Transaction.type == "expense",
                Transaction.section != "in_and_out",
            )
        )
        txs = result.scalars().all()

        groups: dict[str, list] = defaultdict(list)
        for tx in txs:
            groups[tx.description.lower()].append(tx)

        recurring = []
        for desc, group in groups.items():
            if len(group) < 2:
                continue
            months = set(tx.date.strftime("%Y-%m") for tx in group)
            if len(months) < 2:
                continue
            amounts = [float(tx.amount) for tx in group]
            avg = sum(amounts) / len(amounts)
            if avg > 0 and all(abs(a - avg) / avg < 0.1 for a in amounts):
                recurring.append({
                    "name": group[0].description,
                    "average_amount": round(avg, 2),
                    "frequency": "Monthly",
                    "category": group[0].category_name,
                })

        return recurring

    @staticmethod
    async def get_top_categories(
        db: AsyncSession, owner_id: int, month: str | None = None
    ) -> list[dict]:
        """Top 5 expense categories for a given month."""
        if not month:
            month = datetime.now().strftime("%Y-%m")

        year, mon = month.split("-")

        result = await db.execute(
            select(Transaction).where(
                Transaction.owner_id == owner_id,
                Transaction.type == "expense",
                Transaction.section != "in_and_out",
                extract("year", Transaction.date) == int(year),
                extract("month", Transaction.date) == int(mon),
            )
        )
        txs = result.scalars().all()

        cat_sums: dict[str, float] = defaultdict(float)
        for tx in txs:
            cat_sums[tx.category_name or "Unknown"] += float(tx.amount)

        sorted_cats = sorted(cat_sums.items(), key=lambda x: x[1], reverse=True)
        return [{"category": c, "amount": round(a, 2)} for c, a in sorted_cats[:5]]

    @staticmethod
    async def predict_spending(db: AsyncSession, owner_id: int) -> dict:
        """Simple forecast based on last 3 months average."""
        result = await db.execute(
            select(Transaction).where(
                Transaction.owner_id == owner_id,
                Transaction.type == "expense",
                Transaction.section != "in_and_out",
            )
        )
        txs = result.scalars().all()

        monthly_total: dict[str, float] = defaultdict(float)
        for tx in txs:
            m = tx.date.strftime("%Y-%m")
            monthly_total[m] += float(tx.amount)

        sorted_months = sorted(monthly_total.keys())
        if not sorted_months:
            return {"predicted_total_expenses": 0, "based_on_months": []}

        last_3 = sorted_months[-3:]
        total = sum(monthly_total[m] for m in last_3)
        avg = total / len(last_3)

        return {
            "predicted_total_expenses": round(avg, 2),
            "based_on_months": last_3,
        }
