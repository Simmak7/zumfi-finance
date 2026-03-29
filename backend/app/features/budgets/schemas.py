from decimal import Decimal

from pydantic import BaseModel


class BudgetCreate(BaseModel):
    category_id: int
    month: str  # "YYYY-MM"
    planned_amount: Decimal


class BudgetUpdate(BaseModel):
    planned_amount: Decimal


class BudgetResponse(BaseModel):
    id: int
    category_id: int
    month: str
    planned_amount: Decimal

    model_config = {"from_attributes": True}


class BudgetSummaryItem(BaseModel):
    category_id: int
    category_name: str
    section: str
    planned_amount: Decimal
    actual_amount: Decimal
    remaining: Decimal
    percent_used: float
    is_inherited: bool = False


class BudgetSummaryResponse(BaseModel):
    month: str
    total_planned: Decimal
    total_actual: Decimal
    categories: list[BudgetSummaryItem]


class BudgetSuggestionItem(BaseModel):
    category_id: int
    category_name: str
    section: str
    suggested_amount: Decimal
    avg_months: int


class CategoryTrend(BaseModel):
    direction: str  # "increasing", "decreasing", "stable"
    monthly_amounts: list[Decimal]
    avg_amount: Decimal
    latest_amount: Decimal
    change_pct: float

class SmartSuggestionItem(BaseModel):
    category_id: int
    category_name: str
    section: str
    suggested_amount: Decimal
    current_budget: Decimal | None
    trend: CategoryTrend
    rule_category: str  # "needs", "wants", "savings"
    ideal_ratio_pct: float
    actual_ratio_pct: float
    reasoning: str

class SmartSuggestionResponse(BaseModel):
    total_income: Decimal
    recommended_total_budget: Decimal
    needs_budget: Decimal
    wants_budget: Decimal
    savings_budget: Decimal
    suggestions: list[SmartSuggestionItem]
