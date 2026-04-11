"""Raiffeisen Bank CZ statement parser — Block-based multi-line format.

Each transaction is a 2-4 line block:
  Line 1 (Datum):  Date + Category + Type + Amount + CZK
  Line 2 (Valuta): Valuta date + Account/KS + [Original foreign amount]
  Line 3 (Code):   Transaction code + Name + [PK card] + [Exchange rate]
  Line 4 (Detail): [Foreign amount;Merchant;Location;Country]

For foreign currency payments, the CZK amount is the main amount
and the foreign currency is stored in original_amount/original_currency.
"""

import re
import logging
from features.statements.parsers.base import BaseParser

logger = logging.getLogger(__name__)

# Match any ISO 4217 3-letter currency code (context in regex ensures accuracy)
_ANY_CURRENCY = r"[A-Z]{3}"

_SKIP_PREFIXES = (
    "Výpis z", "Pořadové", "Strana ", "Raiffeisenbank",
    "Přehled", "Číslo účtu", "Název účtu", "IBAN", "BIC:",
    "Počáteční", "Příjmy celkem", "Výdaje celkem", "Konečný",
    "Pohledávky", "Poplatky", "Výpis pohybů",
    "Datum Kategorie", "Valuta Číslo", "Kód transakce Název",
)

# Main transaction line: date + description + amount + CZK/Kč (home currency only)
_MAIN_LINE_RE = re.compile(
    r"(\d{1,2}\.\s?\d{1,2}\.\s?\d{4})\s+(.+?)\s+(-?[\d\s]+[,.]\d{2})\s*(?:CZK|Kč)\s*$"
)

# Savings account variant: same but NO currency suffix (amounts end at line end)
_SAVINGS_LINE_RE = re.compile(
    r"^(\d{1,2}\.\s?\d{1,2}\.\s?\d{4})\s+(.+?)\s+(-?[\d\s]+[.,]\d{2})\s*$"
)


class RaiffeisenParser(BaseParser):
    BANK_NAME = "raiffeisen"

    INCOME_KEYWORDS = [
        "příjem", "příchozí", "příchozí platba", "příchozí úhrada",
        "připsáno", "vklad", "převod ve prospěch", "úrok",
        "prijem", "prichozi", "prichozi platba", "prichozi uhrada",
        "pripsano", "prevod ve prospech", "urok",
    ]

    def parse(self, pdf_path: str) -> list[dict]:
        from features.statements.parsers.document_reader import open_document

        all_lines = []
        with open_document(pdf_path) as doc:
            for page in doc.pages:
                text = page.extract_text()
                if not text:
                    continue
                for line in text.split("\n"):
                    stripped = line.strip()
                    if stripped and not self._is_page_header(stripped):
                        all_lines.append(stripped)

        if not all_lines:
            logger.warning(f"Raiffeisen: No text lines extracted from {pdf_path}")
            return []

        results = self._parse_blocks(all_lines)
        if not results:
            logger.warning(
                f"Raiffeisen: {len(all_lines)} lines found but 0 transactions matched. "
                f"First 3 lines: {all_lines[:3]}"
            )
        return results

    @staticmethod
    def _is_page_header(line: str) -> bool:
        if any(line.startswith(p) for p in _SKIP_PREFIXES):
            return True
        if re.match(r"^[\d:.•\s]+$", line) and len(line) < 20:
            return True
        if len(line) < 3:
            return True
        return False

    def _parse_blocks(self, lines: list[str]) -> list[dict]:
        """Split lines into transaction blocks and parse each."""
        block_starts = []
        for i, line in enumerate(lines):
            if _MAIN_LINE_RE.search(line) or _SAVINGS_LINE_RE.search(line):
                block_starts.append(i)

        results = []
        for b_idx, start in enumerate(block_starts):
            end = (
                block_starts[b_idx + 1]
                if b_idx + 1 < len(block_starts)
                else len(lines)
            )
            tx = self._parse_single_block(lines[start:end])
            if tx:
                results.append(tx)

        logger.info(f"Raiffeisen: Extracted {len(results)} transactions")
        return results

    def _parse_single_block(self, block: list[str]) -> dict | None:
        """Parse one transaction block (2-4 lines)."""
        match = _MAIN_LINE_RE.search(block[0])
        if not match:
            match = _SAVINGS_LINE_RE.search(block[0])
        if not match:
            return None

        date_str, desc, amount_str = match.groups()

        merchant_name = None
        transaction_code = None
        original_amount = None
        original_currency = None

        for detail in block[1:]:
            # --- Valuta line: starts with date ---
            if re.match(r"^\d{1,2}\.\s?\d{1,2}\.\s?\d{4}", detail):
                val_match = re.search(
                    r"(-?[\d\s]+[,.]\d{2})\s*(" + _ANY_CURRENCY + r")\s*$",
                    detail,
                )
                if val_match:
                    fa_str = re.sub(r"(\d)\s+(\d)", r"\1\2", val_match.group(1))
                    fa = self.clean_amount(fa_str)
                    if fa != 0.0:
                        original_amount = fa
                        original_currency = val_match.group(2)
                continue

            # --- Transaction code line: "8436776146 ..." ---
            code_match = re.match(r"^(\d{10,})\s+(.*)", detail)
            if code_match:
                transaction_code = code_match.group(1)
                remainder = code_match.group(2).strip()

                rate_match = re.search(
                    r"[\d,.]+\s*CZK/(" + _ANY_CURRENCY + r")\s*$",
                    remainder,
                )
                if rate_match:
                    if not original_currency:
                        original_currency = rate_match.group(1)
                    remainder = remainder[: rate_match.start()].strip()

                if "PK:" not in remainder and remainder and len(remainder) >= 2:
                    if not merchant_name:
                        merchant_name = remainder
                continue

            # --- Foreign detail: "3,00 EUR;ORLEN CS 731 SVIT; Svit; SVK" ---
            foreign_match = re.match(
                r"^([\d\s]+[,.]\d{2})\s*(" + _ANY_CURRENCY + r");([^;]+)",
                detail,
            )
            if foreign_match:
                fa_str = re.sub(
                    r"(\d)\s+(\d)", r"\1\2", foreign_match.group(1)
                )
                fa = self.clean_amount(fa_str)
                if fa != 0.0 and not original_amount:
                    original_amount = fa
                    original_currency = foreign_match.group(2)
                fm = foreign_match.group(3).strip()
                if fm and len(fm) >= 2:
                    merchant_name = fm
                continue

            # --- Merchant location: "GOPARKING.CZ; PRAHA 8; CZE" ---
            loc_match = re.match(
                r"^([^;]+);[^;]*;\s*[A-Z]{3}\s*$",
                detail,
            )
            if loc_match:
                merchant_name = loc_match.group(1).strip()
                continue

        # Build description
        if merchant_name:
            description = merchant_name
        else:
            description = desc.strip()
            description = re.sub(
                r"(Platba kartou)\s+\1", r"\1",
                description, flags=re.IGNORECASE,
            )
            description = re.sub(
                r"^Platba\s+Platba\b", "Platba",
                description, flags=re.IGNORECASE,
            )

        # Parse amount
        amount_norm = re.sub(r"(\d)\s+(\d)", r"\1\2", amount_str)
        amount = self.clean_amount(amount_norm)

        # Determine type
        is_negative = "-" in amount_str
        desc_lower = description.lower()
        is_income = (
            any(kw in desc_lower for kw in self.INCOME_KEYWORDS)
            or (not is_negative and "platba" not in desc_lower)
        )

        if amount == 0.0:
            logger.warning(f"Skipped zero amount: {date_str}")
            return None

        return {
            "date": self.parse_date(
                date_str.strip().replace(" ", ""), "%d.%m.%Y"
            ),
            "description": self.clean_description(description),
            "original_description": (
                f"{desc.strip()} | {merchant_name or ''}"
            ),
            "amount": amount,
            "type": "income" if is_income else "expense",
            "currency": "CZK",
            "original_amount": original_amount,
            "original_currency": original_currency,
            "transaction_code": transaction_code,
        }
