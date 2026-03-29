"""FIO Banka CZ statement parser.

Date format: dd.mm.yyyy (may be single or double digit day/month)
FIO statements have well-structured tables with columns:
Datum, Objem, Mena, Protiucet, Typ, Zprava pro prijemce
Income: positive amounts, "Prijem" type column, or no minus sign
"""

import re
import logging
from .base import BaseParser

logger = logging.getLogger(__name__)

# Match date in dd.mm.yyyy format (1 or 2 digit day/month)
_DATE_RE = re.compile(r"\d{1,2}\.\d{1,2}\.\d{4}")


class FioParser(BaseParser):
    BANK_NAME = "fio"

    INCOME_TYPES = ["příjem", "prijem", "bezhotovostní příjem", "vklad"]

    def parse(self, pdf_path: str) -> list[dict]:
        from .document_reader import open_document

        transactions = []

        with open_document(pdf_path) as doc:
            for page in doc.pages:
                tables = page.extract_tables()
                if tables:
                    transactions.extend(self._parse_tables(tables))
                else:
                    text = page.extract_text()
                    if text:
                        transactions.extend(self._parse_text(text))

        if not transactions:
            logger.warning(f"FIO: 0 transactions extracted from {pdf_path}")

        return transactions

    def _parse_tables(self, tables: list) -> list[dict]:
        results = []
        for table in tables:
            header_row = None
            for i, row in enumerate(table):
                if not row:
                    continue
                row_text = " ".join(str(c).lower() for c in row if c)
                if "datum" in row_text and ("objem" in row_text or "částka" in row_text or "castka" in row_text):
                    header_row = i
                    break

            if header_row is None:
                # Try parsing without header detection
                for row in table:
                    tx = self._try_parse_row(row)
                    if tx:
                        results.append(tx)
                continue

            # Parse rows after header
            for row in table[header_row + 1:]:
                tx = self._try_parse_row(row)
                if tx:
                    results.append(tx)

        return results

    def _try_parse_row(self, row: list) -> dict | None:
        if not row or len(row) < 3:
            return None

        # Find date cell (handle both "01.01.2025" and "1.1.2025")
        date_str = None
        for cell in row:
            cell_str = str(cell).strip() if cell else ""
            m = _DATE_RE.match(cell_str)
            if m:
                date_str = m.group()
                break
        if not date_str:
            return None

        # Find amount cell
        amount_str = None
        for cell in row:
            cell_str = str(cell).strip() if cell else ""
            if re.search(r"-?[\d\s]+[,.]\d{2}", cell_str):
                amount_str = cell_str
                break
        if not amount_str:
            return None

        # Description, type hint, and currency from remaining cells
        desc = ""
        type_hint = ""
        currency = "CZK"
        for cell in row:
            cell_str = str(cell).strip() if cell else ""
            if cell_str == date_str or cell_str == amount_str:
                continue
            if re.match(r"^[\d\s,.-]+$", cell_str):
                continue
            # Check if this is a currency cell (3-letter code)
            if re.match(r"^[A-Z]{3}$", cell_str):
                currency = cell_str
                continue
            # Check if this is a type column
            if cell_str.lower() in [t.lower() for t in self.INCOME_TYPES + ["výdaj", "platba"]]:
                type_hint = cell_str.lower()
                continue
            if len(cell_str) > len(desc):
                desc = cell_str

        amount = self.clean_amount(amount_str)
        is_income = self._is_income(type_hint, desc, amount_str)

        return {
            "date": self.parse_date(date_str, "%d.%m.%Y"),
            "description": self.clean_description(desc) if desc else "FIO Transaction",
            "original_description": desc or "FIO Transaction",
            "amount": amount,
            "type": "income" if is_income else "expense",
            "currency": currency,
        }

    def _parse_text(self, text: str) -> list[dict]:
        results = []
        lines = text.split("\n")
        for line in lines:
            # Match date (1 or 2 digit day/month), description, amount, optional currency
            match = re.search(
                r"(\d{1,2}\.\d{1,2}\.\d{4})\s+(.*?)\s+([-\s]?[\d\s]+[,.]\d{2})\s*([A-Z]{3})?",
                line,
            )
            if not match:
                continue

            date_str, desc, amount_str, currency = match.groups()
            currency = currency or "CZK"
            amount = self.clean_amount(amount_str)
            is_income = self._is_income("", desc, amount_str)

            results.append({
                "date": self.parse_date(date_str, "%d.%m.%Y"),
                "description": self.clean_description(desc.strip()),
                "original_description": desc.strip(),
                "amount": amount,
                "type": "income" if is_income else "expense",
                "currency": currency,
            })
        return results

    def _is_income(self, type_hint: str, desc: str, amount_str: str) -> bool:
        """Determine if a transaction is income.

        Priority: type column hint > description keywords > amount sign.
        """
        # 1. Type column hint (most reliable)
        if type_hint and any(t in type_hint for t in ["příjem", "prijem", "vklad"]):
            return True
        if type_hint and any(t in type_hint for t in ["výdaj", "platba"]):
            return False

        # 2. Description keywords
        desc_lower = desc.lower()
        if any(kw in desc_lower for kw in self.INCOME_TYPES):
            return True

        # 3. Amount sign: no minus sign means income (positive amount)
        if "-" not in amount_str:
            return True

        return False
