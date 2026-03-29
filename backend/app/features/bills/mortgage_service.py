"""Mortgage CRUD, amortization computation, and payment status matching."""
from collections import defaultdict
from datetime import date
from decimal import Decimal
from dateutil.relativedelta import relativedelta

from fastapi import HTTPException
from sqlalchemy import select, extract
from sqlalchemy.ext.asyncio import AsyncSession

from features.bills.models import Mortgage, MortgageEvent
from features.statements.models import Transaction


class MortgageService:
    @staticmethod
    async def get_all(db: AsyncSession, owner_id: int) -> list[dict]:
        result = await db.execute(
            select(Mortgage).where(
                Mortgage.owner_id == owner_id,
                Mortgage.is_active.is_(True),
            )
        )
        mortgages = list(result.scalars().all())
        enriched = []
        for m in mortgages:
            events = await _load_events(db, m.id, owner_id)
            enriched.append(_enrich_mortgage(m, events))
        return enriched

    @staticmethod
    async def create(db: AsyncSession, owner_id: int, data: dict) -> Mortgage:
        mortgage = Mortgage(owner_id=owner_id, **data)
        db.add(mortgage)
        await db.flush()
        await db.refresh(mortgage)
        return mortgage

    # Fields that can legitimately be set to NULL
    _NULLABLE_FIELDS = {"balance_override", "fix_end_date", "property_id", "category_id"}

    @staticmethod
    async def update(
        db: AsyncSession, owner_id: int, mortgage_id: int, data: dict,
    ) -> Mortgage:
        result = await db.execute(
            select(Mortgage).where(
                Mortgage.id == mortgage_id,
                Mortgage.owner_id == owner_id,
            )
        )
        mortgage = result.scalar_one_or_none()
        if not mortgage:
            raise HTTPException(status_code=404, detail="Mortgage not found")
        for key, value in data.items():
            if value is not None or key in MortgageService._NULLABLE_FIELDS:
                setattr(mortgage, key, value)
        await db.flush()
        await db.refresh(mortgage)
        return mortgage

    @staticmethod
    async def delete(
        db: AsyncSession, owner_id: int, mortgage_id: int,
    ) -> bool:
        result = await db.execute(
            select(Mortgage).where(
                Mortgage.id == mortgage_id,
                Mortgage.owner_id == owner_id,
            )
        )
        mortgage = result.scalar_one_or_none()
        if not mortgage:
            raise HTTPException(status_code=404, detail="Mortgage not found")
        await db.delete(mortgage)
        await db.flush()
        return True

    @staticmethod
    async def get_status_for_month(
        db: AsyncSession, owner_id: int, month: str,
    ) -> list[dict]:
        """Payment status for each mortgage in a given month.

        Uses the same two-pass matching approach as BillService:
        Pass 1 — exact description match, Pass 2 — amount-based fallback.
        """
        from features.categories.models import Category

        year_int, mon_int = int(month[:4]), int(month[5:7])
        today = date.today()

        # Get fixed category IDs
        fixed_cat_result = await db.execute(
            select(Category.id).where(
                Category.owner_id == owner_id,
                Category.section == "fixed",
            )
        )
        fixed_cat_ids = {row[0] for row in fixed_cat_result.all()}

        # Load active mortgages
        mort_result = await db.execute(
            select(Mortgage).where(
                Mortgage.owner_id == owner_id,
                Mortgage.is_active.is_(True),
            )
        )
        mortgages = list(mort_result.scalars().all())
        if not mortgages:
            return []

        # Load confirmed payments for this month
        from features.bills.models import MortgagePayment
        confirmed_result = await db.execute(
            select(MortgagePayment).where(
                MortgagePayment.owner_id == owner_id,
                MortgagePayment.month == month,
            )
        )
        confirmed_payments = {
            cp.mortgage_id: cp
            for cp in confirmed_result.scalars().all()
        }

        # Load fixed-category transactions for the month
        tx_filters = [
            Transaction.owner_id == owner_id,
            extract("year", Transaction.date) == year_int,
            extract("month", Transaction.date) == mon_int,
        ]
        if fixed_cat_ids:
            tx_filters.append(Transaction.category_id.in_(fixed_cat_ids))

        tx_result = await db.execute(select(Transaction).where(*tx_filters))
        transactions = list(tx_result.scalars().all())

        # Two-pass matching
        mortgage_matches: dict[int, list[Transaction]] = {}
        used_tx_ids: set[int] = set()

        # Pass 1: exact description match
        for m in mortgages:
            matches = _match_by_description(m, transactions, used_tx_ids)
            if matches:
                mortgage_matches[m.id] = matches
                used_tx_ids.update(tx.id for tx in matches)

        # Pass 2: amount-based fallback
        for m in mortgages:
            if m.id in mortgage_matches:
                continue
            matches = _match_by_amount(m, transactions, used_tx_ids)
            if matches:
                mortgage_matches[m.id] = matches
                used_tx_ids.update(tx.id for tx in matches)

        # Use end-of-selected-month as reference so remaining_balance
        # reflects the balance *after* that month's payment.
        ref_date = date(year_int, mon_int, 28)

        statuses = []
        for m in mortgages:
            events = await _load_events(db, m.id, owner_id)
            enriched = _enrich_mortgage(m, events, reference_date=ref_date)

            # Check for confirmed payment first
            confirmed = confirmed_payments.get(m.id)
            if confirmed:
                statuses.append({
                    "mortgage": enriched,
                    "status": "paid",
                    "matched_transaction_id": confirmed.transaction_id,
                    "paid_amount": confirmed.paid_amount,
                    "confirmed": True,
                })
                continue

            # Fall back to auto-matching
            matches = mortgage_matches.get(m.id)
            if matches:
                status = "paid"
                matched_id = matches[0].id
                paid_amount = sum(Decimal(str(tx.amount)) for tx in matches)
            else:
                paid_amount = None
                matched_id = None
                start_y, start_m = m.start_date.year, m.start_date.month
                if (year_int, mon_int) < (start_y, start_m):
                    status = "pending"
                elif today.year == year_int and today.month == mon_int:
                    due_day = m.start_date.day
                    status = "overdue" if today.day > due_day else "pending"
                elif (today.year, today.month) > (year_int, mon_int):
                    status = "overdue"
                else:
                    status = "pending"

            statuses.append({
                "mortgage": enriched,
                "status": status,
                "matched_transaction_id": matched_id,
                "paid_amount": paid_amount,
                "confirmed": False,
            })

        return statuses

    @staticmethod
    async def get_enriched(db: AsyncSession, owner_id: int, mortgage_id: int) -> dict:
        result = await db.execute(
            select(Mortgage).where(
                Mortgage.id == mortgage_id,
                Mortgage.owner_id == owner_id,
            )
        )
        mortgage = result.scalar_one_or_none()
        if not mortgage:
            raise HTTPException(status_code=404, detail="Mortgage not found")
        events = await _load_events(db, mortgage_id, owner_id)
        return _enrich_mortgage(mortgage, events)

    @staticmethod
    def get_amortization_schedule(mortgage: Mortgage, events: list | None = None) -> list[dict]:
        return _compute_amortization_with_events(mortgage, events or [])

    @staticmethod
    async def confirm_payment(
        db: AsyncSession, owner_id: int, mortgage_id: int, data: dict,
    ):
        """Confirm a mortgage payment for a specific month."""
        from features.bills.models import MortgagePayment

        # Verify mortgage belongs to user
        result = await db.execute(
            select(Mortgage).where(
                Mortgage.id == mortgage_id, Mortgage.owner_id == owner_id,
            )
        )
        mortgage = result.scalar_one_or_none()
        if not mortgage:
            raise HTTPException(status_code=404, detail="Mortgage not found")

        # Check for existing confirmation
        existing = await db.execute(
            select(MortgagePayment).where(
                MortgagePayment.mortgage_id == mortgage_id,
                MortgagePayment.month == data["month"],
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=409,
                detail=f"Payment already confirmed for {data['month']}",
            )

        # Look up the amortization schedule to split principal/interest
        events = await _load_events(db, mortgage_id, owner_id)
        schedule = _compute_amortization_with_events(mortgage, events)

        month_str = data["month"]
        year_int, mon_int = int(month_str[:4]), int(month_str[5:7])
        month_offset = (year_int - mortgage.start_date.year) * 12 + (
            mon_int - mortgage.start_date.month
        )

        principal_portion = None
        interest_portion = None
        if 1 <= month_offset <= len(schedule):
            entry = schedule[month_offset - 1]
            principal_portion = entry["principal"]
            interest_portion = entry["interest"]

        # Validate transaction if provided
        if data.get("transaction_id"):
            tx_result = await db.execute(
                select(Transaction).where(
                    Transaction.id == data["transaction_id"],
                    Transaction.owner_id == owner_id,
                )
            )
            if not tx_result.scalar_one_or_none():
                raise HTTPException(status_code=404, detail="Transaction not found")

        payment = MortgagePayment(
            mortgage_id=mortgage_id,
            owner_id=owner_id,
            month=data["month"],
            transaction_id=data.get("transaction_id"),
            paid_amount=data["paid_amount"],
            principal_portion=principal_portion,
            interest_portion=interest_portion,
        )
        db.add(payment)
        await db.flush()
        await db.refresh(payment)
        return payment

    @staticmethod
    async def delete_payment(
        db: AsyncSession, owner_id: int, mortgage_id: int, payment_id: int,
    ) -> bool:
        """Remove a payment confirmation."""
        from features.bills.models import MortgagePayment

        result = await db.execute(
            select(MortgagePayment).where(
                MortgagePayment.id == payment_id,
                MortgagePayment.mortgage_id == mortgage_id,
                MortgagePayment.owner_id == owner_id,
            )
        )
        payment = result.scalar_one_or_none()
        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")
        await db.delete(payment)
        await db.flush()
        return True

    @staticmethod
    async def get_payments(
        db: AsyncSession, owner_id: int, mortgage_id: int,
    ) -> list:
        """List confirmed payments for a mortgage."""
        from features.bills.models import MortgagePayment

        result = await db.execute(
            select(MortgagePayment).where(
                MortgagePayment.mortgage_id == mortgage_id,
                MortgagePayment.owner_id == owner_id,
            ).order_by(MortgagePayment.month.desc())
        )
        return list(result.scalars().all())


# ── Helper functions ──


async def _load_events(db: AsyncSession, mortgage_id: int, owner_id: int) -> list[MortgageEvent]:
    result = await db.execute(
        select(MortgageEvent).where(
            MortgageEvent.mortgage_id == mortgage_id,
            MortgageEvent.owner_id == owner_id,
        ).order_by(MortgageEvent.event_date.asc(), MortgageEvent.id.asc())
    )
    return list(result.scalars().all())


def _enrich_mortgage(
    m: Mortgage,
    events: list[MortgageEvent] | None = None,
    reference_date: date | None = None,
) -> dict:
    """Add computed amortization fields to a mortgage, accounting for events.

    The amortization schedule already incorporates rate changes, payment changes,
    and extra payments at their correct month offsets.  We read the remaining
    balance directly from the schedule entry at the elapsed month to avoid
    double-counting extra payments.

    If *reference_date* is supplied the elapsed calculation (and therefore
    remaining_balance, progress, months_remaining, …) is anchored to that
    date instead of today.
    """
    events = events or []
    today = reference_date or date.today()

    # Build event-aware amortization
    schedule = _compute_amortization_with_events(m, events)

    elapsed = (today.year - m.start_date.year) * 12 + (
        today.month - m.start_date.month
    )
    elapsed = max(0, min(elapsed, len(schedule)))

    total_paid = Decimal("0")
    interest_paid = Decimal("0")

    for i, entry in enumerate(schedule):
        if i >= elapsed:
            break
        total_paid += entry["payment"]
        interest_paid += entry["interest"]

    # Extra payments total (for display purposes)
    total_extra = Decimal("0")
    for ev in events:
        if ev.event_type == "extra_payment" and ev.amount:
            total_extra += ev.amount
    if total_extra == 0:
        total_extra = m.extra_payments or Decimal("0")

    # Remaining balance comes from the schedule (already includes extra payments
    # and balance overrides integrated at their correct month offsets).
    if elapsed > 0 and schedule:
        remaining = schedule[elapsed - 1]["balance"]
    else:
        remaining = m.original_amount

    # Apply model-level balance_override if set manually (not via events).
    # When balance_override events exist, the schedule already accounts for them;
    # the model field is just a cache.  When no such events exist but the field
    # is set, it's a manual override from the edit form → honour it.
    has_event_overrides = any(
        ev.event_type == "balance_override" for ev in events
    )
    if m.balance_override is not None and not has_event_overrides:
        remaining = m.balance_override

    # Derive principal_paid consistently from remaining balance
    principal_paid = m.original_amount - remaining
    principal_paid = max(principal_paid, Decimal("0"))

    # Add extra payments to total_paid for display (they reduce balance but
    # aren't part of the monthly payment stream)
    total_paid += total_extra

    progress = (
        float((m.original_amount - remaining) / m.original_amount * 100)
        if m.original_amount > 0
        else 0
    )

    # Total interest over entire loan life
    total_interest_lifetime = sum(
        entry["interest"] for entry in schedule
    )

    # Months remaining accounts for early payoff via extra payments
    months_left = max(len(schedule) - elapsed, 0)
    projected_payoff = today + relativedelta(months=months_left)

    # Fix expiry reminders
    reminders = _compute_fix_reminders(m, today)

    return {
        "id": m.id,
        "name": m.name,
        "original_amount": m.original_amount,
        "interest_rate": m.interest_rate,
        "term_months": m.term_months,
        "monthly_payment": m.monthly_payment,
        "start_date": m.start_date,
        "extra_payments": total_extra if total_extra > 0 else (m.extra_payments or Decimal("0")),
        "property_id": m.property_id,
        "category_id": m.category_id,
        "currency": getattr(m, "currency", "CZK") or "CZK",
        "fix_end_date": getattr(m, "fix_end_date", None),
        "balance_override": getattr(m, "balance_override", None),
        "is_active": m.is_active,
        "remaining_balance": remaining.quantize(Decimal("0.01")),
        "total_paid": total_paid.quantize(Decimal("0.01")),
        "principal_paid": principal_paid.quantize(Decimal("0.01")),
        "interest_paid": interest_paid.quantize(Decimal("0.01")),
        "progress_pct": round(min(progress, 100), 1),
        "months_remaining": months_left,
        "months_elapsed": elapsed,
        "total_interest_lifetime": total_interest_lifetime.quantize(Decimal("0.01")),
        "projected_payoff_date": projected_payoff,
        "fix_expiry_reminders": reminders,
    }


def _compute_fix_reminders(m: Mortgage, today: date) -> list[dict]:
    """Generate reminders for fix rate expiry: 12m, 6m, 1m before, and the month itself."""
    fix_end = getattr(m, "fix_end_date", None)
    if not fix_end:
        return []

    reminders = []
    thresholds = [
        (12, "1 year before fix expiry"),
        (6, "6 months before fix expiry"),
        (1, "1 month before fix expiry"),
        (0, "Fix rate expires this month"),
    ]
    for months_before, label in thresholds:
        reminder_date = fix_end - relativedelta(months=months_before)
        reminder_month = (reminder_date.year, reminder_date.month)
        current_month = (today.year, today.month)
        is_active = current_month >= reminder_month and today <= fix_end + relativedelta(months=1)
        is_past = current_month > reminder_month
        reminders.append({
            "months_before": months_before,
            "label": label,
            "reminder_date": reminder_date.isoformat(),
            "fix_end_date": fix_end.isoformat(),
            "is_active": is_active and not is_past,
            "is_past": is_past,
        })

    return reminders


def _compute_amortization_with_events(m: Mortgage, events: list[MortgageEvent]) -> list[dict]:
    """Amortization schedule that accounts for rate changes and payment changes over time.

    IMPORTANT: m.interest_rate and m.monthly_payment reflect the CURRENT state
    (after all events have been applied).  We need the ORIGINAL values that were
    in effect at the start of the loan.  Reconstruct them from the first
    rate_change / payment_change event's old_* fields.
    """
    # Build a timeline of changes keyed by month offset from start
    rate_changes = {}  # month_offset -> new_rate
    payment_changes = {}  # month_offset -> new_payment
    extra_payments_by_month = {}  # month_offset -> amount
    balance_overrides = {}  # month_offset -> new_balance

    # Reconstruct original values from the first events that carry old_* fields.
    # If no such events exist, the current mortgage fields ARE the originals.
    original_rate = float(m.interest_rate)
    original_payment = float(m.monthly_payment)

    rate_events = [
        e for e in events
        if e.event_type == "rate_change" and e.old_rate is not None
    ]
    if rate_events:
        original_rate = float(rate_events[0].old_rate)

    payment_events = [
        e for e in events
        if e.event_type == "payment_change" and e.old_payment is not None
    ]
    if payment_events:
        original_payment = float(payment_events[0].old_payment)

    for ev in events:
        offset = (ev.event_date.year - m.start_date.year) * 12 + (
            ev.event_date.month - m.start_date.month
        )
        offset = max(0, offset)
        if ev.event_type == "rate_change" and ev.new_rate is not None:
            rate_changes[offset] = float(ev.new_rate)
        elif ev.event_type == "payment_change" and ev.new_payment is not None:
            payment_changes[offset] = float(ev.new_payment)
        elif ev.event_type == "extra_payment" and ev.amount is not None:
            extra_payments_by_month[offset] = (
                extra_payments_by_month.get(offset, 0) + float(ev.amount)
            )
        elif ev.event_type == "balance_override" and ev.new_balance is not None:
            balance_overrides[offset] = float(ev.new_balance)

    monthly_rate = original_rate / 100 / 12
    balance = float(m.original_amount)

    # Apply offset-0 balance override (set on the start month itself)
    if 0 in balance_overrides:
        balance = balance_overrides[0]
    payment = original_payment
    schedule = []

    for month_num in range(1, m.term_months + 1):
        # Apply any rate change at this month
        if month_num in rate_changes:
            monthly_rate = rate_changes[month_num] / 100 / 12
        # Apply any payment change at this month
        if month_num in payment_changes:
            payment = payment_changes[month_num]

        interest = balance * monthly_rate
        principal = payment - interest
        if principal > balance:
            principal = balance
            payment_this = principal + interest
        else:
            payment_this = payment

        balance -= principal

        # Apply extra payment for this month
        extra = extra_payments_by_month.get(month_num, 0)
        if extra > 0:
            balance -= extra
            balance = max(balance, 0)

        # Apply balance override AFTER payment — the override means
        # "the remaining balance at the end of this month IS this value".
        if month_num in balance_overrides:
            balance = balance_overrides[month_num]

        balance = max(balance, 0)
        schedule.append({
            "month": month_num,
            "payment": Decimal(str(round(payment_this, 2))),
            "principal": Decimal(str(round(principal, 2))),
            "interest": Decimal(str(round(interest, 2))),
            "balance": Decimal(str(round(balance, 2))),
        })
        if balance <= 0:
            break

    return schedule


def _compute_amortization(m: Mortgage) -> list[dict]:
    """Standard amortization schedule (monthly compounding)."""
    return _compute_amortization_with_events(m, [])


def _match_by_description(
    mortgage: Mortgage,
    transactions: list[Transaction],
    used_tx_ids: set[int],
) -> list[Transaction]:
    """Match by exact description (case-insensitive). Within 20% tolerance."""
    name_lower = mortgage.name.lower()
    expected = float(mortgage.monthly_payment)
    matches = [
        tx for tx in transactions
        if tx.id not in used_tx_ids
        and (tx.description or "").lower() == name_lower
    ]
    if not matches:
        return []
    total = sum(abs(float(tx.amount)) for tx in matches)
    if abs(total - expected) <= expected * 0.20:
        return matches
    return []


def _match_by_amount(
    mortgage: Mortgage,
    transactions: list[Transaction],
    used_tx_ids: set[int],
) -> list[Transaction] | None:
    """Amount-based fallback. Single unambiguous match or split-payment group."""
    expected = float(mortgage.monthly_payment)
    tolerance = expected * 0.20
    remaining = [tx for tx in transactions if tx.id not in used_tx_ids]

    candidates = [
        tx for tx in remaining
        if abs(abs(float(tx.amount)) - expected) <= tolerance
    ]
    if len(candidates) == 1:
        return candidates

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
