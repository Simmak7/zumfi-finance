"""Revolut bank statement parser.

Supports two statement formats:
1. CZK format: "Sep 2, 2025  Description  114.94 CZK  500.00 CZK"
2. EUR/symbol format: "Sep 2, 2025  Description  €114.94  €500.00"
   (uses currency symbol prefix instead of 3-letter code suffix)

Date format: "Dec 13, 2025" (%b %d, %Y)
Income keywords: top-up, exchanged from, refund, payment from
"""

import re
import logging
from .base import BaseParser

logger = logging.getLogger(__name__)

# Currency symbol to ISO code mapping
_SYMBOL_TO_CODE = {
    "€": "EUR",
    "$": "USD",
    "£": "GBP",
    "¥": "JPY",
    "Fr": "CHF",
}

# Date pattern at start of transaction lines
_DATE_RE = r"^([A-Z][a-z]{2}\s\d{1,2},\s\d{4})\s+"

# Format 1: amount followed by 3-letter currency code (e.g. "114.94 CZK")
_AMOUNT_CODE_RE = re.compile(
    _DATE_RE
    + r"(.*?)\s+([\d,.]+)\s+([A-Z]{3})"
    r"(\s+[\d,.]+\s+[A-Z]{3})?"
)

# Format 2: currency symbol prefix (e.g. "€114.94 €500.00")
# Captures: date, description, symbol+amount, symbol+balance
_AMOUNT_SYMBOL_RE = re.compile(
    _DATE_RE
    + r"(.*?)\s+"
    r"([€$£¥][\d,.]+)"        # money out or money in
    r"\s+([€$£¥][\d,.]+)"     # balance
)


class RevolutParser(BaseParser):
    BANK_NAME = "revolut"

    INCOME_KEYWORDS = [
        "top-up", "exchanged from", "refund", "payment from",
        "transfer from",
    ]

    def _is_next_line_extra(self, lines: list[str], i: int) -> bool:
        """Check if the next line is a continuation/detail line (not a new tx)."""
        if i + 1 >= len(lines):
            return False
        next_line = lines[i + 1].strip()
        if not next_line:
            return False
        # Not a new transaction line
        if re.match(_DATE_RE, next_line):
            return False
        # Not a footer/header line
        if next_line.startswith(("Report lost", "© ", "Date Description")):
            return False
        return True

    @staticmethod
    def _extract_opening_balance(text: str) -> float | None:
        """Extract opening balance from the balance summary section."""
        # Matches lines like: "Account (Current Account) €1.99 €1,670.42 ..."
        # The first €amount after the account label is the opening balance
        m = re.search(r"Opening balance.*?([€$£¥])([\d,.]+)", text, re.IGNORECASE)
        if not m:
            # Try the Account line directly
            m = re.search(r"Account\s.*?([€$£¥])([\d,.]+)", text)
        if m:
            return BaseParser.clean_amount(m.group(2))
        return None

    def parse(self, pdf_path: str) -> list[dict]:
        from .document_reader import open_document

        transactions = []
        total_lines = 0
        prev_balance = None

        with open_document(pdf_path) as doc:
            # Try to get opening balance from first page
            first_text = doc.pages[0].extract_text() if doc.pages else ""
            if first_text:
                prev_balance = self._extract_opening_balance(first_text)

            for page in doc.pages:
                text = page.extract_text()
                if not text:
                    continue

                lines = text.split("\n")
                total_lines += len(lines)

                for i, line in enumerate(lines):
                    # Try format 1: "amount CZK"
                    match = _AMOUNT_CODE_RE.search(line)
                    if match:
                        date_str, desc, amount_str, currency, _bal = match.groups()
                        amount = self.clean_amount(amount_str)
                        desc_lower = desc.lower()
                        is_income = any(kw in desc_lower for kw in self.INCOME_KEYWORDS)

                        transactions.append({
                            "date": self.parse_date(date_str, "%b %d, %Y"),
                            "description": self.clean_description(desc.strip()),
                            "original_description": desc.strip(),
                            "amount": amount,
                            "type": "income" if is_income else "expense",
                            "currency": currency,
                        })
                        continue

                    # Try format 2: "€amount €balance"
                    match = _AMOUNT_SYMBOL_RE.search(line)
                    if match:
                        date_str, desc, sym_amount, sym_balance = match.groups()

                        symbol = sym_amount[0]
                        currency = _SYMBOL_TO_CODE.get(symbol, "EUR")
                        amount = self.clean_amount(sym_amount[1:])
                        balance = self.clean_amount(sym_balance[1:])

                        # Determine income/expense from balance change
                        desc_lower = desc.lower()
                        if any(kw in desc_lower for kw in self.INCOME_KEYWORDS):
                            is_income = True
                        elif prev_balance is not None:
                            is_income = balance > prev_balance
                        else:
                            is_income = any(kw in desc_lower for kw in self.INCOME_KEYWORDS)

                        prev_balance = balance

                        transactions.append({
                            "date": self.parse_date(date_str, "%b %d, %Y"),
                            "description": self.clean_description(desc.strip()),
                            "original_description": desc.strip(),
                            "amount": amount,
                            "type": "income" if is_income else "expense",
                            "currency": currency,
                        })
                        continue

        if not transactions and total_lines > 0:
            logger.warning(
                f"Revolut: {total_lines} lines scanned but 0 transactions matched"
            )

        return transactions
