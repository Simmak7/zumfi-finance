"""Raiffeisen Bank CZ statement parser.

STRUCTURE:
Raiffeisenbank CZ statements use a multi-row transaction format:
- Row 1: Transaction Date | Type | Category | Refs | Fee | Amount (CZK)
- Row 2: Value Date | Counterparty | Message | Codes | Foreign Amount (optional)
- Row 3: Account | Name | Details | Refs | Exchange Rate (optional)

Simple transactions (CZK only) appear as 1 row.
Complex transactions (EUR, detailed) span 2-3 rows.

PARSING STRATEGY:
1. Detect transaction table header ("Výpis pohybů")
2. Group rows into transactions based on date+amount presence
3. Extract data from each row in the group
4. Combine into single transaction dict

DATE FORMAT: dd.mm.yyyy (Czech standard)
AMOUNT FORMAT: -1 234,56 CZK (space thousands, comma decimal, negative = expense)

INCOME DETECTION:
- Keywords: příjem, příchozí platba, připsáno, vklad, úrok
- Positive amounts (no minus sign)
- Transaction type hints

FOREIGN CURRENCY:
- original_amount: Amount in foreign currency (EUR, USD, etc.)
- original_currency: Currency code
- amount: Settled amount in CZK
- Exchange rate extracted when available
"""

import re
import logging
from .base import BaseParser

logger = logging.getLogger(__name__)


class RaiffeisenParser(BaseParser):
    BANK_NAME = "raiffeisen"

    INCOME_KEYWORDS = [
        # Czech with diacritics
        "příjem", "příchozí", "příchozí platba", "příchozí úhrada",
        "připsáno", "vklad", "převod ve prospěch", "úrok",

        # Czech without diacritics
        "prijem", "prichozi", "prichozi platba", "prichozi uhrada",
        "pripsano", "prevod ve prospech", "urok",

        # Common patterns
        "salary", "plat", "mzda", "refund", "vratka", "navrat",
    ]

    EXPENSE_KEYWORDS = [
        "platba", "výběr", "poplatek", "payment",
        "vyber", "card", "kartou", "atm",
        "odchozí", "odchozi",
    ]

    def parse(self, pdf_path: str) -> list[dict]:
        from .document_reader import open_document

        transactions = []

        with open_document(pdf_path) as doc:
            for page in doc.pages:
                # Try table extraction first (Raiffeisen uses structured tables)
                tables = page.extract_tables()
                if tables:
                    transactions.extend(self._parse_tables(tables))
                else:
                    text = page.extract_text()
                    if text:
                        transactions.extend(self._parse_text(text))

        return transactions

    def _parse_tables(self, tables: list) -> list[dict]:
        """Parse Raiffeisen tables with multi-row transaction support."""
        results = []

        logger.info(f"Raiffeisen parser: Processing {len(tables)} tables")

        for table_idx, table in enumerate(tables):
            if not table or len(table) < 2:
                logger.debug(f"Table {table_idx} skipped - too small ({len(table) if table else 0} rows)")
                continue

            logger.info(f"Processing table {table_idx} with {len(table)} rows")

            # Find transaction table header
            header_idx = self._find_header_row(table)
            if header_idx is None:
                logger.warning(f"No header found in table {table_idx}")
                # Log first few rows to see what we have
                for i, row in enumerate(table[:5]):
                    logger.debug(f"  Row {i}: {[str(cell)[:30] for cell in row if cell]}")
                continue

            logger.info(f"Header found at index {header_idx}")

            # Group rows into multi-row transactions
            transaction_groups = self._group_transaction_rows(table[header_idx + 1:])
            logger.info(f"Grouped into {len(transaction_groups)} transaction groups")

            # Parse each group
            for group_idx, group in enumerate(transaction_groups):
                tx = self._parse_transaction_group(group)
                if tx:
                    results.append(tx)
                else:
                    logger.warning(f"Group {group_idx} failed to parse - {len(group)} rows")
                    for row in group[:3]:  # Only log first 3 rows of failed group
                        logger.debug(f"    Row: {[str(cell)[:30] for cell in row if cell]}")

        logger.info(f"Raiffeisen parser: Total transactions extracted: {len(results)}")
        return results

    def _find_header_row(self, table: list) -> int | None:
        """Find the row containing transaction table header."""
        for idx, row in enumerate(table):
            if not row:
                continue
            row_text = " ".join(str(cell) for cell in row if cell).lower()
            # Look for characteristic header words
            if "výpis" in row_text or "datum" in row_text or "částka" in row_text:
                return idx
        return None

    def _group_transaction_rows(self, rows: list) -> list[list]:
        """Group consecutive rows into multi-row transactions."""
        groups = []
        current_group = []

        for row in rows:
            if not row or all(not cell or str(cell).strip() == "" for cell in row):
                # Empty row - finalize current group
                if current_group:
                    groups.append(current_group)
                    current_group = []
                continue

            if self._is_transaction_start_row(row):
                # New transaction starts - save previous group
                if current_group:
                    groups.append(current_group)
                current_group = [row]
            elif self._is_continuation_row(row):
                # Continuation of current transaction
                current_group.append(row)
            else:
                # Uncertain row - start new group to be safe
                if current_group:
                    groups.append(current_group)
                current_group = [row]

        # Don't forget last group
        if current_group:
            groups.append(current_group)

        return groups

    def _is_transaction_start_row(self, row: list) -> bool:
        """Check if row starts a new transaction (has date + CZK amount)."""
        has_date = False
        has_czk_amount = False

        for cell in row:
            if not cell:
                continue
            cell_str = str(cell).strip()

            # Check for date
            if re.match(r"^\d{1,2}\.\s?\d{1,2}\.\s?\d{4}$", cell_str):
                has_date = True

            # Check for CZK amount - handle both comma and period as decimal separator
            if re.search(r"-?[\d\s]+[,.]\d{2}\s*CZK", cell_str):
                has_czk_amount = True

        return has_date and has_czk_amount

    def _is_continuation_row(self, row: list) -> bool:
        """Check if row continues previous transaction."""
        row_text = " ".join(str(cell) for cell in row if cell).strip()

        # Has payment reference codes
        if re.search(r"\b(KS|VS|SS|PK):", row_text):
            return True

        # Has IBAN-like account number
        if re.search(r"\b[A-Z]{2}\d{2}[\d\s]{10,}", row_text):
            return True

        # Has EUR amount (but no CZK - that would be start row)
        if "EUR" in row_text and "CZK" not in row_text:
            return True

        # Has transaction/card number pattern
        if re.search(r"\b\d{8,12}\b", row_text):
            return True

        return False

    def _parse_transaction_group(self, rows: list[list]) -> dict | None:
        """Parse a group of 1-3 rows into a single transaction."""
        if not rows:
            return None

        # Row 1: Main transaction data
        row1 = rows[0]
        transaction_date = self._extract_transaction_date(row1)
        transaction_type = self._extract_transaction_type(row1)
        czk_amount_str = self._extract_czk_amount(row1)

        if not transaction_date or not czk_amount_str:
            return None

        # Parse amount and determine sign
        czk_amount = self.clean_amount(czk_amount_str)
        is_negative = "-" in czk_amount_str

        # Row 2 & 3: Counterparty, references, foreign currency
        counterparty = ""
        merchant_info = ""
        foreign_amount = None
        foreign_currency = None

        if len(rows) > 1:
            row2 = rows[1]
            counterparty = self._extract_counterparty(row2)
            foreign_amount, foreign_currency = self._extract_foreign_currency(row2)

        if len(rows) > 2:
            row3 = rows[2]
            merchant_info = self._extract_merchant_info(row3)
            # Try extracting foreign currency from row 3 if not found in row 2
            if not foreign_amount:
                foreign_amount, foreign_currency = self._extract_foreign_currency(row3)

        # Build description from available parts
        description_parts = []
        if transaction_type:
            description_parts.append(transaction_type)
        if counterparty:
            description_parts.append(counterparty)
        if merchant_info:
            description_parts.append(merchant_info)

        description = " | ".join(description_parts) if description_parts else "Transaction"

        # Determine income vs expense
        is_income = self._determine_income_type(
            transaction_type, description, is_negative
        )

        # Build transaction dict
        tx = {
            "date": transaction_date,
            "description": self.clean_description(description),
            "original_description": description,
            "amount": czk_amount,
            "type": "income" if is_income else "expense",
            "currency": "CZK",
        }

        # Add foreign currency if present
        if foreign_amount and foreign_currency:
            tx["original_amount"] = foreign_amount
            tx["original_currency"] = foreign_currency

        return tx

    def _extract_transaction_date(self, row: list) -> any:
        """Extract transaction date from first row (first date found)."""
        for cell in row:
            if not cell:
                continue
            cell_str = str(cell).strip()
            match = re.match(r"^(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})$", cell_str)
            if match:
                date_str = f"{match.group(1)}.{match.group(2)}.{match.group(3)}"
                return self.parse_date(date_str, "%d.%m.%Y")
        return None

    def _extract_transaction_type(self, row: list) -> str:
        """Extract transaction type from row (e.g., 'Platba kartou', 'Příchozí platba')."""
        for cell in row:
            if not cell:
                continue
            cell_str = str(cell).strip()
            # Look for Czech transaction type phrases
            if any(keyword in cell_str.lower() for keyword in ["platba", "příchozí", "prichozi", "trvalá", "inkaso"]):
                # Return full phrase, not just keyword
                if len(cell_str) > 4 and not re.match(r"^[\d\s,.-]+$", cell_str):
                    return cell_str
        return ""

    def _extract_czk_amount(self, row: list) -> str | None:
        """Extract CZK amount string from row."""
        for cell in row:
            if not cell:
                continue
            cell_str = str(cell).strip()
            # Look for CZK amount pattern - handle both comma and period as decimal separator
            match = re.search(r"(-?[\d\s]+[,.]\d{2})\s*CZK", cell_str)
            if match:
                return match.group(1)
        return None

    def _extract_counterparty(self, row: list) -> str:
        """Extract counterparty name from row."""
        for cell in row:
            if not cell:
                continue
            cell_str = str(cell).strip()
            # Look for capitalized names (not all caps, not all lowercase)
            if cell_str and len(cell_str) > 3:
                # Has capital letters and spaces (likely a name)
                if re.search(r"[A-Z][a-z]+ [A-Z][a-z]+", cell_str):
                    return cell_str
                # Or all caps separated by spaces
                if re.match(r"^[A-Z ]+$", cell_str) and len(cell_str.split()) > 1:
                    return cell_str
        return ""

    def _extract_merchant_info(self, row: list) -> str:
        """Extract merchant/location info from row."""
        for cell in row:
            if not cell:
                continue
            cell_str = str(cell).strip()
            # Look for merchant patterns (often has semicolons, location info)
            if ";" in cell_str and len(cell_str) > 10:
                # Clean up common patterns
                cell_str = re.sub(r"PK:\s*[\dX]+", "", cell_str)
                cell_str = re.sub(r"KS:\d+", "", cell_str)
                return cell_str.strip()
        return ""

    def _extract_foreign_currency(self, row: list) -> tuple[float | None, str | None]:
        """Extract foreign currency amount and code from row."""
        for cell in row:
            if not cell:
                continue
            cell_str = str(cell).strip()

            # Look for pattern: amount + currency code (EUR, USD, GBP, etc.)
            # Handle both comma and period as decimal separator
            match = re.search(r"(-?[\d\s]+[,.]\d{2})\s*(EUR|USD|GBP|PLN|CHF)", cell_str)
            if match:
                amount_str, currency = match.groups()
                amount = self.clean_amount(amount_str)
                return amount, currency

        return None, None

    def _determine_income_type(self, transaction_type: str, description: str, is_negative: bool) -> bool:
        """Determine if transaction is income using multiple signals."""

        # 1. Check amount sign (negative = expense, positive = income)
        if is_negative:
            # But check if it's explicitly an income type despite negative sign
            type_lower = transaction_type.lower()
            desc_lower = description.lower()
            if any(kw in type_lower for kw in self.INCOME_KEYWORDS):
                return True
            if any(kw in desc_lower for kw in self.INCOME_KEYWORDS):
                return True
            return False

        # 2. Positive amount - check if it's explicitly an expense keyword
        type_lower = transaction_type.lower()
        desc_lower = description.lower()

        if any(kw in type_lower for kw in self.EXPENSE_KEYWORDS):
            return False
        if any(kw in desc_lower for kw in self.EXPENSE_KEYWORDS):
            return False

        # 3. Check for income keywords
        if any(kw in type_lower for kw in self.INCOME_KEYWORDS):
            return True
        if any(kw in desc_lower for kw in self.INCOME_KEYWORDS):
            return True

        # 4. Default: positive = income, negative = expense
        return not is_negative

    def _parse_text(self, text: str) -> list[dict]:
        """Fallback text parsing for non-table PDFs."""
        results = []
        lines = text.split("\n")
        for line in lines:
            match = re.search(
                r"(\d{2}\.\d{2}\.\d{4})\s+(.*?)\s+([-\s]?[\d\s]+,\d{2})",
                line,
            )
            if not match:
                continue

            date_str, desc, amount_str = match.groups()
            amount = self.clean_amount(amount_str)
            is_negative = "-" in amount_str
            is_income = self._determine_income_type(desc, desc, is_negative)

            results.append({
                "date": self.parse_date(date_str, "%d.%m.%Y"),
                "description": self.clean_description(desc.strip()),
                "original_description": desc.strip(),
                "amount": amount,
                "type": "income" if is_income else "expense",
                "currency": "CZK",
            })
        return results
