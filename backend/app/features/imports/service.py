"""CSV/Excel import service.

Handles file parsing, column mapping, preview, and bulk transaction import.
"""

import csv
import io
import os
import re
from datetime import datetime, date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from features.statements.models import Statement, Transaction
from features.categories.service import CategoryService


UPLOAD_DIR = "/app/uploads"


class ImportService:
    @staticmethod
    def parse_file(file_path: str) -> tuple[list[str], list[dict]]:
        """Read a CSV or XLSX file and return (columns, rows)."""
        ext = os.path.splitext(file_path)[1].lower()

        if ext == ".csv":
            return _parse_csv(file_path)
        elif ext in (".xlsx", ".xls"):
            return _parse_xlsx(file_path)
        else:
            raise ValueError(f"Unsupported file type: {ext}")

    @staticmethod
    def preview_import(
        file_path: str,
        mapping: dict,
        date_format: str = "%Y-%m-%d",
        decimal_separator: str = ".",
        max_rows: int = 10,
    ) -> dict:
        """Apply column mapping to first N rows and return preview."""
        columns, rows = ImportService.parse_file(file_path)
        preview_rows = []
        errors = []

        for i, row in enumerate(rows[:max_rows]):
            try:
                parsed = _map_row(row, mapping, date_format, decimal_separator)
                parsed["date"] = str(parsed["date"])
                preview_rows.append(parsed)
            except Exception as e:
                errors.append(f"Row {i + 1}: {str(e)}")

        return {
            "total_rows": len(rows),
            "columns": columns,
            "preview_rows": preview_rows,
            "errors": errors,
        }

    @staticmethod
    async def execute_import(
        db: AsyncSession,
        owner_id: int,
        file_path: str,
        mapping: dict,
        date_format: str = "%Y-%m-%d",
        decimal_separator: str = ".",
        account_id: int | None = None,
        default_currency: str = "CZK",
    ) -> tuple[Statement, int, int]:
        """Import all rows from file as transactions."""
        columns, rows = ImportService.parse_file(file_path)

        # Create statement record
        filename = os.path.basename(file_path)
        statement = Statement(
            owner_id=owner_id,
            filename=filename,
            bank_name="CSV Import",
            status="processing",
            account_id=account_id,
        )
        db.add(statement)
        await db.flush()
        await db.refresh(statement)

        imported = 0
        skipped = 0

        for row in rows:
            try:
                parsed = _map_row(row, mapping, date_format, decimal_separator, default_currency)
            except Exception:
                skipped += 1
                continue

            # Deduplicate (match on description, date, amount, type, currency)
            currency = parsed.get("currency", "CZK")
            existing = await db.execute(
                select(Transaction).where(
                    Transaction.owner_id == owner_id,
                    Transaction.original_description == parsed["description"],
                    Transaction.date == parsed["date"],
                    Transaction.amount == parsed["amount"],
                    Transaction.type == parsed["type"],
                    Transaction.currency == currency,
                )
            )
            if existing.scalar_one_or_none():
                skipped += 1
                continue

            # Classify
            cat_section, category_name, confidence, category_id = await CategoryService.classify(
                db, owner_id=owner_id, description=parsed["description"]
            )
            tx_type = parsed["type"]
            tx_section = "in_and_out" if cat_section == "in_and_out" else tx_type

            transaction = Transaction(
                owner_id=owner_id,
                statement_id=statement.id,
                date=parsed["date"],
                description=parsed["description"],
                original_description=parsed["description"],
                amount=parsed["amount"],
                type=tx_type,
                category_id=category_id,
                currency=parsed.get("currency", "CZK"),
                original_amount=parsed["amount"],
                original_currency=parsed.get("currency", "CZK"),
                section=tx_section,
                category_name=category_name,
                status="classified" if cat_section != "unknown" else "review",
                confidence=confidence,
                account_id=account_id,
            )
            db.add(transaction)
            imported += 1

        statement.status = "completed"
        await db.flush()

        return statement, imported, skipped

    @staticmethod
    async def execute_excel_history(
        db: AsyncSession,
        owner_id: int,
        transactions: list[dict],
        filename: str,
    ) -> tuple[Statement, int, int]:
        """Import pre-parsed Excel history transactions."""
        statement = Statement(
            owner_id=owner_id,
            filename=filename,
            bank_name="Excel History Import",
            status="processing",
        )
        db.add(statement)
        await db.flush()
        await db.refresh(statement)

        imported = 0
        skipped = 0

        for txn in transactions:
            # Deduplicate (match on description, date, amount, type)
            existing = await db.execute(
                select(Transaction).where(
                    Transaction.owner_id == owner_id,
                    Transaction.original_description == txn["description"],
                    Transaction.date == txn["date"],
                    Transaction.amount == txn["amount"],
                    Transaction.type == txn["type"],
                )
            )
            if existing.scalar_one_or_none():
                skipped += 1
                continue

            # Use category from excel if available, otherwise classify
            category_name = txn.get("category_name")
            confidence = 0.9 if category_name else 0.0
            tx_type = txn["type"]
            category_id = None

            if not category_name:
                cat_section, category_name, confidence, category_id = await CategoryService.classify(
                    db, owner_id=owner_id, description=txn["description"]
                )
                tx_section = "in_and_out" if cat_section == "in_and_out" else tx_type
            else:
                tx_section = tx_type

            transaction = Transaction(
                owner_id=owner_id,
                statement_id=statement.id,
                date=txn["date"],
                description=txn["description"],
                original_description=txn["description"],
                amount=txn["amount"],
                type=tx_type,
                category_id=category_id,
                section=tx_section,
                category_name=category_name,
                status="classified",
                confidence=confidence,
            )
            db.add(transaction)
            imported += 1

        statement.status = "completed"
        await db.flush()

        return statement, imported, skipped

    @staticmethod
    def get_temp_path(owner_id: int, filename: str) -> str:
        """Get the temp file path for an uploaded import file."""
        safe_name = re.sub(r"[^\w.\-]", "_", filename)
        return os.path.join(UPLOAD_DIR, f"import_{owner_id}_{safe_name}")

    @staticmethod
    def cleanup_temp(file_path: str) -> bool:
        if os.path.exists(file_path):
            os.remove(file_path)
            return True
        return False


def _parse_csv(file_path: str) -> tuple[list[str], list[dict]]:
    """Parse a CSV file with auto-detected delimiter."""
    with open(file_path, "r", encoding="utf-8-sig") as f:
        sample = f.read(4096)
        f.seek(0)

        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
        except csv.Error:
            dialect = csv.excel

        reader = csv.DictReader(f, dialect=dialect)
        columns = reader.fieldnames or []
        rows = list(reader)

    return columns, rows


def _parse_xlsx(file_path: str) -> tuple[list[str], list[dict]]:
    """Parse an XLSX file (first sheet)."""
    import openpyxl

    wb = openpyxl.load_workbook(file_path, data_only=True, read_only=True)
    ws = wb.active

    rows_raw = list(ws.iter_rows(values_only=True))
    wb.close()

    if not rows_raw:
        return [], []

    # First row = headers
    headers = [str(h or f"Column_{i}") for i, h in enumerate(rows_raw[0])]
    rows = []
    for row_data in rows_raw[1:]:
        row_dict = {}
        for i, val in enumerate(row_data):
            if i < len(headers):
                row_dict[headers[i]] = val
        if any(v is not None for v in row_dict.values()):
            rows.append(row_dict)

    return headers, rows


def _map_row(
    row: dict,
    mapping: dict,
    date_format: str,
    decimal_separator: str,
    default_currency: str = "CZK",
) -> dict:
    """Map a raw row to a transaction dict using column mapping."""
    date_val = row.get(mapping["date_column"], "")
    desc_val = row.get(mapping["description_column"], "")
    amount_val = row.get(mapping["amount_column"], "")

    # Parse date
    parsed_date = _parse_date(date_val, date_format)

    # Parse amount
    parsed_amount = _parse_amount(amount_val, decimal_separator)

    # Determine type
    type_col = mapping.get("type_column")
    if type_col and row.get(type_col):
        raw_type = str(row[type_col]).lower().strip()
        if raw_type in ("income", "credit", "in", "+"):
            tx_type = "income"
        else:
            tx_type = "expense"
    else:
        tx_type = "income" if parsed_amount >= 0 else "expense"
        parsed_amount = abs(parsed_amount)

    description = str(desc_val).strip() if desc_val else "Unknown"

    # Extract currency
    currency_col = mapping.get("currency_column")
    if currency_col and row.get(currency_col):
        currency = str(row[currency_col]).strip().upper()[:3]
    else:
        currency = default_currency

    return {
        "date": parsed_date,
        "description": description,
        "amount": abs(parsed_amount),
        "type": tx_type,
        "currency": currency,
    }


def _parse_amount(value, decimal_separator: str = ".") -> float:
    """Parse amount handling Czech (1 234,56) and English (1,234.56) formats."""
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)

    text = str(value).strip()
    # Remove currency symbols
    text = re.sub(r"[A-Za-z$€£¥Kč]", "", text)
    text = text.strip()

    if decimal_separator == ",":
        # Czech format: spaces/dots are thousand separators, comma is decimal
        text = text.replace(" ", "").replace(".", "")
        text = text.replace(",", ".")
    else:
        # English format: commas are thousand separators
        text = text.replace(" ", "").replace(",", "")

    try:
        return float(text)
    except ValueError:
        return 0.0


def _parse_date(value, date_format: str = "%Y-%m-%d") -> date:
    """Parse date from various formats."""
    if isinstance(value, date):
        return value
    if isinstance(value, datetime):
        return value.date()
    if value is None:
        return date.today()

    text = str(value).strip()

    # Try the specified format first
    try:
        return datetime.strptime(text, date_format).date()
    except ValueError:
        pass

    # Try common formats
    for fmt in ["%Y-%m-%d", "%d.%m.%Y", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y"]:
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue

    return date.today()
