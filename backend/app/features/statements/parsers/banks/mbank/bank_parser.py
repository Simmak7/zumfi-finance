"""mBank S.A. statement parser — CZK (Czech branch) + EUR (Slovak branch).

Handles bank accounts (MKONTO), savings (MSPOŘENÍ / cílové spoření),
and EUR accounts from the Slovak mBank branch. Bank code 6210.

Format detection:
  CZK (Czech): "Výpis z účtu" header, dd.mm.yyyy dates, 5-6 col table
  EUR (Slovak): "Zoznam operácií" header, yyyy-mm-dd dates, 5 col table
  The parser auto-detects the format and routes internally.

CZK table layout (varies across pages!):
  6-col: [posting_date, tx_date, description, None, amount, balance]
  5-col: [posting_date, tx_date, description, amount, balance]

EUR table layout (consistent):
  5-col: [Dátum operácie, Opis operácie, Účet, Kategória, Suma]
  Amount includes currency suffix: -3,40EUR / 1365,85EUR

Amount format: Czech/Slovak (comma decimal, minus for debit)
Classification: sign-based only — mBank PDFs always have correct signs.
"""

import re
import logging
from calendar import monthrange
from datetime import date, datetime
from decimal import Decimal
from features.statements.parsers.base import BaseParser

logger = logging.getLogger(__name__)

# ── Description fixes ──
# mBank PDFs concatenate words without spaces. Ordered from longest to shortest
# to prevent partial matches.
_DESC_FIXES = {
    # Multi-word (long → short to prevent partial matches)
    "PŘEDDEF.ODCHOZÍOKAMŽITÁPLATBA": "Předdef. odchozí okamžitá platba",
    "ODCHOZÍPLATBADOJINÉBANKY": "Odchozí platba do jiné banky",
    "STORNOPŘIPSÁNÍVEPROSPĚCH": "Storno připsání ve prospěch",
    "OPRAVADANĚZPŘIPSÁNÍÚROKU": "Oprava daně z připsání úroku",
    "PŘÍCHOZÍOKAMŽITÁPLATBA": "Příchozí okamžitá platba",
    "ODCHOZÍOKAMŽITÁPLATBA": "Odchozí okamžitá platba",
    "OPRAVAKLADNÝCHÚROKŮ": "Oprava kladných úroků",
    "BEZHOTOVOSTNÍPLATBA": "Bezhotovostní platba",
    "DAŇZPŘIPSÁNÍÚROKU": "Daň z připsání úroku",
    "DAŇZPŘIPSANÍÚROKU": "Daň z připsání úroku",
    "PŘÍCHOZÍPLATBAZMBANK": "Příchozí platba z mBank",
    "PŘEVODNAMSPOŘENÍ": "Převod na mSpoření",
    "PŘIPSÁNÍÚROKŮ": "Připsání úroků",
    "PŘÍCHOZÍÚHRADA": "Příchozí úhrada",
    "ODCHOZÍÚHRADA": "Odchozí úhrada",
    "PŘÍCHOZÍPLATBA": "Příchozí platba",
    "VÝBĚRZBANKOMATU": "Výběr z bankomatu",
    "PLATBAQRKÓDEM": "Platba QR kódem",
    "PŘEVODZCÍLE": "Převod z cíle",
    "PŘEVODNACÍL": "Převod na cíl",
    "ODCHOZÍPLATBA": "Odchozí platba",
    "INKASNÍPLATBA": "Inkasní platba",
    "PLATBAKARTOU": "Platba kartou",
    "TRVALÝPŘÍKAZ": "Trvalý příkaz",
    "ZRUŠENÍCÍLE": "Zrušení cíle",
    "VKLADNACÍL": "Vklad na cíl",
}

# Slovak description fixes (EUR statements concatenate words like Czech ones)
_DESC_FIXES_SK = {
    "ODCH.OKAMŽITÁPLATBA": "Odch. okamžitá platba",
    "PRIJATÁPLATBAMEDZIBANKOVÁ": "Prijatá platba medzibanková",
    "VÝBERZINÉHOBANKOMATUVSR": "Výber z iného bankomatu v SR",
    "PLATBAKARTOU": "Platba kartou",
    "INKASO": "Inkaso",
}

# EUR amount pattern: -3,40EUR or 1365,85EUR
_EUR_AMOUNT_RE = re.compile(r"(-?\d[\d\s]*,\d{2})\s*([A-Z]{3})?$")

# Regex for the "DATUMPROVEDENÍTRANSAKCE:YYYY-MM-DD" suffix that mBank appends
_EXEC_DATE_RE = re.compile(
    r"\s*DATUM\s*PROVEDENÍ\s*TRANSAKCE\s*:\s*\d{4}-\d{2}-\d{2}\s*",
    re.IGNORECASE,
)

# Regex to detect a date in dd.mm.yyyy format
_DATE_RE = re.compile(r"^\d{2}\.\d{2}\.\d{4}$")

# Amount pattern: digits with optional space thousands + comma/dot + 2 decimals
_AMOUNT_RE = re.compile(r"^-?\d[\d\s]*[,.]\d{2}$")

# Summary table keywords (to identify and skip header/summary rows)
_SKIP_PATTERNS = [
    "Datum", "zaúčtování", "uskutečnění", "Popis", "Částka",
    "Účetní", "zůstatek", "transakce", "Počáteční",
]

# Counter-party account pattern: 000000-XXXXXXXXXX/XXXX or XXXXXX/XXXX
_ACCOUNT_RE = re.compile(r"\d{6,}-?\d{6,}/\d{4}")


class MBankParser(BaseParser):
    BANK_NAME = "mbank"

    def parse(self, pdf_path: str) -> list[dict]:
        """Parse transactions from an mBank PDF (CZK or EUR format)."""
        from features.statements.parsers.document_reader import open_document

        all_tables = []
        all_text = []

        with open_document(pdf_path) as doc:
            for page in doc.pages:
                text = page.extract_text()
                if text:
                    all_text.append(text)
                tables = page.extract_tables()
                if tables:
                    all_tables.extend(tables)

        full_text = "\n".join(all_text)

        # Detect EUR/Slovak format vs CZK/Czech format
        is_eur = self._is_eur_format(full_text)
        if is_eur:
            return self._parse_eur(all_tables, full_text, pdf_path)

        # CZK format (original logic)
        currency = "CZK"
        cur_m = re.search(r"Měna\s*účtu\s*(\w{3})", full_text)
        if cur_m:
            currency = cur_m.group(1).upper()

        acct_type = self._detect_account_type(full_text)
        logger.info(f"mBank: Account type={acct_type}")

        expected = self._extract_summary(full_text)
        txs = self._parse_tables(all_tables, currency)

        if not txs:
            txs = self._parse_text(full_text, currency)

        self._verify(txs, expected, pdf_path)
        return txs

    @staticmethod
    def _is_eur_format(text: str) -> bool:
        """Detect Slovak/EUR format vs Czech/CZK format."""
        indicators = ["Zoznam", "operácií", "Opisoperácie", "mBank.sk"]
        return any(kw in text for kw in indicators)

    def _parse_eur(
        self, tables: list, full_text: str, pdf_path: str,
    ) -> list[dict]:
        """Parse EUR/Slovak mBank statement tables."""
        # Extract currency from summary (default EUR)
        currency = "EUR"
        cur_m = re.search(r"Mena\s+Príjmy", full_text)
        if cur_m:
            line_start = full_text.find("\n", cur_m.end())
            next_line = full_text[cur_m.end():line_start].strip() if line_start > 0 else ""
            # Summary line: "EUR 1424,79 -1131,55"
            sm = re.search(r"([A-Z]{3})\s+", full_text[cur_m.start():cur_m.start() + 80])
            if not sm:
                # Try the next line after "Mena Príjmy Výdavky"
                idx = full_text.find("\n", cur_m.end())
                if idx > 0:
                    next_l = full_text[idx:idx + 40].strip()
                    sm2 = re.match(r"([A-Z]{3})", next_l)
                    if sm2:
                        currency = sm2.group(1)

        # Extract summary for verification
        exp_income = 0.0
        exp_expense = 0.0
        sum_m = re.search(
            r"([A-Z]{3})\s+(\d[\d\s]*,\d{2})\s+(-\d[\d\s]*,\d{2})",
            full_text,
        )
        if sum_m:
            currency = sum_m.group(1)
            exp_income = self.clean_amount(sum_m.group(2))
            exp_expense = self.clean_amount(sum_m.group(3))

        # Parse transaction tables
        txs: list[dict] = []
        for table in tables:
            if not table or len(table) < 2:
                continue
            # Check if this is a transaction table (has date-like first column)
            header = table[0]
            h0 = str(header[0] or "") if header else ""
            if "Dátum" not in h0 and "Mena" not in h0:
                continue
            # Skip summary table (Mena/Príjmy/Výdavky)
            if "Mena" in h0 and len(header) == 3:
                continue

            for row in table[1:]:
                tx = self._parse_eur_row(row, currency)
                if tx:
                    txs.append(tx)

        # Verify totals
        if txs:
            act_in = round(sum(t["amount"] for t in txs if t["type"] == "income"), 2)
            act_out = round(sum(t["amount"] for t in txs if t["type"] == "expense"), 2)
            ok = True
            if exp_income and abs(act_in - exp_income) > 0.02:
                logger.warning(f"mBank EUR: INCOME MISMATCH — {act_in:.2f} vs {exp_income:.2f}")
                ok = False
            if exp_expense and abs(act_out - exp_expense) > 0.02:
                logger.warning(f"mBank EUR: EXPENSE MISMATCH — {act_out:.2f} vs {exp_expense:.2f}")
                ok = False
            if ok:
                logger.info(f"mBank EUR: {len(txs)} transactions, totals verified")
        else:
            logger.warning(f"mBank EUR: 0 transactions from {pdf_path}")

        return txs

    def _parse_eur_row(self, row: list, currency: str) -> dict | None:
        """Parse a single EUR-format table row.

        Columns: [Dátum operácie, Opis operácie, Účet, Kategória, Suma]
        Suma format: -3,40EUR or 1365,85EUR
        Date format: yyyy-mm-dd
        """
        if not row or len(row) < 5:
            return None

        # Date (column 0): yyyy-mm-dd, may have \n with sub-text
        date_str = str(row[0] or "").strip().split("\n")[0]
        try:
            tx_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            return None

        # Description (column 1): multi-line, \n separated
        raw_desc = str(row[1] or "").strip()
        if not raw_desc:
            return None

        # Amount (column 4): "-3,40EUR" or "1365,85EUR"
        raw_sum = str(row[4] or "").strip()
        m = _EUR_AMOUNT_RE.match(raw_sum)
        if not m:
            return None

        raw_amount = m.group(1)
        detected_cur = m.group(2) or currency
        is_negative = raw_amount.strip().startswith("-")
        amount = self.clean_amount(raw_amount)

        # Clean description
        desc = self._clean_eur_description(raw_desc)

        return {
            "date": tx_date,
            "description": self.clean_description(desc),
            "original_description": raw_desc.replace("\n", " "),
            "amount": amount,
            "type": "expense" if is_negative else "income",
            "currency": detected_cur,
        }

    @staticmethod
    def _clean_eur_description(raw: str) -> str:
        """Clean Slovak/EUR mBank description: split concatenated words."""
        desc = raw.replace("\n", " ").strip()
        upper = desc.upper()
        for concat, fixed in _DESC_FIXES_SK.items():
            if concat in upper:
                idx = upper.find(concat)
                desc = desc[:idx] + fixed + desc[idx + len(concat):]
                upper = desc.upper()
        # Remove IBAN-like sequences (SK...)
        desc = re.sub(r"SK\d{2}\.{3}\d{4}", "", desc)
        desc = re.sub(r"SK\d{22,}", "", desc)
        desc = re.sub(r"\s+", " ", desc).strip()
        desc = re.sub(r"^[\s:,]+|[\s:,]+$", "", desc)
        return desc

    @staticmethod
    def _detect_account_type(text: str) -> str:
        """Detect account type from header: MKONTO, MSPOŘENÍ, etc."""
        m = re.search(r"Typ\s*účtu\s+(\S+)", text, re.IGNORECASE)
        if m:
            return m.group(1).upper()
        text_upper = text.upper()
        if "MSPOŘENÍ" in text_upper:
            return "MSPOŘENÍ"
        return "MKONTO"

    def extract_monthly_balances(self, pdf_path: str) -> dict[str, Decimal]:
        """Extract month-end savings balances from an mBank savings PDF.

        Reads the running balance column from each transaction row and returns
        the last balance seen for each calendar month. This enables historical
        portfolio snapshots from multi-month savings statements.

        Returns:
            Dict mapping "YYYY-MM" → Decimal balance at month end.
            Example: {"2025-10": Decimal("8038.28"), "2025-11": Decimal("568.00")}
        """
        from features.statements.parsers.document_reader import open_document

        all_tables = []
        with open_document(pdf_path) as doc:
            for page in doc.pages:
                tables = page.extract_tables()
                if tables:
                    all_tables.extend(tables)

        # Collect (posting_date, running_balance) pairs from all table rows
        entries: list[tuple[date, Decimal]] = []

        for table in all_tables:
            for row in table:
                if not row or len(row) < 5:
                    continue

                # Skip header/summary rows
                cell0 = str(row[0] or "").strip()
                first_cell = cell0.split("\n")[0]
                if not _DATE_RE.match(first_cell):
                    continue

                # Parse posting date (column 0) — use this for month grouping
                try:
                    posting_date = datetime.strptime(first_cell, "%d.%m.%Y").date()
                except ValueError:
                    continue

                # Extract running balance from last column
                if len(row) >= 6 and row[3] is None:
                    bal_str = str(row[5] or "").strip()
                else:
                    bal_str = str(row[4] or "").strip()

                if not bal_str:
                    continue

                try:
                    bal = Decimal(str(self.clean_amount(bal_str)))
                    entries.append((posting_date, bal))
                except (ValueError, ArithmeticError):
                    continue

        if not entries:
            return {}

        # Group by month, keep last balance per month
        monthly: dict[str, Decimal] = {}
        for dt, bal in entries:
            month_key = f"{dt.year}-{dt.month:02d}"
            # Always overwrite — entries are in chronological order,
            # so the last entry for each month is the month-end balance
            monthly[month_key] = bal

        logger.info(
            f"mBank: Extracted monthly balances for {len(monthly)} months: "
            + ", ".join(f"{k}={v}" for k, v in sorted(monthly.items()))
        )
        return monthly

    def _parse_tables(self, tables: list, currency: str) -> list[dict]:
        """Parse transactions from extracted PDF tables."""
        results = []

        for table in tables:
            for row in table:
                if not row or len(row) < 5:
                    continue

                # Skip header/summary/balance rows
                cell0 = str(row[0] or "").strip()
                first_cell = cell0.split("\n")[0]
                if not _DATE_RE.match(first_cell):
                    continue

                tx = self._parse_table_row(row, currency)
                if tx:
                    results.append(tx)

        return results

    def _parse_table_row(self, row: list, currency: str) -> dict | None:
        """Parse a single table row into a transaction dict.

        Handles both 5-column and 6-column layouts:
          6-col: [date, date, desc, None, amount, balance]
          5-col: [date, date, desc, amount, balance]
        """
        try:
            date_str = str(row[1] or row[0] or "").strip().split("\n")[0]
            tx_date = datetime.strptime(date_str, "%d.%m.%Y").date()
        except (ValueError, IndexError):
            return None

        # Description is always column 2
        raw_desc = str(row[2] or "").strip()

        # Determine column layout: 6-col has None at index 3
        if len(row) >= 6 and row[3] is None:
            raw_amount = str(row[4] or "").strip()
        else:
            raw_amount = str(row[3] or "").strip()

        if not raw_amount or not _AMOUNT_RE.match(raw_amount):
            return None

        amount = self.clean_amount(raw_amount)
        if amount == 0.0 and raw_amount not in ("0,00", "0.00"):
            return None

        # Clean and build description
        desc = self._clean_description(raw_desc)
        if not desc:
            return None

        # Sign-based classification — mBank PDFs always have correct signs
        is_negative = raw_amount.lstrip().startswith("-")

        return {
            "date": tx_date,
            "description": self.clean_description(desc),
            "original_description": raw_desc.replace("\n", " "),
            "amount": amount,
            "type": "expense" if is_negative else "income",
            "currency": currency,
        }

    def _parse_text(self, text: str, currency: str) -> list[dict]:
        """Fallback: parse transactions from raw text when table extraction fails."""
        results = []
        lines = text.split("\n")

        i = 0
        while i < len(lines):
            line = lines[i].strip()

            # Look for lines starting with two dates
            m = re.match(r"(\d{2}\.\d{2}\.\d{4})\s+(\d{2}\.\d{2}\.\d{4})\s+(.*)", line)
            if not m:
                i += 1
                continue

            date_str = m.group(2)  # transaction date
            rest = m.group(3).strip()

            try:
                tx_date = datetime.strptime(date_str, "%d.%m.%Y").date()
            except ValueError:
                i += 1
                continue

            # Extract amount + balance at end of line
            amount_m = re.search(
                r"(-?\d{1,3}(?:\s?\d{3})*[,.]\d{2})\s+\d{1,3}(?:\s?\d{3})*[,.]\d{2}\s*$",
                rest,
            )
            if amount_m:
                raw_amount = amount_m.group(1)
                desc_part = rest[:amount_m.start()].strip()
            else:
                i += 1
                continue

            # Collect continuation lines (non-date, non-header lines)
            desc = desc_part
            while i + 1 < len(lines):
                next_line = lines[i + 1].strip()
                if not next_line or re.match(r"\d{2}\.\d{2}\.\d{4}", next_line):
                    break
                if any(skip in next_line for skip in _SKIP_PATTERNS):
                    break
                if "Strana:" in next_line or "Konečný" in next_line:
                    break
                desc = f"{desc} {next_line}"
                i += 1

            desc = self._clean_description(desc)
            amount = self.clean_amount(raw_amount)
            is_negative = raw_amount.startswith("-")

            if desc and amount >= 0:
                results.append({
                    "date": tx_date,
                    "description": self.clean_description(desc),
                    "original_description": desc,
                    "amount": amount,
                    "type": "expense" if is_negative else "income",
                    "currency": currency,
                })

            i += 1

        return results

    def _clean_description(self, raw: str) -> str:
        """Fix concatenated words in mBank descriptions and normalize.

        Processing order:
        1. Collapse newlines to spaces
        2. Remove execution date suffix (DATUMPROVEDENÍTRANSAKCE:YYYY-MM-DD)
        3. Apply known concatenated-word fixes (longest first)
        4. Remove counter-party account numbers
        5. Generic uppercase word-boundary insertion
        6. Normalize whitespace
        """
        desc = raw.replace("\n", " ").strip()

        # Remove execution date noise
        desc = _EXEC_DATE_RE.sub(" ", desc)

        # Apply known description fixes (case-insensitive lookup)
        upper = desc.upper()
        for concat, fixed in _DESC_FIXES.items():
            if concat in upper:
                idx = upper.find(concat)
                desc = desc[:idx] + fixed + desc[idx + len(concat):]
                upper = desc.upper()

        # Remove counter-party account numbers (keep human description)
        desc = _ACCOUNT_RE.sub("", desc)

        # Generic word-boundary insertion: space before uppercase sequences
        # preceded by a lowercase letter (catches remaining concatenations)
        desc = re.sub(
            r"([a-záčďéěíňóřšťúůýž])([A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]{2,})",
            r"\1 \2",
            desc,
        )

        # Clean up multiple spaces and trim
        desc = re.sub(r"\s+", " ", desc).strip()

        # Remove trailing/leading punctuation noise
        desc = re.sub(r"^[\s:,]+|[\s:,]+$", "", desc)

        return desc

    def _extract_summary(self, text: str) -> dict:
        """Extract credit/debit totals from the summary table.

        mBank concatenates: "Kreditnípoložky 22 103670,61 CZK"
        """
        result = {"credit_count": 0, "debit_count": 0,
                  "credit_total": 0.0, "debit_total": 0.0}

        cm = re.search(
            r"Kreditní\s*položky\s+(\d+)\s+(\d[\d\s]*[,.]\d{2})",
            text, re.IGNORECASE,
        )
        if cm:
            result["credit_count"] = int(cm.group(1))
            result["credit_total"] = self.clean_amount(cm.group(2))

        dm = re.search(
            r"Debetní\s*položky\s+(\d+)\s+(\d[\d\s]*[,.]\d{2})",
            text, re.IGNORECASE,
        )
        if dm:
            result["debit_count"] = int(dm.group(1))
            result["debit_total"] = self.clean_amount(dm.group(2))

        return result

    def _verify(self, txs: list[dict], expected: dict, pdf_path: str) -> None:
        """Verify parsed transaction counts and totals against summary."""
        if not txs:
            logger.warning(f"mBank: 0 transactions from {pdf_path}")
            return

        act_in = round(sum(t["amount"] for t in txs if t["type"] == "income"), 2)
        act_out = round(sum(t["amount"] for t in txs if t["type"] == "expense"), 2)
        act_in_n = sum(1 for t in txs if t["type"] == "income")
        act_out_n = sum(1 for t in txs if t["type"] == "expense")

        ok = True
        exp_in = expected["credit_total"]
        exp_out = expected["debit_total"]
        if exp_in and abs(act_in - exp_in) > 0.02:
            logger.warning(
                f"mBank: INCOME MISMATCH — parsed {act_in:.2f}, "
                f"expected {exp_in:.2f}"
            )
            ok = False
        if exp_out and abs(act_out - exp_out) > 0.02:
            logger.warning(
                f"mBank: EXPENSE MISMATCH — parsed {act_out:.2f}, "
                f"expected {exp_out:.2f}"
            )
            ok = False
        if expected["credit_count"] and act_in_n != expected["credit_count"]:
            logger.warning(
                f"mBank: INCOME COUNT — parsed {act_in_n}, "
                f"expected {expected['credit_count']}"
            )
            ok = False
        if expected["debit_count"] and act_out_n != expected["debit_count"]:
            logger.warning(
                f"mBank: EXPENSE COUNT — parsed {act_out_n}, "
                f"expected {expected['debit_count']}"
            )
            ok = False

        if ok:
            logger.info(f"mBank: {len(txs)} transactions, totals verified")
        else:
            logger.warning(
                f"mBank: {len(txs)} txs from {pdf_path} — "
                f"totals DO NOT match summary"
            )
