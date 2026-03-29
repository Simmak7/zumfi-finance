from datetime import date as date_type, datetime
from decimal import Decimal

from pydantic import BaseModel


class BillCreate(BaseModel):
    name: str
    expected_amount: Decimal
    frequency: str = "monthly"
    due_day: int | None = None
    category_id: int | None = None


class BillUpdate(BaseModel):
    name: str | None = None
    expected_amount: Decimal | None = None
    frequency: str | None = None
    due_day: int | None = None
    category_id: int | None = None
    is_active: bool | None = None


class BillResponse(BaseModel):
    id: int
    name: str
    expected_amount: Decimal
    frequency: str
    due_day: int | None
    category_id: int | None
    is_active: bool

    model_config = {"from_attributes": True}


class BillStatusItem(BaseModel):
    bill: BillResponse
    status: str  # "paid", "pending", "overdue"
    matched_transaction_id: int | None = None
    paid_amount: Decimal | None = None


class MissingBillItem(BaseModel):
    name: str
    typical_amount: Decimal
    months_seen: int  # how many of last 3 months it appeared in


class MissingBillsResponse(BaseModel):
    all_paid: bool
    missing: list[MissingBillItem]


# ── Mortgage schemas ──


class MortgageCreate(BaseModel):
    name: str
    original_amount: Decimal
    interest_rate: Decimal
    term_months: int
    monthly_payment: Decimal
    start_date: date_type
    extra_payments: Decimal = Decimal("0")
    property_id: int | None = None
    category_id: int | None = None
    currency: str = "CZK"
    fix_end_date: date_type | None = None
    balance_override: Decimal | None = None


class MortgageUpdate(BaseModel):
    name: str | None = None
    original_amount: Decimal | None = None
    interest_rate: Decimal | None = None
    term_months: int | None = None
    monthly_payment: Decimal | None = None
    start_date: date_type | None = None
    extra_payments: Decimal | None = None
    property_id: int | None = None
    category_id: int | None = None
    currency: str | None = None
    fix_end_date: date_type | None = None
    balance_override: Decimal | None = None
    is_active: bool | None = None


class MortgageResponse(BaseModel):
    id: int
    name: str
    original_amount: Decimal
    interest_rate: Decimal
    term_months: int
    monthly_payment: Decimal
    start_date: date_type
    extra_payments: Decimal
    property_id: int | None
    category_id: int | None
    currency: str
    fix_end_date: date_type | None
    balance_override: Decimal | None
    is_active: bool
    # Computed fields (filled by service)
    remaining_balance: Decimal | None = None
    total_paid: Decimal | None = None
    principal_paid: Decimal | None = None
    interest_paid: Decimal | None = None
    progress_pct: float | None = None
    months_remaining: int | None = None
    months_elapsed: int | None = None
    total_interest_lifetime: Decimal | None = None
    projected_payoff_date: date_type | None = None
    # Reminder info
    fix_expiry_reminders: list[dict] | None = None

    model_config = {"from_attributes": True}


class MortgageStatusItem(BaseModel):
    mortgage: MortgageResponse
    status: str  # "paid", "pending", "overdue"
    matched_transaction_id: int | None = None
    paid_amount: Decimal | None = None
    confirmed: bool = False


# ── Mortgage Event schemas ──


class MortgageEventCreate(BaseModel):
    event_type: str  # extra_payment, rate_change, payment_change, balance_override, fix_period_change
    event_date: date_type
    amount: Decimal | None = None
    old_rate: Decimal | None = None
    new_rate: Decimal | None = None
    old_payment: Decimal | None = None
    new_payment: Decimal | None = None
    new_balance: Decimal | None = None
    new_fix_end_date: date_type | None = None
    note: str | None = None


class MortgageEventUpdate(BaseModel):
    event_date: date_type | None = None
    amount: Decimal | None = None
    old_rate: Decimal | None = None
    new_rate: Decimal | None = None
    old_payment: Decimal | None = None
    new_payment: Decimal | None = None
    new_balance: Decimal | None = None
    new_fix_end_date: date_type | None = None
    note: str | None = None


class MortgageEventResponse(BaseModel):
    id: int
    mortgage_id: int
    event_type: str
    event_date: date_type
    amount: Decimal | None
    old_rate: Decimal | None
    new_rate: Decimal | None
    old_payment: Decimal | None
    new_payment: Decimal | None
    new_balance: Decimal | None
    new_fix_end_date: date_type | None
    note: str | None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


# ── Mortgage Payment schemas ──


class MortgagePaymentCreate(BaseModel):
    month: str  # "YYYY-MM"
    transaction_id: int | None = None
    paid_amount: Decimal


class MortgagePaymentResponse(BaseModel):
    id: int
    mortgage_id: int
    month: str
    transaction_id: int | None
    paid_amount: Decimal
    principal_portion: Decimal | None
    interest_portion: Decimal | None
    confirmed_at: datetime | None = None

    model_config = {"from_attributes": True}
