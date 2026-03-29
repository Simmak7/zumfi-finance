"""Generic bank statement parser — last-resort fallback.

Scans every page for lines containing a date and a numeric amount,
regardless of bank-specific formatting. Works with most tabular
bank statements from any bank.

Supported date formats:
  - dd.mm.yyyy (Czech/European)
  - yyyy-mm-dd (ISO)
  - dd/mm/yyyy (European slash)
  - Mon dd, yyyy (English, e.g. "Jan 15, 2025")

Amount detection:
  - Czech: 1 234,56 or -1 234,56
  - English: 1,234.56 or -1,234.56
  - Plain: 1234.56
  - With currency code suffix/prefix: CZK, EUR, USD, etc.
"""

import re
import logging
from .base import BaseParser

logger = logging.getLogger(__name__)

# Date patterns (named groups for clarity)
_DATE_PATTERNS = [
    # dd.mm.yyyy (1 or 2 digit day/month)
    (re.compile(r"(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})"), "%d.%m.%Y"),
    # yyyy-mm-dd
    (re.compile(r"(\d{4})-(\d{2})-(\d{2})"), "%Y-%m-%d"),
    # dd/mm/yyyy
    (re.compile(r"(\d{1,2})/(\d{1,2})/(\d{4})"), "%d/%m/%Y"),
    # Mon dd, yyyy (e.g. "Jan 15, 2025")
    (re.compile(r"([A-Z][a-z]{2}\s\d{1,2},\s\d{4})"), "%b %d, %Y"),
]

# Amount pattern — matches numbers with optional thousands separators and decimals
# Captures the full amount string including optional leading minus
_AMOUNT_RE = re.compile(
    r"(-?\s?[\d][\d\s.,]*\d)"  # at least 2 digits with separators
)

# Lines to skip (headers, footers, page numbers, etc.)
_SKIP_PATTERNS = re.compile(
    r"(?i)^("
    r"strana\s|page\s|str\.\s|"
    r"výpis|statement|account\s+summary|"
    r"datum.*objem|date.*amount|"
    r"počáteční|konečný|opening|closing|balance|"
    r"celkem|total|"
    r"iban|bic|swift|"
    r"\d{1,3}\s*$"  # bare page numbers
    r")"
)


class GenericParser(BaseParser):
    BANK_NAME = "generic"

    def parse(self, pdf_path: str) -> list[dict]:
        from .document_reader import open_document

        transactions = []

        with open_document(pdf_path) as doc:
            for page in doc.pages:
                page_txs = []

                # Try tables first (more structured)
                tables = page.extract_tables()
                if tables:
                    page_txs = self._parse_tables(tables)

                # Also try text extraction — use if it finds more transactions
                text = page.extract_text()
                if text:
                    text_txs = self._parse_text(text)
                    if len(text_txs) > len(page_txs):
                        page_txs = text_txs

                transactions.extend(page_txs)

        if transactions:
            logger.info(f"Generic parser: extracted {len(transactions)} transactions")
        else:
            logger.warning(f"Generic parser: 0 transactions from {pdf_path}")

        return transactions

    def _parse_tables(self, tables: list) -> list[dict]:
        """Extract transactions from pdfplumber tables."""
        results = []
        for table in tables:
            if not table or len(table) < 2:
                continue

            # Try to find header row with date and amount columns
            date_col = None
            amount_col = None
            desc_col = None
            currency_col = None
            type_col = None
            start_row = 0

            for i, row in enumerate(table):
                if not row:
                    continue
                row_lower = [str(c).lower().strip() if c else "" for c in row]
                for j, cell in enumerate(row_lower):
                    if not cell:
                        continue
                    if date_col is None and any(k in cell for k in [
                        "datum", "date", "valuta", "dátum",
                    ]):
                        date_col = j
                    if amount_col is None and any(k in cell for k in [
                        "částka", "castka", "objem", "amount", "suma",
                        "sum", "value", "kwota",
                    ]):
                        amount_col = j
                    if desc_col is None and any(k in cell for k in [
                        "popis", "description", "název", "nazev", "name",
                        "zpráva", "zprava", "text", "detail", "memo",
                        "příjemce", "prijemce", "poznámka",
                    ]):
                        desc_col = j
                    if currency_col is None and any(k in cell for k in [
                        "měna", "mena", "currency", "curr",
                    ]):
                        currency_col = j
                    if type_col is None and any(k in cell for k in [
                        "typ", "type", "směr", "smer", "direction",
                    ]):
                        type_col = j

                if date_col is not None and amount_col is not None:
                    start_row = i + 1
                    break

            if date_col is None or amount_col is None:
                # No header found — try parsing each row generically
                for row in table:
                    tx = self._try_parse_generic_row(row)
                    if tx:
                        results.append(tx)
                continue

            # If no description column found, use the longest non-date/amount cell
            for row in table[start_row:]:
                if not row or len(row) <= max(date_col, amount_col):
                    continue

                date_cell = str(row[date_col]).strip() if row[date_col] else ""
                amount_cell = str(row[amount_col]).strip() if row[amount_col] else ""

                parsed_date = self._extract_date(date_cell)
                if not parsed_date:
                    continue

                amount = self.clean_amount(amount_cell)
                if amount == 0.0:
                    continue

                # Description
                if desc_col is not None and desc_col < len(row) and row[desc_col]:
                    desc = str(row[desc_col]).strip()
                else:
                    # Pick longest remaining cell as description
                    desc = self._longest_text_cell(row, exclude={date_col, amount_col})

                # Currency
                currency = "CZK"
                if currency_col is not None and currency_col < len(row) and row[currency_col]:
                    c = str(row[currency_col]).strip().upper()
                    if re.match(r"^[A-Z]{3}$", c):
                        currency = c

                # Type
                is_income = False
                if type_col is not None and type_col < len(row) and row[type_col]:
                    t = str(row[type_col]).strip().lower()
                    is_income = any(k in t for k in [
                        "příjem", "prijem", "income", "credit", "vklad",
                    ])
                else:
                    is_income = "-" not in amount_cell

                results.append({
                    "date": parsed_date,
                    "description": self.clean_description(desc) if desc else "Transaction",
                    "original_description": desc or "Transaction",
                    "amount": amount,
                    "type": "income" if is_income else "expense",
                    "currency": currency,
                })

        return results

    def _parse_text(self, text: str) -> list[dict]:
        """Extract transactions from plain text lines."""
        results = []

        for line in text.split("\n"):
            line = line.strip()
            if not line or len(line) < 10:
                continue
            if _SKIP_PATTERNS.match(line):
                continue

            parsed_date = self._extract_date(line)
            if not parsed_date:
                continue

            # Find amounts in the line (after removing the date match)
            amounts = self._extract_amounts(line)
            if not amounts:
                continue

            # Use the first (or only) amount as the transaction amount
            amount_str = amounts[0]
            amount = self.clean_amount(amount_str)
            if amount == 0.0:
                continue

            # Extract description: text between date and amount
            desc = self._extract_description(line, parsed_date, amount_str)
            is_income = "-" not in amount_str

            # Try to find currency code near the amount
            currency = self._extract_currency(line) or "CZK"

            results.append({
                "date": parsed_date,
                "description": self.clean_description(desc) if desc else "Transaction",
                "original_description": desc or "Transaction",
                "amount": amount,
                "type": "income" if is_income else "expense",
                "currency": currency,
            })

        return results

    def _try_parse_generic_row(self, row: list) -> dict | None:
        """Try to parse a table row without header context."""
        if not row or len(row) < 2:
            return None

        parsed_date = None
        amount_str = None
        desc = ""

        for cell in row:
            cell_str = str(cell).strip() if cell else ""
            if not cell_str:
                continue

            if parsed_date is None:
                d = self._extract_date(cell_str)
                if d:
                    parsed_date = d
                    continue

            if amount_str is None and re.search(r"-?[\d\s]+[,.]\d{2}", cell_str):
                amount_str = cell_str
                continue

            if len(cell_str) > len(desc) and not re.match(r"^[\d\s,.\-]+$", cell_str):
                desc = cell_str

        if not parsed_date or not amount_str:
            return None

        amount = self.clean_amount(amount_str)
        if amount == 0.0:
            return None

        return {
            "date": parsed_date,
            "description": self.clean_description(desc) if desc else "Transaction",
            "original_description": desc or "Transaction",
            "amount": amount,
            "type": "income" if "-" not in amount_str else "expense",
            "currency": self._extract_currency(amount_str) or "CZK",
        }

    @staticmethod
    def _extract_date(text: str):
        """Try all date patterns and return the first match."""
        for pattern, fmt in _DATE_PATTERNS:
            m = pattern.search(text)
            if m:
                try:
                    return BaseParser.parse_date(m.group(0), fmt)
                except Exception:
                    continue
        return None

    @staticmethod
    def _extract_amounts(line: str) -> list[str]:
        """Find all amount-like strings in a line."""
        matches = _AMOUNT_RE.findall(line)
        # Filter: must have at least one digit and a decimal part
        results = []
        for m in matches:
            cleaned = m.strip()
            if re.search(r"[.,]\d{2}$", cleaned) and len(cleaned) >= 4:
                results.append(cleaned)
        return results

    @staticmethod
    def _extract_description(line: str, parsed_date, amount_str: str) -> str:
        """Extract description text between date and amount."""
        # Remove date patterns from line
        desc = line
        for pattern, _ in _DATE_PATTERNS:
            desc = pattern.sub("", desc, count=1)

        # Remove the amount string
        idx = desc.find(amount_str)
        if idx >= 0:
            desc = desc[:idx]

        # Clean up remaining text
        desc = re.sub(r"\s+", " ", desc).strip()
        # Remove trailing/leading separators
        desc = desc.strip(" |;-,")
        return desc

    @staticmethod
    def _extract_currency(text: str) -> str | None:
        """Try to find a 3-letter currency code in text."""
        common = ["CZK", "EUR", "USD", "GBP", "PLN", "CHF", "HUF", "SEK", "NOK", "DKK"]
        text_upper = text.upper()
        for code in common:
            if code in text_upper:
                return code
        return None

    @staticmethod
    def _longest_text_cell(row: list, exclude: set) -> str:
        """Find the longest text cell in a row, excluding certain columns."""
        best = ""
        for i, cell in enumerate(row):
            if i in exclude:
                continue
            cell_str = str(cell).strip() if cell else ""
            if len(cell_str) > len(best) and not re.match(r"^[\d\s,.\-]+$", cell_str):
                best = cell_str
        return best
