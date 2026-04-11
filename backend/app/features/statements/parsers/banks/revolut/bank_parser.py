"""Revolut bank statement parser (multi-currency).

Handles single- and multi-currency Revolut statements. A single PDF may contain
several currency sections (EUR / USD / CZK / GBP / ...), each with its own
balance summary and transaction list. The parser detects section boundaries,
resets the running balance on each new section, and attributes every
transaction to its section currency.

PDF layout (per section):
    Page header : "{CURRENCY} Statement"
                  "Generated on the {date}"
                  "Revolut Bank UAB"
    Balance summary block (first page of section only):
        "Account (Current Account) {opening} {money_out} {money_in} {closing}"
    Transaction table (continues across pages):
        "Date Description Money out Money in Balance"
        "{mon} {d}, {YYYY}   {description}   {amount}   {balance}"
        (continuation lines: Reference:, From:, To:, Card:, Revolut Rate ...,
         bare cross-currency amount, Fee: lines)

Two amount formats appear depending on how Revolut rendered the section:
    A) Prefix symbol   : "€114.94 €116.93"    (EUR / USD / GBP / JPY / CHF)
    B) Suffix code     : "2,825.00 CZK 116.27 CZK"  (CZK / PLN / other codes)

Direction (income vs expense) is derived from BALANCE TRACKING:
    delta = parsed_balance - running_balance
    delta ~= +amount  -> income
    delta ~= -amount  -> expense
If the running balance is unknown (no opening balance found) the parser falls
back to description keywords.

Fee handling:
    When a transaction is immediately followed by a "Fee: X Y" line, `Y` can
    mean two different things:
      - Y == main + X : main is NET credit (income exchange) -> emit gross
        income (main + fee) + a separate fee expense.
      - Y == main - X : main is TOTAL debit (withdrawal fee already bundled)
        -> emit main as-is, skip the fee line.
    This keeps per-currency sums aligned with Revolut's balance summary.

Date format: "%b %d, %Y"  (e.g. "Sep 2, 2025")
Amount format: English — "1,234.56" (comma thousands, dot decimal, 2 decimals)
"""

import re
import logging
from features.statements.parsers.base import BaseParser

logger = logging.getLogger(__name__)


# -- Symbol <-> ISO code mapping (prefix-format sections) ---------------------

_SYMBOL_TO_CODE = {
    "€": "EUR",
    "$": "USD",
    "£": "GBP",
    "¥": "JPY",
}

# Currency codes Revolut may emit as a standalone "{CODE} Statement" header.
# Keep this loose — we just need to recognise any 3-letter code.
_SECTION_HEADER_RE = re.compile(r"^([A-Z]{3})\s+Statement\s*$")

# Opening balance lives on a line like:
#   "Account (Current Account) €1.99 €1,670.42 €1,669.50 €1.07"
#   "Account (Current Account) $0.00 $2,400.65 $2,400.65 $0.00"
#   "Account (Current Account) 241.27 CZK 125,227.17 CZK 125,024.09 CZK 38.19 CZK"
# We only care about the FIRST money value (opening balance).
_OPENING_PREFIX_RE = re.compile(
    r"Account\s*\(Current\s*Account\)\s+([€$£¥])([\d,.]+)"
)
_OPENING_SUFFIX_RE = re.compile(
    r"Account\s*\(Current\s*Account\)\s+([\d,.]+)\s+([A-Z]{3})"
)

# Transaction-line patterns.  Amount & balance always carry two decimal places.
# Description is non-greedy so the regex anchors on the amount pattern at end.
_DATE_PREFIX = r"^([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})\s+"
_NUM = r"\d{1,3}(?:,\d{3})*\.\d{2}"

_TX_SUFFIX_RE = re.compile(
    _DATE_PREFIX
    + r"(.+?)\s+"                 # description
    + rf"({_NUM})\s+([A-Z]{{3}})"  # amount + currency code
    + rf"\s+({_NUM})\s+[A-Z]{{3}}"  # balance + currency code
    + r"\s*$"
)

_TX_PREFIX_RE = re.compile(
    _DATE_PREFIX
    + r"(.+?)\s+"                 # description
    + rf"([€$£¥])({_NUM})"         # symbol + amount
    + rf"\s+[€$£¥]({_NUM})"        # symbol + balance
    + r"\s*$"
)

# Fee continuation lines.  Appear as a subline directly under the main row.
_FEE_SUFFIX_RE = re.compile(
    rf"^Fee:\s+({_NUM})\s+[A-Z]{{3}}\s+({_NUM})\s+[A-Z]{{3}}\s*$"
)
_FEE_PREFIX_RE = re.compile(
    rf"^Fee:\s+[€$£¥]({_NUM})\s+[€$£¥]({_NUM})\s*$"
)


class RevolutParser(BaseParser):
    BANK_NAME = "revolut"

    # Keywords used only as a last-resort fallback when balance tracking fails.
    _INCOME_KEYWORDS = (
        "top-up",
        "apple pay top-up",
        "payment from",
        "transfer from",
        "refund",
        "from investment account",
        "cashback",
    )

    # -- Section / balance helpers -------------------------------------------

    @staticmethod
    def _detect_section_header(lines: list[str]) -> str | None:
        """Return the 3-letter currency code if this page starts a new section."""
        # The "{CURRENCY} Statement" header is one of the first non-empty lines.
        for raw in lines[:6]:
            m = _SECTION_HEADER_RE.match(raw.strip())
            if m:
                return m.group(1)
        return None

    @staticmethod
    def _extract_opening_balance(
        lines: list[str], section_currency: str | None
    ) -> float | None:
        """Return the section's opening balance, or None if no balance block."""
        for raw in lines:
            m = _OPENING_PREFIX_RE.search(raw)
            if m:
                return BaseParser.clean_amount(m.group(2))
            m = _OPENING_SUFFIX_RE.search(raw)
            if m:
                return BaseParser.clean_amount(m.group(1))
        return None

    # -- Fee line analysis ----------------------------------------------------

    @staticmethod
    def _parse_fee_line(line: str) -> tuple[float, float] | None:
        """Return (fee_amount, fee_second_number) if `line` is a fee line."""
        m = _FEE_SUFFIX_RE.match(line.strip())
        if m:
            return (
                BaseParser.clean_amount(m.group(1)),
                BaseParser.clean_amount(m.group(2)),
            )
        m = _FEE_PREFIX_RE.match(line.strip())
        if m:
            return (
                BaseParser.clean_amount(m.group(1)),
                BaseParser.clean_amount(m.group(2)),
            )
        return None

    # -- Direction resolution -------------------------------------------------

    def _resolve_direction(
        self,
        amount: float,
        balance: float,
        prev_balance: float | None,
        description: str,
    ) -> str:
        """Return "income" or "expense" for this transaction."""
        if prev_balance is not None:
            delta = round(balance - prev_balance, 2)
            if abs(delta - amount) < 0.02:
                return "income"
            if abs(delta + amount) < 0.02:
                return "expense"
            # Balance tracking lost sync — fall through to keywords.

        desc_lower = description.lower()
        if any(kw in desc_lower for kw in self._INCOME_KEYWORDS):
            return "income"
        return "expense"

    # -- Line-level transaction parsing --------------------------------------

    def _parse_tx_line(
        self, line: str, section_currency: str | None
    ) -> tuple[str, str, float, float, str] | None:
        """Try to parse a single transaction row.

        Returns (date_str, description, amount, balance, currency) or None.
        """
        stripped = line.strip()

        m = _TX_SUFFIX_RE.match(stripped)
        if m:
            date_str, desc, amt_str, currency, bal_str = m.groups()
            return (
                date_str,
                desc.strip(),
                self.clean_amount(amt_str),
                self.clean_amount(bal_str),
                currency,
            )

        m = _TX_PREFIX_RE.match(stripped)
        if m:
            date_str, desc, symbol, amt_str, bal_str = m.groups()
            currency = _SYMBOL_TO_CODE.get(symbol) or (section_currency or "EUR")
            return (
                date_str,
                desc.strip(),
                self.clean_amount(amt_str),
                self.clean_amount(bal_str),
                currency,
            )

        return None

    # -- Public entry point ---------------------------------------------------

    def parse(self, pdf_path: str) -> list[dict]:
        from features.statements.parsers.document_reader import open_document

        transactions: list[dict] = []
        section_currency: str | None = None
        prev_balance: float | None = None
        total_lines = 0

        with open_document(pdf_path) as doc:
            for page in doc.pages:
                text = page.extract_text()
                if not text:
                    continue

                lines = text.split("\n")
                total_lines += len(lines)

                # 1. Section header — starts a new currency block.
                new_section = self._detect_section_header(lines)
                if new_section:
                    section_currency = new_section

                # 2. Opening balance — present only on the first page of a
                #    section.  Reset running balance when we find one.
                opening = self._extract_opening_balance(lines, section_currency)
                if opening is not None:
                    prev_balance = opening

                # 3. Walk the lines, parsing transactions and fee continuations.
                i = 0
                while i < len(lines):
                    tx = self._parse_tx_line(lines[i], section_currency)
                    if tx is None:
                        i += 1
                        continue

                    date_str, desc, amount, balance, currency = tx
                    currency = currency or section_currency or "EUR"

                    direction = self._resolve_direction(
                        amount, balance, prev_balance, desc
                    )

                    # Peek at the next non-empty line for a Fee: continuation.
                    fee_info = None
                    j = i + 1
                    while j < len(lines) and not lines[j].strip():
                        j += 1
                    if j < len(lines):
                        fee_info = self._parse_fee_line(lines[j])

                    emit_amount = amount
                    extra_fee_tx: dict | None = None

                    if fee_info is not None:
                        fee_amount, fee_second = fee_info

                        # Income-side fee: main is NET, gross = main + fee.
                        if (
                            direction == "income"
                            and abs(fee_second - (amount + fee_amount)) < 0.02
                        ):
                            emit_amount = round(amount + fee_amount, 2)
                            extra_fee_tx = {
                                "date": self.parse_date(date_str, "%b %d, %Y"),
                                "description": self.clean_description(
                                    f"Fee: {desc}"
                                ),
                                "original_description": f"Fee: {desc}",
                                "amount": fee_amount,
                                "type": "expense",
                                "currency": currency,
                            }
                        # Expense-side fee: fee already bundled into main.
                        # (fee_second ~ main - fee)  -> nothing to do.

                    transactions.append({
                        "date": self.parse_date(date_str, "%b %d, %Y"),
                        "description": self.clean_description(desc),
                        "original_description": desc,
                        "amount": emit_amount,
                        "type": direction,
                        "currency": currency,
                    })

                    if extra_fee_tx is not None:
                        transactions.append(extra_fee_tx)

                    # Balance line already reflects both main + fee (if any),
                    # so the running balance simply advances to `balance`.
                    prev_balance = balance
                    i += 1

        if not transactions and total_lines > 0:
            logger.warning(
                f"Revolut: {total_lines} lines scanned but 0 transactions matched"
            )

        return transactions
