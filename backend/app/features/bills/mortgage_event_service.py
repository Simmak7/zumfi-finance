"""CRUD for mortgage events (rate changes, extra payments, payment changes, etc.)."""
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from features.bills.models import MortgageEvent, Mortgage


async def _recompute_mortgage_state(
    db: AsyncSession, mortgage_id: int, owner_id: int,
) -> None:
    """Recompute mortgage fields from its full event history.

    Replays all events in chronological order to derive the current
    interest_rate, monthly_payment, extra_payments, balance_override,
    and fix_end_date.
    """
    mortgage = (await db.execute(
        select(Mortgage).where(Mortgage.id == mortgage_id)
    )).scalar_one()

    # Load all events in chronological order
    result = await db.execute(
        select(MortgageEvent).where(
            MortgageEvent.mortgage_id == mortgage_id,
            MortgageEvent.owner_id == owner_id,
        ).order_by(MortgageEvent.event_date.asc(), MortgageEvent.id.asc())
    )
    all_events = list(result.scalars().all())

    # Determine ORIGINAL values from the first events that carry old_* fields.
    # If no such events exist, the current mortgage fields are the originals.
    rate_events = [
        e for e in all_events
        if e.event_type == "rate_change" and e.old_rate is not None
    ]
    original_rate = (
        rate_events[0].old_rate if rate_events else mortgage.interest_rate
    )

    payment_events = [
        e for e in all_events
        if e.event_type == "payment_change" and e.old_payment is not None
    ]
    original_payment = (
        payment_events[0].old_payment if payment_events else mortgage.monthly_payment
    )

    # Replay events to find current state
    current_rate = original_rate
    current_payment = original_payment
    total_extra = Decimal("0")
    current_balance_override = None
    current_fix_end_date = mortgage.fix_end_date

    for ev in all_events:
        if ev.event_type == "rate_change" and ev.new_rate is not None:
            current_rate = ev.new_rate
            if ev.new_fix_end_date is not None:
                current_fix_end_date = ev.new_fix_end_date
        elif ev.event_type == "payment_change" and ev.new_payment is not None:
            current_payment = ev.new_payment
        elif ev.event_type == "extra_payment" and ev.amount is not None:
            total_extra += ev.amount
        elif ev.event_type == "balance_override" and ev.new_balance is not None:
            current_balance_override = ev.new_balance
        elif ev.event_type == "fix_period_change" and ev.new_fix_end_date is not None:
            current_fix_end_date = ev.new_fix_end_date

    mortgage.interest_rate = current_rate
    mortgage.monthly_payment = current_payment
    mortgage.extra_payments = total_extra
    # Only update balance_override from events if balance_override events exist.
    # This preserves manual overrides set via the edit form.
    has_balance_events = any(
        ev.event_type == "balance_override" for ev in all_events
    )
    if has_balance_events:
        mortgage.balance_override = current_balance_override
    if current_fix_end_date is not None:
        mortgage.fix_end_date = current_fix_end_date

    await db.flush()


class MortgageEventService:
    @staticmethod
    async def get_all(
        db: AsyncSession, owner_id: int, mortgage_id: int,
    ) -> list[MortgageEvent]:
        result = await db.execute(
            select(MortgageEvent).where(
                MortgageEvent.mortgage_id == mortgage_id,
                MortgageEvent.owner_id == owner_id,
            ).order_by(MortgageEvent.event_date.asc(), MortgageEvent.id.asc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def create(
        db: AsyncSession, owner_id: int, mortgage_id: int, data: dict,
    ) -> MortgageEvent:
        # Verify mortgage belongs to user and get it for auto-filling old values
        result = await db.execute(
            select(Mortgage).where(
                Mortgage.id == mortgage_id, Mortgage.owner_id == owner_id,
            )
        )
        mortgage = result.scalar_one_or_none()
        if not mortgage:
            raise HTTPException(status_code=404, detail="Mortgage not found")

        event = MortgageEvent(
            mortgage_id=mortgage_id, owner_id=owner_id, **data,
        )

        # Auto-fill old values from current mortgage state if not provided
        if data.get("event_type") == "rate_change" and data.get("old_rate") is None:
            event.old_rate = mortgage.interest_rate
        if data.get("event_type") == "payment_change" and data.get("old_payment") is None:
            event.old_payment = mortgage.monthly_payment

        db.add(event)
        await db.flush()

        # Recompute mortgage state from full event history
        await _recompute_mortgage_state(db, mortgage_id, owner_id)

        await db.refresh(event)
        return event

    @staticmethod
    async def update(
        db: AsyncSession, owner_id: int, event_id: int, data: dict,
    ) -> MortgageEvent:
        result = await db.execute(
            select(MortgageEvent).where(
                MortgageEvent.id == event_id,
                MortgageEvent.owner_id == owner_id,
            )
        )
        event = result.scalar_one_or_none()
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")

        # Event fields that can legitimately be set to NULL
        nullable_fields = {
            "amount", "old_rate", "new_rate", "old_payment", "new_payment",
            "new_balance", "new_fix_end_date", "note",
        }
        for key, value in data.items():
            if value is not None or key in nullable_fields:
                setattr(event, key, value)
        await db.flush()

        # Recompute mortgage state after event update
        await _recompute_mortgage_state(db, event.mortgage_id, owner_id)

        await db.refresh(event)
        return event

    @staticmethod
    async def delete(
        db: AsyncSession, owner_id: int, event_id: int,
    ) -> bool:
        result = await db.execute(
            select(MortgageEvent).where(
                MortgageEvent.id == event_id,
                MortgageEvent.owner_id == owner_id,
            )
        )
        event = result.scalar_one_or_none()
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")

        mortgage_id = event.mortgage_id
        await db.delete(event)
        await db.flush()

        # Recompute mortgage state from remaining events
        await _recompute_mortgage_state(db, mortgage_id, owner_id)

        return True
