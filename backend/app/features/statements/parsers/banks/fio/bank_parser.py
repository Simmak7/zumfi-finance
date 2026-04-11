"""FIO Banka statement parser (Czech + Slovak branches).

Handles regular bank-account statements from Fio banka, a.s. and its Slovak
branch "Fio banka, a.s., pobočka zahraničnej banky". Both versions use the
same visual layout; only the header/footer text is translated.

PDF layout:
    Page 1 header:
        "Číslo účtu: ..."
        "IBAN ..."  /  "BIC ..."
        "Mena účtu {CCY}"      (CZ: "Měna účtu")
        "Výpis za obdobie {from}-{to}"
        "Starý zostatok {opening}"
        "Suma príjmov {total_in}"
        "Suma výdavkov -{total_out}"
        "Nový zostatok {closing}"
    Transaction section:
        "Výpis operácií"
        "Dátum zaúčtovania Operácie ..."  (column headers)
        {block_1}
        {block_2}
        ...

Each transaction is a multi-line BLOCK:
    Line 1   : "{DATE} {OP_TYPE} [{COUNTERPARTY_ACCT}] {AMOUNT}"
    Line 2+  : "{DATE} {merchant_detail}"                    (optional)
               "{merchant_detail_wrap}"                      (optional)
               "{OP_ID} VS: {symbols}"
               "{counterparty_or_reference}"                 (optional)
               "dne {orig_date}, částka {orig_amount} {CCY}"  (FX tail, optional)

The block's line 1 ALWAYS ends with the amount, in Slovak/Czech format:
    "-11,67"        (negative = expense)
    "840,00"        (no sign = income)
    "1 380,00"      (thousands separated by a single space)

Continuation lines NEVER end with an amount-at-end-of-line, so the parser
uses an anchored regex to detect block starters, which eliminates false
positives on FX tails like "dne 1.3.2026, částka 11.67 EUR" (ends in "EUR",
not in an amount).

Direction is resolved from the amount sign on line 1 — this is unambiguous
for Fio statements and requires no balance tracking or keyword fallback.

Currency is taken from the "Mena/Měna účtu" header line, not per row, because
FIO accounts are single-currency (foreign-currency purchases are converted to
the account currency on every transaction).

Description is built via a priority cascade over block lines:
    1. "Nákup: {merchant}"         — card purchase merchant
    2. "Vklad do bankomatu: {loc}" — cash-in at ATM
    3. "Bezhotovostn[ýí] vklad {sender}" — incoming deposit sender
    4. First non-junk continuation line (catches SEPA counterparty names)
    5. Fallback: the operation type from line 1
"""

import re
import logging
from features.statements.parsers.base import BaseParser

logger = logging.getLogger(__name__)


# -- Header/balance extraction --------------------------------------------

# "Mena účtu EUR"  (SK)  or  "Měna účtu CZK"  (CZ)
_ACCOUNT_CURRENCY_RE = re.compile(r"M[eě]na\s+(?:účtu|uctu)\s+([A-Z]{3})")

# "Starý zostatok 353,74"  /  "Počáteční zůstatek 12 345,67"
_OPENING_BALANCE_RE = re.compile(
    r"(?:Starý\s+zostatok|Počáteční\s+zůstatek)\s+(-?[\d\s]+,\d{2})"
)

# Foreign-currency tail on card / ATM blocks, always in English number format:
#   "... dne 6.3.2026, částka 50.00 PLN"
#   "... dne 24.3.2026, částka 599.00 CZK"
#   "...  dne 10.3.2026, částka 840.00 EUR"
# The tail may be wrapped across 2-3 lines, so we search the joined
# continuation text rather than individual lines.
_FX_TAIL_RE = re.compile(
    r"částka\s+(\d+(?:[,.\s]\d+)*)\s+([A-Z]{3})",
    re.IGNORECASE,
)

# -- Savings / term-deposit header fields ---------------------------------

# "Číslo účtu: 2403328376 B."
_ACCOUNT_NUMBER_RE = re.compile(r"Číslo\s+účtu:\s*(\d+)")

# "Typ účtu TVO - termínovaný vklad s obnovou"
# "Typ účtu BU - běžný účet"           (regular current account)
# "Typ účtu SPO - spořicí účet"        (hypothetical regular savings)
_ACCOUNT_TYPE_LINE_RE = re.compile(
    r"Typ\s+účtu\s+([A-Z]{2,4})\s*-\s*(.+)"
)

# "Starý zostatok 10 032,72"  /  "Počáteční zůstatek 12 345,67"
_OPENING_SAVINGS_RE = re.compile(
    r"(?:Starý\s+zostatok|Počáteční\s+zůstatek)\s+(-?[\d\s]+,\d{2})"
)

# "Nový zostatok 10 070,86"  /  "Konečný zůstatek 12 345,67"
_CLOSING_SAVINGS_RE = re.compile(
    r"(?:Nový\s+zostatok|Konečný\s+zůstatek)\s+(-?[\d\s]+,\d{2})"
)

# "Výpis za obdobie 1.1.2026-31.3.2026"  /  "Výpis za období 01.01.2025-31.01.2025"
_PERIOD_RE = re.compile(
    r"Výpis\s+za\s+obdob(?:ie|í)\s+"
    r"(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})"
    r"\s*[-–]\s*"
    r"(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})"
)

# FIO account-type prefix codes on "Typ účtu {CODE} - ..." lines.
# TV / TVO / TVB  = some flavour of Termínovaný vklad (term deposit)
# BU              = Bežný / Běžný účet (regular current account, NOT savings)
_TERM_DEPOSIT_CODES = frozenset({"TV", "TVO", "TVB"})
_CURRENT_ACCOUNT_CODES = frozenset({"BU"})

# -- Block-starter regex --------------------------------------------------

# Amount at end of line: optional sign, 1-3 digits, space-grouped thousands,
# decimal comma with 2 decimals. Slovak/Czech convention.
_AMOUNT_AT_END = r"-?\d{1,3}(?:\s\d{3})*,\d{2}"

_BLOCK_START_RE = re.compile(
    r"^(\d{1,2}\.\d{1,2}\.\d{4})\s+"   # posting date
    r"(.+?)\s+"                         # op text (operation type, counterparty acct)
    rf"({_AMOUNT_AT_END})\s*$"          # amount at end of line
)

# Continuation-line junk filter (content that never belongs in a description).
_JUNK_LINE_RES = (
    # "27514078527 VS: 7070" or "27549326022 VS: 24032026, REF: ?/..."
    re.compile(r"^\d{8,}(?:\s+(?:VS|KS|SS|REF|SYM):.*)?$"),
    # bare operation ID
    re.compile(r"^\d{8,}\s*$"),
    # bare date
    re.compile(r"^\d{1,2}\.\d{1,2}\.\d{4}\s*$"),
    # "dne 1.3.2026, částka 11.67 EUR"  (FX tail)
    re.compile(r"^dne\s+\d{1,2}\.\d{1,2}\.\d{4}"),
    # "částka 50.00 PLN"
    re.compile(r"^částka\s+", re.IGNORECASE),
)

# -- Header/footer noise to drop regardless of parser state ---------------

_SKIP_LINE_EXACT = frozenset({
    "Výpis operácií",
    "Výpis operací",
    "Výpis z účtu",
    "Správa pre príjemcu",
    "Správa pro příjemce",
    "Užívateľský symbol",
    "Uživatelský symbol",
    "Slovensko",
    "Česká republika",
})

_SKIP_LINE_PREFIX = (
    "Číslo účtu",
    "Vložka číslo",
    "Vložka č.",
    "Dátum zaúčtovania",
    "Datum zaúčtování",
    "Dátum transakcie",
    "Datum transakce",
    "ID operácie",
    "ID operace",
    "IBAN",
    "BIC",
    "Typ účtu",
    "Dátum zriadenia",
    "Datum založení",
    "Mena účtu",
    "Měna účtu",
    "Dátum výpisu",
    "Datum výpisu",
    "Výpis za obdobie",
    "Výpis za období",
    "Starý zostatok",
    "Počáteční zůstatek",
    "Nový zostatok",
    "Konečný zůstatek",
    "Suma príjmov",
    "Suma výdavkov",
    "Součet příjmů",
    "Součet výdajů",
    "Majiteľ účtu",
    "Majitel účtu",
    "Vklad na tomto úč",
    "k dispozícii na webových",
    "k dispozici na webových",
    "Fio banka",
    "====",
)

# "1 z 2"  page-number line (both SK and CZ)
_PAGE_NUMBER_RE = re.compile(r"^\d+\s*z\s*\d+\s*$")


class FioParser(BaseParser):
    BANK_NAME = "fio"

    # -- Entry point ------------------------------------------------------

    def parse(self, pdf_path: str) -> list[dict]:
        from features.statements.parsers.document_reader import open_document

        transactions: list[dict] = []

        with open_document(pdf_path) as doc:
            page_texts = []
            for page in doc.pages:
                text = page.extract_text()
                if text:
                    page_texts.append(text)

            full_text = "\n".join(page_texts)
            if not full_text:
                logger.warning(f"FIO: no text extracted from {pdf_path}")
                return []

            currency = self._detect_currency(full_text)
            blocks = self._split_into_blocks(full_text.split("\n"))

            for block in blocks:
                tx = self._parse_block(block, currency)
                if tx:
                    transactions.append(tx)

        if not transactions:
            logger.warning(f"FIO: 0 transactions extracted from {pdf_path}")

        return transactions

    # -- Header extraction ------------------------------------------------

    @staticmethod
    def _detect_currency(text: str) -> str:
        m = _ACCOUNT_CURRENCY_RE.search(text)
        if m:
            return m.group(1)
        return "CZK"

    # -- Block splitting --------------------------------------------------

    def _split_into_blocks(self, lines: list[str]) -> list[dict]:
        """Walk the line stream and return a list of transaction blocks.

        A block starts when a line matches `_BLOCK_START_RE`. All subsequent
        lines (minus header/footer noise) are appended as continuations
        until the next starter line is seen.
        """
        blocks: list[dict] = []
        current: dict | None = None

        for raw in lines:
            line = raw.strip()
            if not line:
                continue
            if self._is_noise(line):
                continue

            m = _BLOCK_START_RE.match(line)
            if m:
                if current is not None:
                    blocks.append(current)
                current = {
                    "date_str": m.group(1),
                    "op_text": m.group(2).strip(),
                    "amount_str": m.group(3),
                    "continuations": [],
                }
            elif current is not None:
                current["continuations"].append(line)

        if current is not None:
            blocks.append(current)

        return blocks

    @staticmethod
    def _is_noise(line: str) -> bool:
        if line in _SKIP_LINE_EXACT:
            return True
        if any(line.startswith(p) for p in _SKIP_LINE_PREFIX):
            return True
        if _PAGE_NUMBER_RE.match(line):
            return True
        return False

    # -- Block → transaction dict -----------------------------------------

    def _parse_block(self, block: dict, currency: str) -> dict | None:
        amount_str = block["amount_str"]
        amount = self.clean_amount(amount_str)
        if amount == 0.0:
            return None

        is_expense = "-" in amount_str
        desc, original = self._build_description(block)

        tx: dict = {
            "date": self.parse_date(block["date_str"], "%d.%m.%Y"),
            "description": self.clean_description(desc),
            "original_description": original,
            "amount": amount,
            "type": "expense" if is_expense else "income",
            "currency": currency,
        }

        # Foreign-currency original amount — only when the original currency
        # differs from the account currency (same-currency tails like
        # "částka 840.00 EUR" on an EUR account are informational only).
        fx = self._extract_fx_tail(block["continuations"])
        if fx is not None:
            orig_amount, orig_currency = fx
            if orig_currency != currency and orig_amount > 0:
                tx["original_amount"] = orig_amount
                tx["original_currency"] = orig_currency

        return tx

    @staticmethod
    def _extract_fx_tail(lines: list[str]) -> tuple[float, str] | None:
        """Return (original_amount, original_currency) from 'částka X CCY'."""
        if not lines:
            return None
        joined = " ".join(lines)
        m = _FX_TAIL_RE.search(joined)
        if not m:
            return None
        try:
            return BaseParser.clean_amount(m.group(1)), m.group(2).upper()
        except (ValueError, AttributeError):
            return None

    # -- Savings / term-deposit metadata ----------------------------------

    def extract_savings_info(self, pdf_path: str) -> dict | None:
        """Extract metadata from a FIO savings / term-deposit statement.

        Called by the upload pipeline when `statement_type == "savings"` and
        the statement is detected as FIO. Returns `None` if no meaningful
        savings data can be extracted (e.g. not actually a savings PDF).

        The returned dict is ready to be passed to `link_savings_account()`
        and contains:
            - currency        : account currency ("EUR", "CZK", …)
            - opening_balance : float or None
            - closing_balance : float or None
            - period_start    : date or None
            - period_end      : date or None
            - account_number  : full account number (e.g. "2403328376")
            - product_code    : FIO product code ("TVO", "BU", "SPO", …)
            - product_name    : full product name ("termínovaný vklad s obnovou")
            - account_type    : "term_deposit" | "savings" | "current"
            - suggested_name  : human-readable SavingsAccount name
            - notes           : product description for the notes field
        """
        from features.statements.parsers.document_reader import open_document

        with open_document(pdf_path) as doc:
            page_texts = [
                p.extract_text() or "" for p in doc.pages
            ]
        full_text = "\n".join(page_texts)
        if not full_text.strip():
            return None

        info: dict = {
            "currency": self._detect_currency(full_text),
            "opening_balance": None,
            "closing_balance": None,
            "period_start": None,
            "period_end": None,
            "account_number": None,
            "product_code": None,
            "product_name": None,
            "account_type": "savings",
            "suggested_name": None,
            "notes": None,
        }

        # Closing balance
        m = _CLOSING_SAVINGS_RE.search(full_text)
        if m:
            info["closing_balance"] = self.clean_amount(m.group(1))

        # Opening balance
        m = _OPENING_SAVINGS_RE.search(full_text)
        if m:
            info["opening_balance"] = self.clean_amount(m.group(1))

        # Statement period
        m = _PERIOD_RE.search(full_text)
        if m:
            from datetime import date as _date
            try:
                d1, m1, y1, d2, m2, y2 = (int(g) for g in m.groups())
                info["period_start"] = _date(y1, m1, d1)
                info["period_end"] = _date(y2, m2, d2)
            except ValueError:
                pass

        # Account number
        m = _ACCOUNT_NUMBER_RE.search(full_text)
        if m:
            info["account_number"] = m.group(1)

        # Product code + human-readable product name
        m = _ACCOUNT_TYPE_LINE_RE.search(full_text)
        if m:
            info["product_code"] = m.group(1).strip()
            info["product_name"] = m.group(2).strip()

            if info["product_code"] in _TERM_DEPOSIT_CODES:
                info["account_type"] = "term_deposit"
            elif info["product_code"] in _CURRENT_ACCOUNT_CODES:
                info["account_type"] = "current"
            # else: leave as "savings" (default)

        # Build a human-readable suggested name for the SavingsAccount.
        # Including the last 4 digits of the account number keeps multiple
        # FIO products distinguishable in the portfolio UI.
        bank_label = "Fio"
        acct_suffix = ""
        if info["account_number"]:
            acct_suffix = f" (...{info['account_number'][-4:]})"

        if info["account_type"] == "term_deposit":
            info["suggested_name"] = f"{bank_label} Term Deposit{acct_suffix}"
        elif info["account_type"] == "current":
            # Caller should never invoke this on a current account, but be
            # defensive: produce a sensible name anyway.
            info["suggested_name"] = f"{bank_label} Current{acct_suffix}"
        else:
            info["suggested_name"] = f"{bank_label} Savings{acct_suffix}"

        # Notes: store the raw product description and account number for
        # the UI "details" display.
        note_parts = []
        if info["account_number"]:
            note_parts.append(f"Account {info['account_number']}")
        if info["product_name"]:
            note_parts.append(info["product_name"])
        info["notes"] = " · ".join(note_parts) or None

        # Require at least a closing balance to be useful.
        if info["closing_balance"] is None:
            return None

        return info

    # -- Description extraction -------------------------------------------

    @staticmethod
    def _is_junk_continuation(line: str) -> bool:
        return any(r.match(line) for r in _JUNK_LINE_RES)

    def _build_description(self, block: dict) -> tuple[str, str]:
        """Return (short_description, original_description)."""
        op_text = block["op_text"]
        # op_text for SEPA blocks contains a trailing IBAN; strip it for the
        # short form but keep it in original.
        op_text_clean = re.sub(
            r"\s+[A-Z]{2}\d{2}[A-Z0-9]{10,}(?:/[A-Z0-9]+)?\s*$",
            "",
            op_text,
        ).strip()

        meaningful: list[str] = []
        for cont in block["continuations"]:
            if self._is_junk_continuation(cont):
                continue
            meaningful.append(cont)

        original_parts = [op_text] + meaningful
        original = " | ".join(original_parts)

        # Rule 1: card purchase — "Nákup: {merchant}, ..."
        for line in meaningful:
            m = re.search(r"Nákup:\s*([^,]+)", line)
            if m:
                return m.group(1).strip(), original

        # Rule 2: ATM cash deposit — "Vklad do bankomatu: {location}, ..."
        for line in meaningful:
            m = re.search(r"Vklad\s+do\s+bankomatu:\s*([^,]+)", line)
            if m:
                return f"Vklad do bankomatu: {m.group(1).strip()}", original

        # Rule 3: electronic deposit — "Bezhotovostn[ýí] vklad {SENDER}"
        for line in meaningful:
            m = re.search(r"Bezhotovostn[ýí]\s+vklad\s+(.+)$", line)
            if m:
                return m.group(1).strip(), original

        # Rule 4: first non-junk continuation that isn't a date-prefixed
        # duplicate of line 1 (e.g. the raw "10.3.2026" bare date line that
        # Slovak outgoing SEPA blocks include).
        for line in meaningful:
            if not re.match(r"^\d{1,2}\.\d{1,2}\.\d{4}\s*$", line):
                return line, original

        # Rule 5: fallback to operation type from line 1.
        return op_text_clean or op_text, original
