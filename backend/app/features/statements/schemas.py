from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel


class StatementResponse(BaseModel):
    id: int
    filename: str
    upload_date: datetime | None = None
    period_start: date | None
    period_end: date | None
    bank_name: str | None
    status: str
    account_id: int | None = None
    transaction_count: int = 0
    has_file: bool = False
    statement_type: str = "bank"
    closing_balance: Decimal | None = None
    linked_savings_id: int | None = None

    model_config = {"from_attributes": True}


class TransactionResponse(BaseModel):
    id: int
    date: date
    description: str
    original_description: str | None
    amount: Decimal
    type: str
    category_name: str | None
    section: str | None
    status: str
    confidence: Decimal | None
    account_id: int | None = None
    currency: str = "CZK"
    original_amount: Decimal | None = None
    original_currency: str | None = None

    model_config = {"from_attributes": True}


class TransactionUpdate(BaseModel):
    category_name: str | None = None
    status: str | None = None


class TransactionSearchResponse(BaseModel):
    transactions: list[TransactionResponse]
    total: int
    limit: int
    offset: int


class BulkUpdateRequest(BaseModel):
    transaction_ids: list[int]
    category_name: str
    status: str = "classified"


class CategorizeSimilarRequest(BaseModel):
    description: str
    category_name: str


class StatementTypeUpdate(BaseModel):
    statement_type: str  # "bank" or "savings"


class UploadResponse(BaseModel):
    filename: str
    statement_id: int
    transactions_count: int
    message: str
    statement_type: str = "bank"
