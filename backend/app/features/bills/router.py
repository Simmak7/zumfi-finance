from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth import get_current_user
from core.database import get_db
from features.auth.models import User
from features.bills.models import Mortgage
from features.bills.mortgage_service import MortgageService, _enrich_mortgage, _load_events
from features.bills.mortgage_event_service import MortgageEventService
from features.bills.schemas import (
    BillCreate, BillUpdate, BillResponse, BillStatusItem,
    MissingBillsResponse,
    MortgageCreate, MortgageUpdate, MortgageResponse, MortgageStatusItem,
    MortgageEventCreate, MortgageEventUpdate, MortgageEventResponse,
    MortgagePaymentCreate, MortgagePaymentResponse,
)
from features.bills.service import BillService

router = APIRouter(prefix="/bills", tags=["bills"])


@router.get("/", response_model=list[BillResponse])
async def list_bills(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await BillService.get_all(db, owner_id=user.id)


@router.post("/", response_model=BillResponse)
async def create_bill(
    body: BillCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await BillService.create(
        db, owner_id=user.id, data=body.model_dump()
    )


@router.put("/{bill_id}", response_model=BillResponse)
async def update_bill(
    bill_id: int,
    body: BillUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await BillService.update(
        db, owner_id=user.id, bill_id=bill_id,
        data=body.model_dump(exclude_unset=True),
    )


@router.delete("/{bill_id}")
async def delete_bill(
    bill_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await BillService.delete(db, owner_id=user.id, bill_id=bill_id)
    return {"message": "Bill deleted"}


@router.get("/status", response_model=list[BillStatusItem])
async def get_bill_status(
    month: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await BillService.get_status_for_month(
        db, owner_id=user.id, month=month
    )


@router.get("/missing", response_model=MissingBillsResponse)
async def check_missing_bills(
    month: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await BillService.check_missing_bills(
        db, owner_id=user.id, month=month
    )


@router.get("/auto-detect")
async def auto_detect_bills(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await BillService.auto_detect_bills(db, owner_id=user.id)


@router.post("/autofill")
async def autofill_bills(
    month: str | None = Query(None, pattern=r"^\d{4}-\d{2}$"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Detect recurring transactions and create bills automatically."""
    result = await BillService.autofill_bills(
        db, owner_id=user.id, month=month
    )
    return {
        "created": result["created"],
        "skipped": result["skipped"],
    }


# ── Mortgage endpoints ──


@router.get("/mortgages", response_model=list[MortgageResponse])
async def list_mortgages(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await MortgageService.get_all(db, owner_id=user.id)


@router.post("/mortgages", response_model=MortgageResponse)
async def create_mortgage(
    body: MortgageCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    mortgage = await MortgageService.create(
        db, owner_id=user.id, data=body.model_dump(),
    )
    return _enrich_mortgage(mortgage)


@router.get("/mortgages/status", response_model=list[MortgageStatusItem])
async def get_mortgage_status(
    month: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await MortgageService.get_status_for_month(
        db, owner_id=user.id, month=month,
    )


@router.get("/mortgages/{mortgage_id}", response_model=MortgageResponse)
async def get_mortgage(
    mortgage_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await MortgageService.get_enriched(db, owner_id=user.id, mortgage_id=mortgage_id)


@router.put("/mortgages/{mortgage_id}", response_model=MortgageResponse)
async def update_mortgage(
    mortgage_id: int,
    body: MortgageUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    mortgage = await MortgageService.update(
        db, owner_id=user.id, mortgage_id=mortgage_id,
        data=body.model_dump(exclude_unset=True),
    )
    events = await _load_events(db, mortgage_id, user.id)
    return _enrich_mortgage(mortgage, events)


@router.delete("/mortgages/{mortgage_id}")
async def delete_mortgage(
    mortgage_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await MortgageService.delete(db, owner_id=user.id, mortgage_id=mortgage_id)
    return {"message": "Mortgage deleted"}


@router.get("/mortgages/{mortgage_id}/schedule")
async def get_amortization_schedule(
    mortgage_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Mortgage).where(
            Mortgage.id == mortgage_id,
            Mortgage.owner_id == user.id,
        )
    )
    mortgage = result.scalar_one_or_none()
    if not mortgage:
        raise HTTPException(status_code=404, detail="Mortgage not found")
    events = await _load_events(db, mortgage_id, user.id)
    return MortgageService.get_amortization_schedule(mortgage, events)


# ── Mortgage Event endpoints ──


@router.get(
    "/mortgages/{mortgage_id}/events",
    response_model=list[MortgageEventResponse],
)
async def list_mortgage_events(
    mortgage_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await MortgageEventService.get_all(db, owner_id=user.id, mortgage_id=mortgage_id)


@router.post(
    "/mortgages/{mortgage_id}/events",
    response_model=MortgageEventResponse,
)
async def create_mortgage_event(
    mortgage_id: int,
    body: MortgageEventCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await MortgageEventService.create(
        db, owner_id=user.id, mortgage_id=mortgage_id,
        data=body.model_dump(exclude_unset=True),
    )


@router.put(
    "/mortgages/events/{event_id}",
    response_model=MortgageEventResponse,
)
async def update_mortgage_event(
    event_id: int,
    body: MortgageEventUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await MortgageEventService.update(
        db, owner_id=user.id, event_id=event_id,
        data=body.model_dump(exclude_unset=True),
    )


@router.delete("/mortgages/events/{event_id}")
async def delete_mortgage_event(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await MortgageEventService.delete(db, owner_id=user.id, event_id=event_id)
    return {"message": "Event deleted"}


# ── Mortgage Payment endpoints ──


@router.get(
    "/mortgages/{mortgage_id}/payments",
    response_model=list[MortgagePaymentResponse],
)
async def list_mortgage_payments(
    mortgage_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await MortgageService.get_payments(
        db, owner_id=user.id, mortgage_id=mortgage_id,
    )


@router.post(
    "/mortgages/{mortgage_id}/payments",
    response_model=MortgagePaymentResponse,
)
async def confirm_mortgage_payment(
    mortgage_id: int,
    body: MortgagePaymentCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await MortgageService.confirm_payment(
        db, owner_id=user.id, mortgage_id=mortgage_id,
        data=body.model_dump(),
    )


@router.delete("/mortgages/{mortgage_id}/payments/{payment_id}")
async def delete_mortgage_payment(
    mortgage_id: int,
    payment_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await MortgageService.delete_payment(
        db, owner_id=user.id, mortgage_id=mortgage_id,
        payment_id=payment_id,
    )
    return {"message": "Payment confirmation removed"}
