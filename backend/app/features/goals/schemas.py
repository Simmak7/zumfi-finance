from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel


class GoalCreate(BaseModel):
    name: str
    target_amount: Decimal
    current_amount: Decimal = Decimal("0")
    color: str | None = None
    deadline: date | None = None


class GoalUpdate(BaseModel):
    name: str | None = None
    target_amount: Decimal | None = None
    current_amount: Decimal | None = None
    monthly_allocation: Decimal | None = None
    color: str | None = None
    deadline: date | None = None
    status: str | None = None


class GoalResponse(BaseModel):
    id: int
    name: str
    target_amount: Decimal
    current_amount: Decimal
    monthly_allocation: Decimal | None = None
    color: str | None
    deadline: date | None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Allocation Schemas ──

class AllocationItem(BaseModel):
    goal_id: int
    amount: Decimal


class AllocateRequest(BaseModel):
    month: str
    allocations: list[AllocationItem]


class SurplusResponse(BaseModel):
    month: str
    total_income: Decimal
    total_expenses: Decimal
    already_allocated: Decimal
    available_surplus: Decimal


class AllocationSuggestion(BaseModel):
    goal_id: int
    goal_name: str
    suggested_amount: Decimal
    remaining: Decimal


class AllocationDetailItem(BaseModel):
    goal_name: str
    amount: Decimal


class AllocationDetailsResponse(BaseModel):
    month: str
    allocations: list[AllocationDetailItem]
    total: Decimal


# ── History Schemas ──

class GoalHistoryPoint(BaseModel):
    month: str
    current_amount: Decimal | None = None
    target_amount: Decimal | None = None


class GoalHistoryResponse(BaseModel):
    goal_id: int
    goal_name: str
    color: str | None
    history: list[GoalHistoryPoint]
