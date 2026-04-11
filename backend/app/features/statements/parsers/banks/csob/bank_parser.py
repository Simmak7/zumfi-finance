"""ČSOB (Československá obchodní banka) statement parser.

PDF format: text-based, single table with 2-line transaction blocks.
Bank code: 0300
Date format: dd.mm. (year extracted from header "Rok/č. výpisu: YYYY/N")
Amount format: Czech — spaces as thousands separator, comma decimal,
               negative sign prefix for expenses: -37 256,90
Statement types: bank (transactions)

Transaction layout (2 lines per transaction):
  Line 1: dd.mm.  <description>  <counterparty_name>  <id>  <amount>  <balance>
  Line 2: <counterparty_account>  [VS]  [KS]  [SS]

Header provides:
  - Period:   "Období: D. M. YYYY - D. M. YYYY"
  - Year:     "Rok/č. výpisu: YYYY/N"
  - Currency: "Měna: CZK"
  - Account:  "Účet: NNNNNNN/0300"
"""

import re
import logging
from datetime import date

from features.statements.parsers.base import BaseParser

logger = logging.getLogger(__name__)

# Matches a transaction line starting with dd.mm.
# Captures: date, everything_else (description+counterparty+amounts)
_TX_LINE_RE = re.compile(
    r"^(\d{2}\.\d{2}\.)\s+(.+)$"
)

# Czech amount: optional minus, 1-3 leading digits, optional space-separated groups
# of exactly 3 digits, comma, 2 decimals.  Lookbehind/lookahead prevent grabbing
# adjacent ID numbers (e.g. "258 37 256,90" → only "37 256,90" matches).
_AMOUNT_RE = re.compile(
    r"(?<!\d)(-?\d{1,3}(?:\s\d{3})*,\d{2})(?!\d)"
)

# Year from header: "Rok/č. výpisu: 2026/3"
_YEAR_RE = re.compile(r"Rok/č\.\s*výpisu:\s*(\d{4})")

# Period from header: "Období: 1. 3. 2026 - 31. 3. 2026"
_PERIOD_RE = re.compile(
    r"Období:\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\s*-\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})"
)

# Currency from header
_CURRENCY_RE = re.compile(r"Měna:\s*(\w+)")


class CsobParser(BaseParser):
    BANK_NAME = "csob"

    def parse(self, pdf_path: str) -> list[dict]:
        from features.statements.parsers.document_reader import open_document

        all_lines: list[str] = []
        with open_document(pdf_path) as doc:
            for page in doc.pages:
                text = page.extract_text()
                if text:
                    all_lines.extend(text.split("\n"))

        if not all_lines:
            logger.warning(f"ČSOB: no text extracted from {pdf_path}")
            return []

        full_text = "\n".join(all_lines)

        # Extract year from header
        year = self._extract_year(full_text)

        # Extract currency (default CZK)
        currency = "CZK"
        cm = _CURRENCY_RE.search(full_text)
        if cm:
            currency = cm.group(1).upper()

        # Find the transaction section (after the table header line)
        tx_start = self._find_tx_start(all_lines)
        if tx_start < 0:
            logger.warning("ČSOB: could not find transaction section")
            return []

        transactions = self._parse_transactions(
            all_lines[tx_start:], year, currency,
        )

        if not transactions:
            logger.warning(f"ČSOB: 0 transactions from {pdf_path}")
        else:
            logger.info(
                f"ČSOB: parsed {len(transactions)} transactions from {pdf_path}"
            )
        return transactions

    # ── Savings support ──

    def extract_monthly_balances(self, pdf_path: str) -> dict[str, float] | None:
        """Not applicable for ČSOB bank statements (no multi-month savings)."""
        return None

    # ── Internal helpers ──

    @staticmethod
    def _extract_year(text: str) -> int:
        m = _YEAR_RE.search(text)
        if m:
            return int(m.group(1))
        # Fallback: try period line
        pm = _PERIOD_RE.search(text)
        if pm:
            return int(pm.group(6))
        return date.today().year

    @staticmethod
    def _find_tx_start(lines: list[str]) -> int:
        """Find the first line after the transaction table header."""
        for i, line in enumerate(lines):
            if "Datum" in line and "Částka" in line and "Zůstatek" in line:
                # The next line is the sub-header (Valuta / Protiúčet...)
                # Transactions start 2 lines after
                return i + 2
        return -1

    def _parse_transactions(
        self, lines: list[str], year: int, currency: str,
    ) -> list[dict]:
        results: list[dict] = []
        i = 0
        while i < len(lines):
            line = lines[i].strip()

            # Stop at footer text
            if self._is_footer(line):
                break

            m = _TX_LINE_RE.match(line)
            if not m:
                i += 1
                continue

            date_str = m.group(1)  # e.g. "05.03."
            rest = m.group(2)

            # Extract amounts from the rest of the line
            amounts = _AMOUNT_RE.findall(rest)
            if len(amounts) < 1:
                i += 1
                continue

            # Last amount = balance, second-to-last = transaction amount
            raw_amount = amounts[-2] if len(amounts) >= 2 else amounts[-1]

            # Description: everything before the amounts
            # Find the position of the first amount to split description
            desc_text = rest
            first_amount_pos = rest.find(amounts[0]) if amounts else len(rest)
            # For lines with counterparty name between description and amounts,
            # the description+counterparty is everything before the first amount
            desc_text = rest[:first_amount_pos].strip()

            # Collect continuation line (counterparty account on next line)
            counterparty_account = ""
            if i + 1 < len(lines):
                next_line = lines[i + 1].strip()
                if next_line and not _TX_LINE_RE.match(next_line) and not self._is_footer(next_line):
                    counterparty_account = next_line.split()[0] if next_line.split() else ""
                    i += 1  # skip continuation line

            # Parse date (dd.mm. + year)
            try:
                day = int(date_str[:2])
                month = int(date_str[3:5])
                tx_date = date(year, month, day)
            except (ValueError, IndexError):
                tx_date = self.parse_date(date_str, "%d.%m.")
                if tx_date.year == 1900:
                    tx_date = tx_date.replace(year=year)

            # Parse amount — clean_amount() always returns positive (BaseParser contract),
            # so detect sign from the raw string before cleaning.
            is_negative = raw_amount.strip().startswith("-")
            amount_val = self.clean_amount(raw_amount)
            tx_type = "expense" if is_negative else "income"

            # Strip trailing standalone ID number (e.g. "258", "259")
            # that sits between the counterparty name and the amounts.
            desc_core = re.sub(r"\s+\d{1,4}$", "", desc_text)

            # Build description
            original_desc = desc_text
            if counterparty_account:
                original_desc = f"{desc_text} {counterparty_account}"
            cleaned_desc = self.clean_description(desc_core)

            results.append({
                "date": tx_date,
                "description": cleaned_desc,
                "original_description": original_desc,
                "amount": amount_val,
                "type": tx_type,
                "currency": currency,
            })

            i += 1

        return results

    @staticmethod
    def _is_footer(line: str) -> bool:
        """Check if a line is part of the footer (end of transactions)."""
        footer_markers = [
            "Prosíme Vás",
            "Pokud při zúčtování",
            "Vklad na tomto účtu",
            "Československá obchodní banka",
            "zapsaná v obchodním",
        ]
        return any(marker in line for marker in footer_markers)
