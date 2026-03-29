from collections import defaultdict
from datetime import date
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import select, func, extract, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession

from features.bills.models import RecurringBill
from features.statements.models import Transaction
from features.analysis.service import AnalysisService


class BillService:
    @staticmethod
    async def get_all(
        db: AsyncSession, owner_id: int
    ) -> list[RecurringBill]:
        result = await db.execute(
            select(RecurringBill).where(
                RecurringBill.owner_id == owner_id,
                RecurringBill.is_active.is_(True),
            )
        )
        return list(result.scalars().all())

    @staticmethod
    async def create(
        db: AsyncSession, owner_id: int, data: dict
    ) -> RecurringBill:
        bill = RecurringBill(owner_id=owner_id, **data)
        db.add(bill)
        await db.flush()
        await db.refresh(bill)
        return bill

    @staticmethod
    async def update(
        db: AsyncSession, owner_id: int, bill_id: int, data: dict
    ) -> RecurringBill:
        result = await db.execute(
            select(RecurringBill).where(
                RecurringBill.id == bill_id,
                RecurringBill.owner_id == owner_id,
            )
        )
        bill = result.scalar_one_or_none()
        if not bill:
            raise HTTPException(status_code=404, detail="Bill not found")

        for key, value in data.items():
            if value is not None:
                setattr(bill, key, value)

        await db.flush()
        await db.refresh(bill)
        return bill

    @staticmethod
    async def delete(
        db: AsyncSession, owner_id: int, bill_id: int
    ) -> bool:
        result = await db.execute(
            select(RecurringBill).where(
                RecurringBill.id == bill_id,
                RecurringBill.owner_id == owner_id,
            )
        )
        bill = result.scalar_one_or_none()
        if not bill:
            raise HTTPException(status_code=404, detail="Bill not found")

        await db.delete(bill)
        await db.flush()
        return True

    @staticmethod
    async def get_status_for_month(
        db: AsyncSession, owner_id: int, month: str
    ) -> list[dict]:
        """Compute paid/pending/overdue status for each active bill."""
        from features.categories.models import Category

        year, mon = month.split("-")
        year_int, mon_int = int(year), int(mon)
        today = date.today()

        # Get IDs of categories with section='fixed'
        fixed_cat_result = await db.execute(
            select(Category.id).where(
                Category.owner_id == owner_id,
                Category.section == "fixed",
            )
        )
        fixed_cat_ids = {row[0] for row in fixed_cat_result.all()}
        if not fixed_cat_ids:
            return []

        # Load only bills linked to fixed categories
        bill_result = await db.execute(
            select(RecurringBill).where(
                RecurringBill.owner_id == owner_id,
                RecurringBill.is_active.is_(True),
                RecurringBill.category_id.in_(fixed_cat_ids),
            )
        )
        bills = list(bill_result.scalars().all())

        if not bills:
            return []

        # Load only fixed-category transactions for this month
        tx_result = await db.execute(
            select(Transaction).where(
                Transaction.owner_id == owner_id,
                Transaction.category_id.in_(fixed_cat_ids),
                extract("year", Transaction.date) == year_int,
                extract("month", Transaction.date) == mon_int,
            )
        )
        transactions = list(tx_result.scalars().all())

        # Two-pass matching: exact description first, then amount fallback
        bill_matches: dict[int, list[Transaction]] = {}
        used_tx_ids: set[int] = set()

        # Pass 1: exact description match
        for bill in bills:
            matches = _match_by_description(bill, transactions, used_tx_ids)
            if matches:
                bill_matches[bill.id] = matches
                used_tx_ids.update(m.id for m in matches)

        # Pass 2: amount-based fallback for unmatched bills
        for bill in bills:
            if bill.id in bill_matches:
                continue
            match = _match_by_amount(bill, transactions, used_tx_ids)
            if match:
                bill_matches[bill.id] = match
                used_tx_ids.update(m.id for m in match)

        statuses = []
        for bill in bills:
            matches = bill_matches.get(bill.id)

            if matches:
                status = "paid"
                matched_id = matches[0].id
                paid_amount = sum(
                    Decimal(str(m.amount)) for m in matches
                )
            elif today.year == year_int and today.month == mon_int:
                if bill.due_day and today.day > bill.due_day:
                    status = "overdue"
                else:
                    status = "pending"
                matched_id = None
                paid_amount = None
            elif (today.year > year_int) or (
                today.year == year_int and today.month > mon_int
            ):
                status = "overdue"
                matched_id = None
                paid_amount = None
            else:
                status = "pending"
                matched_id = None
                paid_amount = None

            statuses.append({
                "bill": bill,
                "status": status,
                "matched_transaction_id": matched_id,
                "paid_amount": paid_amount,
            })

        return statuses

    @staticmethod
    async def check_missing_bills(
        db: AsyncSession, owner_id: int, month: str
    ) -> dict:
        """Compare fixed transactions from previous months and detect missing ones.

        Looks at the 3 months prior to the target month, finds fixed-category
        transaction descriptions that appeared in at least 2 of those months,
        and checks if they also appear in the target month.
        """
        from features.categories.models import Category

        year_int, mon_int = int(month.split("-")[0]), int(month.split("-")[1])

        # Get fixed category IDs
        fixed_cat_result = await db.execute(
            select(Category.id).where(
                Category.owner_id == owner_id,
                Category.section == "fixed",
            )
        )
        fixed_cat_ids = {row[0] for row in fixed_cat_result.all()}
        if not fixed_cat_ids:
            return {"all_paid": True, "missing": []}

        # Build list of (year, month) for the 3 prior months
        prior_months = []
        y, m = year_int, mon_int
        for _ in range(3):
            m -= 1
            if m == 0:
                m = 12
                y -= 1
            prior_months.append((y, m))

        # Fetch fixed-category transactions for the 3 prior months
        prior_conditions = [
            and_(
                extract("year", Transaction.date) == py,
                extract("month", Transaction.date) == pm,
            )
            for py, pm in prior_months
        ]

        prior_result = await db.execute(
            select(Transaction).where(
                Transaction.owner_id == owner_id,
                Transaction.category_id.in_(fixed_cat_ids),
                or_(*prior_conditions),
            )
        )
        prior_txs = list(prior_result.scalars().all())

        if not prior_txs:
            return {"all_paid": True, "missing": []}

        # Group prior transactions by normalized description and month
        # desc_months: { "electricity": { (2025, 1), (2025, 2), ... } }
        desc_months: dict[str, set[tuple[int, int]]] = defaultdict(set)
        desc_amounts: dict[str, list[float]] = defaultdict(list)
        desc_display: dict[str, str] = {}  # keep original casing

        for tx in prior_txs:
            desc = (tx.description or "").strip()
            if not desc:
                continue
            key = desc.lower()
            tx_ym = (tx.date.year, tx.date.month)
            desc_months[key].add(tx_ym)
            desc_amounts[key].append(abs(float(tx.amount)))
            if key not in desc_display:
                desc_display[key] = desc

        # Identify consistently recurring: appeared in at least 2 of 3 prior months
        recurring_descs = {
            key for key, months in desc_months.items()
            if len(months) >= 2
        }

        if not recurring_descs:
            return {"all_paid": True, "missing": []}

        # Fetch target month transactions
        target_result = await db.execute(
            select(Transaction).where(
                Transaction.owner_id == owner_id,
                Transaction.category_id.in_(fixed_cat_ids),
                extract("year", Transaction.date) == year_int,
                extract("month", Transaction.date) == mon_int,
            )
        )
        target_txs = list(target_result.scalars().all())

        target_descs = {
            (tx.description or "").strip().lower()
            for tx in target_txs
        }

        # Find missing: recurring in prior months but absent in target month
        missing = []
        for key in sorted(recurring_descs):
            if key not in target_descs:
                amounts = desc_amounts[key]
                typical = round(sum(amounts) / len(amounts), 2)
                missing.append({
                    "name": desc_display[key],
                    "typical_amount": Decimal(str(typical)),
                    "months_seen": len(desc_months[key]),
                })

        return {
            "all_paid": len(missing) == 0,
            "missing": missing,
        }

    @staticmethod
    async def auto_detect_bills(
        db: AsyncSession, owner_id: int
    ) -> list[dict]:
        """Suggest recurring bills from transaction patterns."""
        recurring = await AnalysisService.detect_recurring(db, owner_id)
        suggestions = []
        for item in recurring:
            suggestions.append({
                "name": item["name"],
                "expected_amount": item["average_amount"],
                "frequency": item.get("frequency", "Monthly").lower(),
                "category": item.get("category"),
            })
        return suggestions

    @staticmethod
    async def autofill_bills(
        db: AsyncSession, owner_id: int, month: str | None = None
    ) -> dict:
        """Create bills from transactions in 'fixed' category section only.
        Each unique transaction description becomes its own bill."""
        from features.categories.models import Category

        if not month:
            now = date.today()
            month = f"{now.year}-{now.month:02d}"

        year_int, mon_int = int(month.split("-")[0]), int(month.split("-")[1])

        # 1. Get IDs of categories with section='fixed'
        fixed_cat_result = await db.execute(
            select(Category.id).where(
                Category.owner_id == owner_id,
                Category.section == "fixed",
            )
        )
        fixed_cat_ids = [row[0] for row in fixed_cat_result.all()]
        if not fixed_cat_ids:
            return {"created": 0, "skipped": 0, "bills": []}

        # 2. Load transactions for target month in fixed categories
        tx_result = await db.execute(
            select(Transaction).where(
                Transaction.owner_id == owner_id,
                Transaction.type == "expense",
                Transaction.category_id.in_(fixed_cat_ids),
                extract("year", Transaction.date) == year_int,
                extract("month", Transaction.date) == mon_int,
            )
        )
        month_txs = list(tx_result.scalars().all())
        if not month_txs:
            return {"created": 0, "skipped": 0, "bills": []}

        # 3. Each transaction becomes a bill (grouped by description)
        by_desc: dict[str, list] = defaultdict(list)
        for tx in month_txs:
            key = (tx.description or "").strip()
            if key:
                by_desc[key].append(tx)

        # 4. Get existing bill names to avoid duplicates
        existing = await db.execute(
            select(RecurringBill.name).where(
                RecurringBill.owner_id == owner_id,
            )
        )
        existing_names = {n.lower() for n in existing.scalars().all()}

        # 5. Create one bill per unique description
        created_bills = []
        skipped = 0
        for desc, txs in by_desc.items():
            if desc.lower() in existing_names:
                skipped += 1
                continue

            # Sum all transactions with this description (handles split payments)
            amount = sum(abs(float(tx.amount)) for tx in txs)
            due_day = txs[0].date.day
            category_id = txs[0].category_id

            bill = RecurringBill(
                owner_id=owner_id,
                name=desc,
                expected_amount=Decimal(str(round(amount, 2))),
                frequency="monthly",
                due_day=due_day,
                category_id=category_id,
            )
            db.add(bill)
            created_bills.append(bill)

        if created_bills:
            await db.flush()
            for b in created_bills:
                await db.refresh(b)

        return {
            "created": len(created_bills),
            "skipped": skipped,
            "bills": created_bills,
        }


def _match_by_description(
    bill: RecurringBill,
    transactions: list[Transaction],
    used_tx_ids: set[int],
) -> list[Transaction]:
    """Match by exact description. Sum must be within 20% of expected."""
    bill_name_lower = bill.name.lower()
    expected = float(bill.expected_amount)

    matches = [
        tx for tx in transactions
        if tx.id not in used_tx_ids
        and (tx.description or "").lower() == bill_name_lower
    ]
    if not matches:
        return []

    total = sum(abs(float(tx.amount)) for tx in matches)
    if abs(total - expected) <= expected * 0.20:
        return matches
    return []


def _match_by_amount(
    bill: RecurringBill,
    transactions: list[Transaction],
    used_tx_ids: set[int],
) -> list[Transaction] | None:
    """Fallback: match unmatched bill to remaining transactions by amount.

    Tries single-transaction match first, then multi-transaction sum.
    Only returns a match if it's unambiguous.
    """
    expected = float(bill.expected_amount)
    tolerance = expected * 0.20
    remaining = [tx for tx in transactions if tx.id not in used_tx_ids]

    # Try single transaction match
    candidates = [
        tx for tx in remaining
        if abs(abs(float(tx.amount)) - expected) <= tolerance
    ]
    if len(candidates) == 1:
        return candidates

    # Try multi-transaction sum (for split payments)
    # Group remaining by description, check if any group sums to expected
    by_desc: dict[str, list[Transaction]] = defaultdict(list)
    for tx in remaining:
        by_desc[(tx.description or "").strip()].append(tx)

    for desc_txs in by_desc.values():
        if len(desc_txs) < 2:
            continue
        total = sum(abs(float(tx.amount)) for tx in desc_txs)
        if abs(total - expected) <= tolerance:
            return desc_txs

    return None
