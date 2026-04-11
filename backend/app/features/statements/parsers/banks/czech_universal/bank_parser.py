"""Universal Czech / Slovak bank statement parser.

Handles PDF statements from any Czech or Slovak bank that wasn't matched by a
dedicated parser. Built from analysis of real Czech bank formats and
cross-pollinated with techniques harvested from every dedicated parser in
`banks/*`. Each technique that appears here is only added when it is
portable to an unknown bank — bank-specific heuristics stay in their own
folder.

Verified format knowledge:
  - CSOB: columns separated by ; — cislo uctu, datum zauctovani, castka,
    mena, zustatek, cislo protiuctu, kod banky, nazev protiuctu, KS, VS, SS,
    oznaceni operace, poznamka. PDF mirrors this layout as a table.
  - Air Bank: date DD/MM/YYYY, direction "Odchozi"/"Prichozi", type "Platba
    kartou", amount with comma decimal (-46,60), counterparty name at col 10.
  - Komercni banka: KB+ format (2025+), separate credit/debit columns,
    "Datum zauctovani", "Oznaceni operace" as description.
  - Moneta: ABO2 format, similar table layout with date, amount, desc.
  - UniCredit: Multiple format revisions, latest since mid-2019.

Common Czech / Slovak bank PDF patterns:
  - Dates: dd.mm.yyyy or dd.mm. (short, year from header)
  - Amounts: space thousands, comma decimal (1 234,56 / -1 234,56)
  - Currency: CZK / Kc / omitted (implied CZK); EUR for SK branches
  - Separate credit/debit columns (KB, CSOB) or signed single amount
  - Direction column: "Prichozi"/"Odchozi" or "Prijem"/"Vydaj"  (CZ)
                     "Prichadzajuca"/"Odchadzajuca" or "Prijem"/"Vydavok" (SK)
  - Operation type: "Platba kartou", "Trvaly prikaz", "Inkaso", etc.
  - Metadata rows: VS, KS, SS, IBAN, protiucet (to be skipped/extracted)
  - Balance columns: often present; enables balance-tracked direction resolution

Strategy:
  1. Table-based extraction with fuzzy Czech/Slovak column header matching
  2. Text-based line parsing with dd.mm.yyyy + amount patterns
  3. Multi-line block merging for continuation lines
  4. Balance-tracked direction resolution when a running balance is present
  5. Footer-marker early termination to keep legal disclaimers out of txs
  6. OCR text support via document_reader fallback
  7. Generic savings / term-deposit metadata extraction via
     `extract_savings_info()` for portfolio linking
"""

import re
import logging
from datetime import date
from features.statements.parsers.base import BaseParser
from core.currencies import ALL_CURRENCY_CODES

logger = logging.getLogger(__name__)

# ---------- Date patterns ----------

# dd.mm.yyyy — universal Czech date format
_DATE_FULL_RE = re.compile(r"(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})")

# dd.mm. — short date without year (some statements omit year in table rows)
_DATE_SHORT_RE = re.compile(r"^(\d{1,2})\.\s?(\d{1,2})\.\s*$")

# dd/mm/yyyy — Air Bank uses this format
_DATE_SLASH_RE = re.compile(r"(\d{1,2})/(\d{1,2})/(\d{4})")

# ---------- Amount patterns ----------

# Czech-formatted amount: optional minus, digits with space/nbsp groups,
# comma or dot + 2 decimals. Tight pattern to avoid matching VS numbers.
_AMOUNT_RE = re.compile(
    r"([-\u2212\u2013]?\s?\d{1,3}(?:[\s\u00a0.]?\d{3})*[,.]\d{2})"
)

# Foreign currency line: "INR 50,00" or "EUR 123.45" — currency + amount
# (not CZK, which is the statement's own currency)
_FOREIGN_CURRENCY_RE = re.compile(
    r"^([A-Z]{3})\s+([\d\s.,]+)$"
)

# ---------- Table header detection (fuzzy substring matching) ----------
# Headers are matched using substring containment, not exact match,
# because PDF extraction often produces "Datum\nzauctovani" or
# "Castka v CZK" which wouldn't match exact sets.

_DATE_HEADER_KEYWORDS = [
    "datum zauctovani", "datum zauctovani",
    "datum provedeni", "datum provedeni",
    "datum splatnosti",
    "datum uskutecneni", "datum uskutecneni",
    "datum valuty",
    "datum",  # must be last (shortest, most generic)
    "date", "valuta", "datum", "splatnost",
]

_AMOUNT_HEADER_KEYWORDS = [
    "castka v mene", "castka v mene",
    "castka", "castka",
    "objem", "suma", "amount",
    "pripsano", "pripsano",
    "odepsano", "odepsano",
]

_DESC_HEADER_KEYWORDS = [
    "oznaceni operace", "oznaceni operace",  # CSOB operation label
    "zprava pro prijemce", "zprava pro prijemce",
    "informace pro prijemce",
    "nazev protiuctu", "nazev protiuctu",
    "identifikace transakce",
    "doplnujici udaj", "doplnujici udaj",
    "popis transakce", "popis operace", "transakce",
    "popis", "description",
    "nazev", "nazev", "name",
    "zprava", "zprava",
    "prijemce", "prijemce",
    "poznamka", "poznamka",
    "text", "detail", "memo",
]

_TYPE_HEADER_KEYWORDS = [
    "typ transakce", "typ pohybu",
    "smer uhrady", "smer uhrady",  # Air Bank direction column
    "smer", "smer",
    "typ", "type", "direction",
]

_CURRENCY_HEADER_KEYWORDS = [
    "mena uctu", "mena uctu",
    "mena", "mena", "currency",
]

# Credit/debit split columns (KB, CSOB, some UniCredit formats)
_CREDIT_KEYWORDS = ["kredit", "pripsano", "pripsano", "prijmy", "prijem", "credit"]
_DEBIT_KEYWORDS = ["debet", "odepsano", "odepsano", "vydaje", "vydaj", "debit"]

# ---------- Direction / type value matching ----------

_DIRECTION_INCOME = [
    "prichozi", "prichozi", "prijem", "prijem",
    "prichadzajuca", "prichadzajúca", "príchodzia",  # Slovak
    "credit", "incoming", "vklad",
]
_DIRECTION_EXPENSE = [
    "odchozi", "odchozi", "vydaj", "vydaj",
    "odchadzajuca", "odchádzajúca", "výdavok", "vydavok",  # Slovak
    "debit", "outgoing", "vyber", "vyber",
]

# ---------- Income / expense keywords for description ----------

_INCOME_KEYWORDS = [
    "prijem", "prijem", "prichozi", "prichozi",
    "pripsano", "pripsano", "vklad", "urok", "urok",
    "prichozi platba", "prichozi uhrada",
    "prevod ve prospech", "prevod ve prospech",
    "bezhotovostni prijem", "bezhotovostni prijem",
    "incoming", "credit", "deposit",
]

_EXPENSE_KEYWORDS = [
    "vydaj", "vydaj", "odchozi", "odchozi",
    "odepsano", "odepsano", "vyber", "vyber",
    "platba kartou", "uhrada", "uhrada",
    "inkaso", "trvaly prikaz", "trvaly prikaz",
    "poplatek", "pojisteni", "pojisteni",
    "outgoing", "debit", "withdrawal",
]

# ---------- Lines to skip ----------

_SKIP_RE = re.compile(
    r"(?i)^("
    r"strana\s|page\s|str\.\s|"
    r"vypis\b|vypis\b|statement\b|account\s+summary|"
    r"datum.*castka|datum.*objem|date.*amount|"
    r"pocatecni|pocatecni|konecny|konecny|opening|closing|"
    r"zustatek|zustatek|balance|"
    r"celkem|total|"
    r"iban\b|bic\b|swift\b|"
    r"cislo\s+uctu|cislo\s+uctu|"
    r"nazev\s+uctu|nazev\s+uctu|"
    r"kod\s+banky|kod\s+banky|"
    r"prehled\b|prehled\b|"
    r"obdobi|obdobi|period|"
    r"\d{1,3}\s*$"
    r")"
)

_BANK_HEADER_PREFIXES = (
    "Vypis z", "Vypis c", "Vypis z", "Vypis c",
    "Poradove", "Poradove", "Strana ", "Page ",
    "IBAN:", "BIC:", "SWIFT:",
    "Prijmy celkem", "Vydaje celkem",
    "Prijmy celkem", "Vydaje celkem",
    "Pocatecni zustatek", "Konecny zustatek",
    "Pocatecni zustatek", "Konecny zustatek",
    "Stary zostatok", "Novy zostatok",         # Slovak
    "Suma prijmov", "Suma vydavkov",           # Slovak
    "Pohledavky", "Poplatky",
    "Klientske cislo", "Klientske cislo",
)

# ---------- Footer markers (source: csob/bank_parser.py) ------------------
# Phrases that indicate the transaction section has ended and we should
# stop treating subsequent lines as continuations. Kept generic so they
# match any Czech/Slovak bank's legal footer, not a specific one.
_FOOTER_MARKERS = (
    "prosim vas,", "prosim vás,", "prosím vás,",
    "pokud pri zuctovani", "pokud při zúčtování",
    "ceskoslovenska obchodni banka", "československá obchodní banka",
    "fio banka,", "komercni banka,", "komerční banka,",
    "raiffeisenbank a.s", "raiffeisenbank a. s",
    "unicredit bank czech", "air bank a.s", "air bank a. s",
    "ceska sporitelna, a.s", "česká spořitelna, a.s",
    "mbank s.a", "moneta money bank",
    "koniec zostavy", "konec sestavy",   # "end of statement" CZ/SK
    "registracni cislo", "registrační číslo",
    "oddil:", "oddiel:",  # OR/commercial register entry
)

# ---------- Balance summary regexes ---------------------------------------
# "Počáteční zůstatek 12 345,67"  (Czech)
# "Starý zostatok 10 032,72"      (Slovak, FIO SK)
_OPENING_BALANCE_RE = re.compile(
    r"(?:Pocatecni\s+zustatek|Počáteční\s+zůstatek|"
    r"Starý\s+zostatok|Stary\s+zostatok)"
    r"\s*:?\s*(-?[\d\s\u00a0]+[,.]\d{2})",
    re.IGNORECASE,
)
# "Konečný zůstatek 12 345,67"  /  "Nový zostatok 10 070,86"
_CLOSING_BALANCE_RE = re.compile(
    r"(?:Konecny\s+zustatek|Konečný\s+zůstatek|"
    r"Nový\s+zostatok|Novy\s+zostatok)"
    r"\s*:?\s*(-?[\d\s\u00a0]+[,.]\d{2})",
    re.IGNORECASE,
)
# "Výpis za obdobie 1.1.2026-31.3.2026" (SK)
# "Vypis za obdobi 01.01.2026 - 31.01.2026" (CZ)
_PERIOD_RANGE_RE = re.compile(
    r"(?:Vypis|Výpis)\s+za\s+obdob(?:ie|í|i)\s+"
    r"(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})"
    r"\s*[-–]\s*"
    r"(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})",
    re.IGNORECASE,
)
# "Měna účtu CZK"  /  "Mena účtu EUR"
_ACCOUNT_CURRENCY_RE = re.compile(
    r"M[eě]na\s+(?:účtu|uctu)\s+([A-Z]{3})"
)
# "Číslo účtu: 2403328376"
_ACCOUNT_NUMBER_RE = re.compile(
    r"(?:Číslo|Cislo)\s+(?:účtu|uctu)\s*:?\s*(\d{6,})"
)
# "Typ účtu TVO - termínovaný vklad s obnovou"  (FIO pattern)
# "Typ účtu BU - běžný účet"
# Many banks don't print this at all — harmless miss.
_ACCOUNT_TYPE_LINE_RE = re.compile(
    r"(?:Typ|Druh)\s+(?:účtu|uctu)\s+([A-Z]{2,5})\s*-\s*(.+?)(?:\n|$)"
)
# Generic inline FX tail used by Fio / Raiffeisen card blocks:
# "...dne 1.3.2026, částka 50.00 PLN"
_FX_TAIL_RE = re.compile(
    r"(?:čiastka|částka|castka|ciastka)\s+"
    r"(\d+(?:[,.\s]\d+)*)\s+([A-Z]{3})",
    re.IGNORECASE,
)

# Product-code classification shared across FIO and similar Czech/SK banks.
_TERM_DEPOSIT_CODES = frozenset({"TV", "TVO", "TVB", "TD"})
_CURRENT_ACCOUNT_CODES = frozenset({"BU", "BÚ"})
_SAVINGS_CODES = frozenset({"SPO", "SPA", "SU"})


class CzechUniversalParser(BaseParser):
    """Universal parser for Czech bank statements."""

    BANK_NAME = "czech_universal"

    def __init__(self, bank_name: str = "czech_universal"):
        self.BANK_NAME = bank_name

    def parse(self, pdf_path: str) -> list[dict]:
        from features.statements.parsers.document_reader import open_document

        transactions = []
        statement_year = None

        with open_document(pdf_path) as doc:
            # Detect year + opening balance from first pages. The opening
            # balance (when present) is fed into text-based parsing so the
            # running balance can disambiguate direction on ambiguous rows.
            full_text_head = ""
            for page in doc.pages[:3]:
                text = page.extract_text() or ""
                full_text_head += "\n" + text
                if not statement_year:
                    statement_year = self._detect_year(text)

            if not statement_year:
                statement_year = date.today().year

            opening_balance = self._extract_opening_balance(full_text_head)

            for page_num, page in enumerate(doc.pages, 1):
                page_txs = []

                # Try tables first (more structured, more reliable)
                tables = page.extract_tables()
                if tables:
                    page_txs = self._parse_tables(tables, statement_year)
                    logger.info(
                        f"{self.BANK_NAME} page {page_num}: "
                        f"table parsing found {len(page_txs)} transactions "
                        f"from {len(tables)} table(s)"
                    )

                # Also try text-based parsing — use if it finds more
                text = page.extract_text()
                if text:
                    text_txs = self._parse_text(
                        text, statement_year,
                        opening_balance=opening_balance if page_num == 1 else None,
                    )
                    logger.info(
                        f"{self.BANK_NAME} page {page_num}: "
                        f"text parsing found {len(text_txs)} transactions"
                    )
                    if len(text_txs) > len(page_txs):
                        logger.info(
                            f"{self.BANK_NAME} page {page_num}: "
                            f"using text results ({len(text_txs)}) "
                            f"over table results ({len(page_txs)})"
                        )
                        page_txs = text_txs

                transactions.extend(page_txs)

        if transactions:
            logger.info(
                f"{self.BANK_NAME}: extracted {len(transactions)} transactions"
            )
        else:
            logger.warning(
                f"{self.BANK_NAME}: 0 transactions from {pdf_path}"
            )

        return transactions

    # ================================================================== #
    #  TABLE-BASED PARSING                                                #
    # ================================================================== #

    def _parse_tables(self, tables: list, year: int) -> list[dict]:
        results = []
        for table in tables:
            if not table or len(table) < 2:
                continue

            cols = self._detect_columns(table)
            if cols["date"] is not None and (
                cols["amount"] is not None
                or cols["credit"] is not None
                or cols["debit"] is not None
            ):
                results.extend(
                    self._parse_table_with_headers(table, cols, year)
                )
            else:
                # No recognizable headers — try generic row parsing
                for row in table:
                    tx = self._try_parse_generic_row(row, year)
                    if tx:
                        results.append(tx)

        return results

    def _detect_columns(self, table: list) -> dict:
        """Scan first rows for Czech column headers using fuzzy matching."""
        cols = {
            "date": None, "amount": None, "desc": None,
            "type": None, "currency": None,
            "credit": None, "debit": None,
            "start_row": 0,
        }

        for i, row in enumerate(table[:6]):  # Check first 6 rows
            if not row:
                continue
            row_lower = [
                str(c).lower().strip().replace("\n", " ") if c else ""
                for c in row
            ]

            for j, cell in enumerate(row_lower):
                if not cell or len(cell) > 50:
                    continue

                # Date column
                if cols["date"] is None:
                    for kw in _DATE_HEADER_KEYWORDS:
                        if kw in cell:
                            cols["date"] = j
                            break

                # Amount column
                if cols["amount"] is None:
                    for kw in _AMOUNT_HEADER_KEYWORDS:
                        if kw in cell:
                            cols["amount"] = j
                            break

                # Description column
                if cols["desc"] is None:
                    for kw in _DESC_HEADER_KEYWORDS:
                        if kw in cell:
                            cols["desc"] = j
                            break

                # Type / direction column
                if cols["type"] is None:
                    for kw in _TYPE_HEADER_KEYWORDS:
                        if kw in cell:
                            cols["type"] = j
                            break

                # Currency column
                if cols["currency"] is None:
                    for kw in _CURRENCY_HEADER_KEYWORDS:
                        if kw in cell:
                            cols["currency"] = j
                            break

                # Separate credit/debit columns (KB, CSOB style)
                if cols["credit"] is None:
                    for kw in _CREDIT_KEYWORDS:
                        if kw in cell:
                            cols["credit"] = j
                            break

                if cols["debit"] is None:
                    for kw in _DEBIT_KEYWORDS:
                        if kw in cell:
                            cols["debit"] = j
                            break

            # Stop scanning once we have enough to parse
            if cols["date"] is not None and (
                cols["amount"] is not None
                or cols["credit"] is not None
            ):
                cols["start_row"] = i + 1
                break

        return cols

    def _parse_table_with_headers(
        self, table: list, cols: dict, year: int
    ) -> list[dict]:
        results = []

        for row in table[cols["start_row"]:]:
            if not row:
                continue

            # ---- Date ----
            date_cell = self._safe_cell(row, cols["date"])
            parsed_date = self._parse_date(date_cell, year)
            if not parsed_date:
                continue

            # ---- Skip balance rows ----
            desc_cell = self._safe_cell(row, cols.get("desc"))
            if not desc_cell:
                desc_cell = " ".join(
                    str(c) for c in row if c
                )
            if re.search(
                r"(?i)(konecny|konecny|pocatecni|pocatecni)\s+"
                r"(zustatek|zustatek)",
                desc_cell,
            ):
                continue

            # ---- Amount ----
            amount = 0.0
            is_negative = False

            if cols["credit"] is not None or cols["debit"] is not None:
                # Separate credit/debit columns (KB, CSOB, some UniCredit)
                credit_str = self._safe_cell(row, cols.get("credit"))
                debit_str = self._safe_cell(row, cols.get("debit"))

                if debit_str and re.search(r"\d", debit_str):
                    amount = self.clean_amount(debit_str)
                    is_negative = True
                elif credit_str and re.search(r"\d", credit_str):
                    amount = self.clean_amount(credit_str)
                    is_negative = False
                elif cols["amount"] is not None:
                    amount_str = self._safe_cell(row, cols["amount"])
                    amount = self.clean_amount(amount_str)
                    is_negative = bool(re.search(r"[-\u2212\u2013]", amount_str))
            else:
                amount_str = self._safe_cell(row, cols["amount"])
                if not amount_str or not re.search(r"\d", amount_str):
                    continue
                amount = self.clean_amount(amount_str)
                is_negative = bool(re.search(r"[-\u2212\u2013]", amount_str))

            if amount == 0.0:
                continue

            # ---- Description ----
            desc = self._safe_cell(row, cols["desc"])
            if not desc:
                desc = self._longest_text_cell(
                    row,
                    exclude={
                        cols["date"], cols["amount"],
                        cols.get("credit"), cols.get("debit"),
                        cols.get("currency"), cols.get("type"),
                    },
                )
            if not desc:
                desc = "Transaction"

            # ---- Currency ----
            currency = "CZK"
            if cols["currency"] is not None:
                c = self._safe_cell(row, cols["currency"]).upper()
                if re.match(r"^[A-Z]{3}$", c):
                    currency = c

            # ---- Type (income/expense) ----
            type_cell = self._safe_cell(row, cols.get("type"))
            tx_type = self._determine_type(is_negative, type_cell, desc)

            results.append({
                "date": parsed_date,
                "description": self.clean_description(desc),
                "original_description": desc,
                "amount": amount,
                "type": tx_type,
                "currency": currency,
            })

        return results

    def _try_parse_generic_row(self, row: list, year: int) -> dict | None:
        """Parse a table row without header context."""
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
                d = self._parse_date(cell_str, year)
                if d:
                    parsed_date = d
                    continue

            if amount_str is None and re.search(
                r"-?\d{1,3}(?:[\s\u00a0]?\d{3})*[,.]\d{2}$", cell_str
            ):
                amount_str = cell_str
                continue

            if (
                len(cell_str) > len(desc)
                and not re.match(r"^[\d\s,.\-/]+$", cell_str)
            ):
                desc = cell_str

        if not parsed_date or not amount_str:
            return None

        amount = self.clean_amount(amount_str)
        if amount == 0.0:
            return None

        return {
            "date": parsed_date,
            "description": (
                self.clean_description(desc) if desc else "Transaction"
            ),
            "original_description": desc or "Transaction",
            "amount": amount,
            "type": "expense" if re.search(r"[-\u2212\u2013]", amount_str) else "income",
            "currency": "CZK",
        }

    # ================================================================== #
    #  TEXT-BASED LINE PARSING                                            #
    # ================================================================== #

    def _parse_text(
        self,
        text: str,
        year: int,
        *,
        opening_balance: float | None = None,
    ) -> list[dict]:
        """Walk the page text and extract transactions.

        When `opening_balance` is provided and transaction rows contain a
        trailing running-balance amount, the parser uses balance tracking
        (delta vs amount) to resolve direction — much more reliable than
        description keywords on ambiguous rows.
        """
        results = []
        lines = text.split("\n")
        pending_tx = None
        prev_balance: float | None = opening_balance

        for line in lines:
            line = line.strip()
            if not line or len(line) < 8:
                continue
            if _SKIP_RE.match(line):
                continue
            if line.startswith(_BANK_HEADER_PREFIXES):
                continue
            # Early exit on footer markers — prevents the last transaction
            # from absorbing legal disclaimers / registration text.
            low = line.lower()
            if any(marker in low for marker in _FOOTER_MARKERS):
                break

            # Try to match a transaction line (date + desc + amount [+ balance])
            tx_pair = self._try_parse_text_line(
                line, year, prev_balance=prev_balance,
            )
            if tx_pair:
                tx, new_balance = tx_pair
                if pending_tx:
                    results.append(pending_tx)
                pending_tx = tx
                if new_balance is not None:
                    prev_balance = new_balance
                continue

            # Continuation line — append to previous transaction
            if pending_tx and not self._has_date_prefix(line):
                clean = line.strip()
                # Skip metadata lines (VS, KS, SS, account numbers)
                if re.match(
                    r"^(VS|KS|SS|C\.u|Cu|IBAN|Protiucet|Protiucet)"
                    r"[\s:]+",
                    clean, re.I,
                ):
                    continue
                # Skip pure number lines (account numbers, codes)
                if re.match(r"^[\d\s/\-]+$", clean):
                    continue

                # FX tail 1: bare "CCY 50,00" line
                fc_match = _FOREIGN_CURRENCY_RE.match(clean)
                if fc_match:
                    fc_code = fc_match.group(1)
                    if (
                        fc_code != "CZK"
                        and fc_code in ALL_CURRENCY_CODES
                        and not pending_tx.get("original_currency")
                    ):
                        fc_amount = self.clean_amount(fc_match.group(2))
                        if fc_amount > 0:
                            pending_tx["original_amount"] = fc_amount
                            pending_tx["original_currency"] = fc_code

                # FX tail 2: inline "částka 50.00 PLN" (Fio / Raiffeisen cards)
                if not pending_tx.get("original_currency"):
                    inline = _FX_TAIL_RE.search(clean)
                    if inline:
                        fx_code = inline.group(2).upper()
                        if fx_code != pending_tx.get("currency", "CZK"):
                            fx_amt = self.clean_amount(inline.group(1))
                            if fx_amt > 0:
                                pending_tx["original_amount"] = fx_amt
                                pending_tx["original_currency"] = fx_code

                # Append meaningful text
                if len(clean) >= 3:
                    pending_tx["original_description"] += " " + clean
                    pending_tx["description"] = self.clean_description(
                        pending_tx["original_description"]
                    )

        if pending_tx:
            results.append(pending_tx)

        return results

    def _try_parse_text_line(
        self,
        line: str,
        year: int,
        *,
        prev_balance: float | None = None,
    ) -> tuple[dict, float | None] | None:
        """Parse a text line as a transaction.

        Returns `(transaction, new_balance)` or `None`. `new_balance` is the
        running balance the line exposes after the amount (if any) and is
        used by the caller to maintain balance tracking across rows.
        """
        # Date must be at or near the beginning
        date_match = _DATE_FULL_RE.match(line)
        if not date_match:
            # Try slash format (Air Bank: dd/mm/yyyy)
            date_match = _DATE_SLASH_RE.match(line)
        if not date_match:
            return None

        parsed_date = self._parse_date(date_match.group(0), year)
        if not parsed_date:
            return None

        rest = line[date_match.end():].strip()
        if not rest:
            return None

        # May have a second date (valuta date) right after — skip it
        second_date = _DATE_FULL_RE.match(rest) or _DATE_SLASH_RE.match(rest)
        if second_date:
            rest = rest[second_date.end():].strip()

        # Skip balance lines that happen to start with a date
        if re.match(
            r"(?i)(konecny|konecny|pocatecni|pocatecni|"
            r"novy\s+zostatok|stary\s+zostatok)\s+"
            r"(zustatek|zustatek|zostatok)?",
            rest,
        ):
            return None

        # Find all amounts in the line. Two-amount rows are common:
        #   "DESC 123,45 50000,00"   (tx amount, running balance)
        # When the line has >=2 amounts, the LAST one is typically the
        # running balance and the SECOND-TO-LAST is the transaction amount.
        # Single-amount rows fall back to the single match.
        amounts = list(_AMOUNT_RE.finditer(rest))
        if not amounts:
            return None

        tx_amount_match = amounts[-1]
        new_balance: float | None = None
        if len(amounts) >= 2:
            # Heuristic: if the last amount parses sensibly and is
            # plausibly a running balance (> tx amount by a decent margin
            # OR simply the larger of the two), treat it as the balance.
            last_str = amounts[-1].group(1).strip()
            prev_str = amounts[-2].group(1).strip()
            last_val = self.clean_amount(last_str)
            prev_val = self.clean_amount(prev_str)
            # Running balance rarely has a minus sign inside transactions
            # (even on expense rows, the balance is typically positive).
            last_neg = bool(re.search(r"[-\u2212\u2013]", last_str))
            if (
                last_val > 0
                and prev_val > 0
                and not last_neg
                and last_val != prev_val
            ):
                tx_amount_match = amounts[-2]
                new_balance = last_val

        amount_str = tx_amount_match.group(1).strip()
        amount = self.clean_amount(amount_str)
        if amount == 0.0:
            return None

        # Description: text before the transaction amount
        desc = rest[:tx_amount_match.start()].strip()

        # Remove trailing currency codes
        desc = re.sub(
            r"\s*(CZK|Kc|EUR|USD|GBP|PLN|CHF)\s*$", "", desc, flags=re.I
        )
        desc = desc.strip(" |;-,")

        # Remove VS/KS/SS metadata from inline description
        desc = re.sub(r"\s*(VS|KS|SS)[\s:]*\d+", "", desc)

        # Strip trailing 1-4 digit counterparty ID (csob-style)
        desc = re.sub(r"\s+\d{1,4}$", "", desc).strip()

        # Remove leading direction markers (Air Bank: "Odchozi Platba kartou",
        # Slovak FIO: "Odchádzajúca SEPA okamžitá platba")
        direction_hint = ""
        dir_match = re.match(
            r"^(prichozi|prichozi|odchozi|odchozi|"
            r"prichadzajuca|odchadzajuca|príchodzia|odchádzajúca)"
            r"\s+",
            desc, re.I,
        )
        if dir_match:
            direction_hint = dir_match.group(1).lower()
            desc = desc[dir_match.end():]

        if not desc:
            # Check text after the transaction amount
            after = rest[tx_amount_match.end():].strip()
            after = re.sub(
                r"^\s*(CZK|Kc|EUR|USD|GBP)\s*", "", after, flags=re.I
            )
            desc = after.strip(" |;-,") or "Transaction"

        is_negative = bool(re.search(r"[-\u2212\u2013]", amount_str))
        currency = self._extract_currency(rest) or "CZK"

        # Direction resolution:
        #   1. balance tracking (most reliable when both balances known)
        #   2. sign of the parsed amount
        #   3. direction column / keywords (existing logic)
        tx_type: str | None = None
        if prev_balance is not None and new_balance is not None:
            delta = round(new_balance - prev_balance, 2)
            if abs(delta - amount) < 0.02:
                tx_type = "income"
            elif abs(delta + amount) < 0.02:
                tx_type = "expense"
        if tx_type is None:
            tx_type = self._determine_type(is_negative, direction_hint, desc)

        tx = {
            "date": parsed_date,
            "description": self.clean_description(desc),
            "original_description": desc,
            "amount": amount,
            "type": tx_type,
            "currency": currency,
        }
        return tx, new_balance

    # ================================================================== #
    #  HELPERS                                                            #
    # ================================================================== #

    @staticmethod
    def _has_date_prefix(line: str) -> bool:
        """Check if line starts with a date pattern."""
        return bool(
            _DATE_FULL_RE.match(line)
            or _DATE_SLASH_RE.match(line)
        )

    @staticmethod
    def _detect_year(text: str) -> int | None:
        """Detect statement year from document text."""
        # "Vypis za obdobi 01.01.2026 - 31.01.2026"
        m = re.search(
            r"(?:obdobi|za mesic|za mesic|period|month)\s*"
            r".*?(\d{4})",
            text[:800], re.I,
        )
        if m:
            y = int(m.group(1))
            if 2000 <= y <= 2100:
                return y

        # Date in header: dd.mm.yyyy
        m = re.search(r"\d{1,2}\.\s?\d{1,2}\.\s?(\d{4})", text[:500])
        if m:
            return int(m.group(1))

        # Standalone year
        m = re.search(r"(\d{4})", text[:500])
        if m:
            y = int(m.group(1))
            if 2000 <= y <= 2100:
                return y

        return None

    @staticmethod
    def _parse_date(text: str, default_year: int) -> date | None:
        """Parse Czech date from text. Supports dd.mm.yyyy, dd/mm/yyyy, dd.mm."""
        # dd.mm.yyyy
        m = _DATE_FULL_RE.search(text)
        if m:
            try:
                return date(
                    int(m.group(3)), int(m.group(2)), int(m.group(1))
                )
            except ValueError:
                return None

        # dd/mm/yyyy (Air Bank)
        m = _DATE_SLASH_RE.search(text)
        if m:
            try:
                return date(
                    int(m.group(3)), int(m.group(2)), int(m.group(1))
                )
            except ValueError:
                return None

        # dd.mm. (short, without year)
        m = _DATE_SHORT_RE.search(text)
        if m:
            try:
                return date(
                    default_year, int(m.group(2)), int(m.group(1))
                )
            except ValueError:
                return None

        return None

    @staticmethod
    def _determine_type(
        is_negative: bool, type_cell: str, desc: str
    ) -> str:
        """Determine income vs expense.

        Priority: sign > direction/type column > description keywords > default.
        """
        # 1. Negative sign is most reliable
        if is_negative:
            return "expense"

        # 2. Direction / type column (Air Bank "Odchozi", CSOB "Vydaj", etc.)
        if type_cell:
            t = type_cell.lower()
            if any(kw in t for kw in _DIRECTION_INCOME):
                return "income"
            if any(kw in t for kw in _DIRECTION_EXPENSE):
                return "expense"

        # 3. Description keywords
        desc_lower = desc.lower()
        if any(kw in desc_lower for kw in _INCOME_KEYWORDS):
            return "income"
        if any(kw in desc_lower for kw in _EXPENSE_KEYWORDS):
            return "expense"

        # 4. Default: positive amount without sign = income
        return "income"

    @staticmethod
    def _extract_currency(text: str) -> str | None:
        common = [
            "CZK", "EUR", "USD", "GBP", "PLN", "CHF",
            "HUF", "SEK", "NOK", "DKK",
        ]
        text_upper = text.upper()
        for code in common:
            if code in text_upper:
                return code
        if "Kc" in text or "KC" in text_upper:
            return "CZK"
        return None

    @staticmethod
    def _safe_cell(row: list, col_idx: int | None) -> str:
        if col_idx is None or col_idx >= len(row) or row[col_idx] is None:
            return ""
        return str(row[col_idx]).strip()

    @staticmethod
    def _longest_text_cell(row: list, exclude: set) -> str:
        best = ""
        for i, cell in enumerate(row):
            if i in exclude:
                continue
            cell_str = str(cell).strip() if cell else ""
            if (
                len(cell_str) > len(best)
                and not re.match(r"^[\d\s,.\-/]+$", cell_str)
            ):
                best = cell_str
        return best

    # ================================================================== #
    #  BALANCE / SAVINGS METADATA                                         #
    # ================================================================== #

    @classmethod
    def _extract_opening_balance(cls, text: str) -> float | None:
        """Extract opening balance from the header block of a statement."""
        m = _OPENING_BALANCE_RE.search(text)
        if m:
            return BaseParser.clean_amount(m.group(1))
        return None

    @classmethod
    def _extract_closing_balance(cls, text: str) -> float | None:
        m = _CLOSING_BALANCE_RE.search(text)
        if m:
            return BaseParser.clean_amount(m.group(1))
        return None

    @classmethod
    def _extract_period(cls, text: str) -> tuple[date | None, date | None]:
        m = _PERIOD_RANGE_RE.search(text)
        if not m:
            return None, None
        try:
            d1, m1, y1, d2, m2, y2 = (int(g) for g in m.groups())
            return date(y1, m1, d1), date(y2, m2, d2)
        except ValueError:
            return None, None

    def extract_savings_info(self, pdf_path: str) -> dict | None:
        """Generic savings / term-deposit metadata extraction.

        Called by the upload pipeline when `statement_type == "savings"` for
        any bank whose dedicated parser does not supply its own
        `extract_savings_info`. Recognises the common Czech / Slovak balance
        summary block and the "Typ účtu {CODE} - {name}" product-type line.

        Returns `None` if no meaningful savings data can be extracted
        (e.g. the PDF is actually a current-account statement).
        """
        from features.statements.parsers.document_reader import open_document

        with open_document(pdf_path) as doc:
            page_texts = [p.extract_text() or "" for p in doc.pages]
        full_text = "\n".join(page_texts)
        if not full_text.strip():
            return None

        closing = self._extract_closing_balance(full_text)
        if closing is None:
            return None

        info: dict = {
            "currency": "CZK",
            "opening_balance": self._extract_opening_balance(full_text),
            "closing_balance": closing,
            "period_start": None,
            "period_end": None,
            "account_number": None,
            "product_code": None,
            "product_name": None,
            "account_type": "savings",
            "suggested_name": None,
            "notes": None,
        }

        m = _ACCOUNT_CURRENCY_RE.search(full_text)
        if m:
            info["currency"] = m.group(1)

        info["period_start"], info["period_end"] = self._extract_period(full_text)

        m = _ACCOUNT_NUMBER_RE.search(full_text)
        if m:
            info["account_number"] = m.group(1)

        m = _ACCOUNT_TYPE_LINE_RE.search(full_text)
        if m:
            info["product_code"] = m.group(1).strip()
            info["product_name"] = m.group(2).strip()
            if info["product_code"] in _TERM_DEPOSIT_CODES:
                info["account_type"] = "term_deposit"
            elif info["product_code"] in _SAVINGS_CODES:
                info["account_type"] = "savings"
            elif info["product_code"] in _CURRENT_ACCOUNT_CODES:
                info["account_type"] = "current"

        bank_label = self.BANK_NAME.replace("_", " ").title()
        suffix = ""
        if info["account_number"]:
            suffix = f" (...{info['account_number'][-4:]})"
        if info["account_type"] == "term_deposit":
            info["suggested_name"] = f"{bank_label} Term Deposit{suffix}"
        elif info["account_type"] == "current":
            info["suggested_name"] = f"{bank_label} Current{suffix}"
        else:
            info["suggested_name"] = f"{bank_label} Savings{suffix}"

        note_parts = []
        if info["account_number"]:
            note_parts.append(f"Account {info['account_number']}")
        if info["product_name"]:
            note_parts.append(info["product_name"])
        info["notes"] = " · ".join(note_parts) or None

        return info
