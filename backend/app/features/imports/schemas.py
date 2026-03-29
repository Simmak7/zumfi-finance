from decimal import Decimal
from datetime import date

from pydantic import BaseModel


class ColumnMapping(BaseModel):
    date_column: str
    description_column: str
    amount_column: str
    type_column: str | None = None
    category_column: str | None = None
    currency_column: str | None = None


class ImportUploadResponse(BaseModel):
    filename: str
    columns: list[str]
    total_rows: int
    sample_rows: list[dict]
    is_statement: bool = False  # True if PDF/Word was auto-parsed
    statement_id: int | None = None  # Statement ID if auto-parsed
    statement_type: str = "bank"  # "bank", "savings", "stock", or "stock_pnl"
    period_start: date | None = None  # Start date of transactions
    period_end: date | None = None  # End date of transactions
    message: str | None = None  # Warning/info message from backend


class ImportPreviewRequest(BaseModel):
    filename: str
    mapping: ColumnMapping
    date_format: str = "%Y-%m-%d"
    decimal_separator: str = "."


class ImportPreviewRow(BaseModel):
    date: str
    description: str
    amount: float
    type: str
    category: str | None = None
    currency: str | None = None


class ImportPreviewResponse(BaseModel):
    total_rows: int
    columns: list[str]
    preview_rows: list[ImportPreviewRow]
    errors: list[str]


class ImportExecuteRequest(BaseModel):
    filename: str
    mapping: ColumnMapping
    date_format: str = "%Y-%m-%d"
    decimal_separator: str = "."
    account_id: int | None = None
    default_currency: str = "CZK"


class ImportExecuteResponse(BaseModel):
    statement_id: int
    transactions_imported: int
    transactions_skipped: int
    message: str
