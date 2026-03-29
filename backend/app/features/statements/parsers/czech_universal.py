"""Universal Czech bank statement parser.

Handles PDF statements from any Czech bank that wasn't matched by a
dedicated parser. Built from analysis of real Czech bank formats:

Verified format knowledge:
  - ČSOB: columns separated by ; — číslo účtu, datum zaúčtování, částka,
    měna, zůstatek, číslo protiúčtu, kód banky, název protiúčtu, KS, VS, SS,
    označení operace, poznámka. PDF mirrors this layout as a table.
  - Air Bank: date DD/MM/YYYY, direction "Odchozí"/"Příchozí", type "Platba
    kartou", amount with comma decimal (-46,60), counterparty name at col 10.
  - Komerční banka: KB+ format (2025+), separate credit/debit columns,
    "Datum zaúčtování", "Označení operace" as description.
  - Moneta: ABO2 format, similar table layout with date, amount, desc.
  - UniCredit: Multiple format revisions, latest since mid-2019.

Common Czech bank PDF patterns:
  - Dates: dd.mm.yyyy or dd.mm. (short, year from header)
  - Amounts: space thousands, comma decimal (1 234,56 / -1 234,56)
  - Currency: CZK / Kč / omitted (implied CZK)
  - Separate credit/debit columns (KB, ČSOB) or signed single amount
  - Direction column: "Příchozí"/"Odchozí" or "Příjem"/"Výdaj"
  - Operation type: "Platba kartou", "Trvalý příkaz", "Inkaso", etc.
  - Metadata rows: VS, KS, SS, IBAN, protiúčet (to be skipped/extracted)

Strategy:
  1. Table-based extraction with fuzzy Czech column header matching
  2. Text-based line parsing with dd.mm.yyyy + amount patterns
  3. Multi-line block merging for continuation lines
  4. OCR text support via document_reader fallback
"""

import re
import logging
from datetime import date
from .base import BaseParser
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
# because PDF extraction often produces "Datum\nzaúčtování" or
# "Částka v CZK" which wouldn't match exact sets.

_DATE_HEADER_KEYWORDS = [
    "datum zaúčtování", "datum zauctovani",
    "datum provedení", "datum provedeni",
    "datum splatnosti",
    "datum uskutečnění", "datum uskutecneni",
    "datum valuty",
    "datum",  # must be last (shortest, most generic)
    "date", "valuta", "dátum", "splatnost",
]

_AMOUNT_HEADER_KEYWORDS = [
    "částka v měně", "castka v mene",
    "částka", "castka",
    "objem", "suma", "amount",
    "připsáno", "pripsano",
    "odepsáno", "odepsano",
]

_DESC_HEADER_KEYWORDS = [
    "označení operace", "oznaceni operace",  # ČSOB operation label
    "zpráva pro příjemce", "zprava pro prijemce",
    "informace pro příjemce",
    "název protiúčtu", "nazev protiuctu",
    "identifikace transakce",
    "doplňující údaj", "doplnujici udaj",
    "popis transakce", "popis operace", "transakce",
    "popis", "description",
    "název", "nazev", "name",
    "zpráva", "zprava",
    "příjemce", "prijemce",
    "poznámka", "poznamka",
    "text", "detail", "memo",
]

_TYPE_HEADER_KEYWORDS = [
    "typ transakce", "typ pohybu",
    "směr úhrady", "smer uhrady",  # Air Bank direction column
    "směr", "smer",
    "typ", "type", "direction",
]

_CURRENCY_HEADER_KEYWORDS = [
    "měna účtu", "mena uctu",
    "měna", "mena", "currency",
]

# Credit/debit split columns (KB, ČSOB, some UniCredit formats)
_CREDIT_KEYWORDS = ["kredit", "připsáno", "pripsano", "příjmy", "příjem", "credit"]
_DEBIT_KEYWORDS = ["debet", "odepsáno", "odepsano", "výdaje", "výdaj", "debit"]

# ---------- Direction / type value matching ----------

_DIRECTION_INCOME = [
    "příchozí", "prichozi", "příjem", "prijem",
    "credit", "incoming", "vklad",
]
_DIRECTION_EXPENSE = [
    "odchozí", "odchozi", "výdaj", "vydaj",
    "debit", "outgoing", "výběr", "vyber",
]

# ---------- Income / expense keywords for description ----------

_INCOME_KEYWORDS = [
    "příjem", "prijem", "příchozí", "prichozi",
    "připsáno", "pripsano", "vklad", "úrok", "urok",
    "příchozí platba", "příchozí úhrada",
    "převod ve prospěch", "prevod ve prospech",
    "bezhotovostní příjem", "bezhotovostni prijem",
    "incoming", "credit", "deposit",
]

_EXPENSE_KEYWORDS = [
    "výdaj", "vydaj", "odchozí", "odchozi",
    "odepsáno", "odepsano", "výběr", "vyber",
    "platba kartou", "úhrada", "uhrada",
    "inkaso", "trvalý příkaz", "trvaly prikaz",
    "poplatek", "pojištění", "pojisteni",
    "outgoing", "debit", "withdrawal",
]

# ---------- Lines to skip ----------

_SKIP_RE = re.compile(
    r"(?i)^("
    r"strana\s|page\s|str\.\s|"
    r"výpis\b|vypis\b|statement\b|account\s+summary|"
    r"datum.*částka|datum.*objem|date.*amount|"
    r"počáteční|pocatecni|konečný|konecny|opening|closing|"
    r"zůstatek|zustatek|balance|"
    r"celkem|total|"
    r"iban\b|bic\b|swift\b|"
    r"číslo\s+účtu|cislo\s+uctu|"
    r"název\s+účtu|nazev\s+uctu|"
    r"kód\s+banky|kod\s+banky|"
    r"přehled\b|prehled\b|"
    r"období|obdobi|period|"
    r"\d{1,3}\s*$"
    r")"
)

_BANK_HEADER_PREFIXES = (
    "Výpis z", "Výpis č", "Vypis z", "Vypis c",
    "Pořadové", "Poradove", "Strana ", "Page ",
    "IBAN:", "BIC:", "SWIFT:",
    "Příjmy celkem", "Výdaje celkem",
    "Prijmy celkem", "Vydaje celkem",
    "Počáteční zůstatek", "Konečný zůstatek",
    "Pocatecni zustatek", "Konecny zustatek",
    "Pohledávky", "Poplatky",
    "Klientské číslo", "Klientske cislo",
)


class CzechUniversalParser(BaseParser):
    """Universal parser for Czech bank statements."""

    BANK_NAME = "czech_universal"

    def __init__(self, bank_name: str = "czech_universal"):
        self.BANK_NAME = bank_name

    def parse(self, pdf_path: str) -> list[dict]:
        from .document_reader import open_document

        transactions = []
        statement_year = None

        with open_document(pdf_path) as doc:
            # Detect year from first pages
            for page in doc.pages:
                text = page.extract_text()
                if text:
                    statement_year = self._detect_year(text)
                    if statement_year:
                        break

            if not statement_year:
                statement_year = date.today().year

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
                    text_txs = self._parse_text(text, statement_year)
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

                # Separate credit/debit columns (KB, ČSOB style)
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
                r"(?i)(konečný|konecny|počáteční|pocatecni)\s+"
                r"(zůstatek|zustatek)",
                desc_cell,
            ):
                continue

            # ---- Amount ----
            amount = 0.0
            is_negative = False

            if cols["credit"] is not None or cols["debit"] is not None:
                # Separate credit/debit columns (KB, ČSOB, some UniCredit)
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

    def _parse_text(self, text: str, year: int) -> list[dict]:
        results = []
        lines = text.split("\n")
        pending_tx = None

        for line in lines:
            line = line.strip()
            if not line or len(line) < 8:
                continue
            if _SKIP_RE.match(line):
                continue
            if line.startswith(_BANK_HEADER_PREFIXES):
                continue

            # Try to match a transaction line (date + desc + amount)
            tx = self._try_parse_text_line(line, year)
            if tx:
                if pending_tx:
                    results.append(pending_tx)
                pending_tx = tx
                continue

            # Continuation line — append to previous transaction
            if pending_tx and not self._has_date_prefix(line):
                clean = line.strip()
                # Skip metadata lines (VS, KS, SS, account numbers)
                if re.match(
                    r"^(VS|KS|SS|Č\.ú|Čú|IBAN|Protiúčet|Protiucet)"
                    r"[\s:]+",
                    clean, re.I,
                ):
                    continue
                # Skip pure number lines (account numbers, codes)
                if re.match(r"^[\d\s/\-]+$", clean):
                    continue
                # Detect foreign currency line (e.g. "INR 50,00")
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
                # Append meaningful text
                if len(clean) >= 3:
                    pending_tx["original_description"] += " " + clean
                    pending_tx["description"] = self.clean_description(
                        pending_tx["original_description"]
                    )

        if pending_tx:
            results.append(pending_tx)

        return results

    def _try_parse_text_line(self, line: str, year: int) -> dict | None:
        """Try to parse a text line as a transaction."""
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
            r"(?i)(konečný|konecny|počáteční|pocatecni)\s+"
            r"(zůstatek|zustatek)",
            rest,
        ):
            return None

        # Find amount(s) — take the last one (earlier may be VS/account nums)
        amounts = list(_AMOUNT_RE.finditer(rest))
        if not amounts:
            return None

        amount_match = amounts[-1]
        amount_str = amount_match.group(1).strip()
        amount = self.clean_amount(amount_str)
        if amount == 0.0:
            return None

        # Description: text before the last amount
        desc = rest[:amount_match.start()].strip()

        # Remove trailing currency codes
        desc = re.sub(
            r"\s*(CZK|Kč|EUR|USD|GBP|PLN|CHF)\s*$", "", desc, flags=re.I
        )
        desc = desc.strip(" |;-,")

        # Remove VS/KS/SS metadata from inline description
        desc = re.sub(r"\s*(VS|KS|SS)[\s:]*\d+", "", desc)

        # Remove leading direction markers (Air Bank: "Odchozí Platba kartou")
        direction_hint = ""
        dir_match = re.match(
            r"^(příchozí|prichozi|odchozí|odchozi)\s+",
            desc, re.I,
        )
        if dir_match:
            direction_hint = dir_match.group(1).lower()
            desc = desc[dir_match.end():]

        if not desc:
            # Check text after amount
            after = rest[amount_match.end():].strip()
            after = re.sub(
                r"^\s*(CZK|Kč|EUR|USD|GBP)\s*", "", after, flags=re.I
            )
            desc = after.strip(" |;-,") or "Transaction"

        is_negative = bool(re.search(r"[-\u2212\u2013]", amount_str))
        currency = self._extract_currency(rest) or "CZK"
        tx_type = self._determine_type(is_negative, direction_hint, desc)

        return {
            "date": parsed_date,
            "description": self.clean_description(desc),
            "original_description": desc,
            "amount": amount,
            "type": tx_type,
            "currency": currency,
        }

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
        # "Výpis za období 01.01.2026 - 31.01.2026"
        m = re.search(
            r"(?:období|za měsíc|za mesic|period|month)\s*"
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

        # 2. Direction / type column (Air Bank "Odchozí", ČSOB "Výdaj", etc.)
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
        if "Kč" in text or "KC" in text_upper:
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
