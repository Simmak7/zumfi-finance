"""Ceska sporitelna (George) bank statement parser — OCR block-based.

Image-based PDFs (no text layer) from CS bank code 0800.
Uses Tesseract OCR at 600 DPI. See parsers/CLAUDE.md for full details.
"""

import re
import logging
from datetime import date
from .base import BaseParser

logger = logging.getLogger(__name__)

_MONTH_MAP = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4,
    "may": 5, "jun": 6, "jul": 7, "aug": 8,
    "sep": 9, "oct": 10, "nov": 11, "dec": 12,
    "led": 1, "úno": 2, "uno": 2, "bře": 3, "bre": 3,
    "dub": 4, "kvě": 5, "kve": 5, "čvn": 6, "cvn": 6,
    "čvc": 7, "cvc": 7, "srp": 8, "zář": 9, "zar": 9,
    "říj": 10, "rij": 10, "lis": 11, "pro": 12,
}

# Date at start of line: "22. Feb" or "10.Feb" or "5, Feb" (OCR comma)
_DATE_RE = re.compile(r"^(\d{1,2})[.,]\s*([A-Za-zÚúŘřÍíŽžČč]{3})\b")

# CZK amount: optional sign chars, digits, decimals, CZK suffix
_CZK_AMOUNT_RE = re.compile(
    r"([—–\-=~©]?\s?)(\d{1,3}(?:[\s]?\d{3})*[,.]\d{2})\s*CZK"
)

# Foreign currency: -€5,99 or - € 24,99 or €> -18,80
_EUR_AMOUNT_RE = re.compile(
    r"[—–\-]?\s*[€$£¥]\s*(\d{1,3}(?:[\s]?\d{3})*[,.]\d{2})"
)

# Strict pig line: pig char + optional > + sign + digits (for clean pig lines)
# OCR renders the pig icon as various chars depending on DPI/quality:
#   300 DPI: ©, Č, č, °, €, etc.
#   600 DPI: €>, (>, £, Č, etc.
_PIG_LINE_RE = re.compile(r"^[©ČčÉéÈè°Ɔɔ€£(]\>?\s*[—–\-]?\s*\d")

# Broad pig start: line starts with a pig icon char (OCR renders as these)
# Used for classifying amounts within a block — any non-date line starting
# with a pig char has pig savings amounts, even if OCR garbled the rest.
_PIG_START_RE = re.compile(r"^(?:[©ČčÉéÈè°Ɔɔ€£]|[(]\>)")

# Pig indicator before a CZK amount (mid-line or on date line)
# Catches patterns like: "© -10,01 CZK", "(3 -15,00 CZK", "£ -10,01 CZK"
_PIG_BEFORE_AMOUNT = re.compile(
    r"[©ČčÉéÈè°£(]\s*[\d>]?\s*[—–\-]?\s*$"
)

_SUMMARY_RE = re.compile(
    r"^\d+\s+(incoming|outgoing)\s+transactions?:", re.IGNORECASE
)

_SKIP_PREFIXES = ("Account", "From a legal", "Fee ")

# Detect single-digit OCR icon prefix in amounts like "7 211,20 CZK".
# OCR reads category icons (shopping cart, etc.) as a digit before the
# real amount. If there's no sign character and the raw amount starts
# with a single digit + space + 3-digit group, strip the leading digit.
_ICON_DIGIT_RE = re.compile(r"^(\d)\s(\d{3}(?:[\s]?\d{3})*[,.]\d{2})$")

# Max length for orphan amount lines eligible for look-back.
# Continuation lines (pig, garbled OCR) are longer; pure orphan
# amounts like "- 149,55 CZK" or "LD - 185,00 CZK" are short.
_LOOKBACK_MAX_LEN = 30

INCOME_KEYWORDS = ["incoming transfer", "příchozí", "prichozi"]
EXPENSE_KEYWORDS = [
    "card payment", "domestic outgoing transfer", "withdrawal",
    "inkaso", "direct debit",
]

# Keywords that indicate a real transaction (not a header/fee/noise).
# Used to decide whether to keep a transaction when OCR garbled the amount.
_TX_KEYWORDS = [
    "card payment", "domestic outgoing transfer", "withdrawal",
    "incoming transfer", "platba", "payment", "transfer", "inkaso",
    "příchozí", "prichozi", "direct debit", "trvalý příkaz",
    "trvaly prikaz",
]

# Summary line amount extraction
_SUMMARY_AMOUNT_RE = re.compile(
    r"(?:incoming|outgoing)\s+transactions?:\s*[—–\-]?\s*"
    r"(\d{1,3}(?:[\s]?\d{3})*[,.]\d{2})\s*CZK",
    re.IGNORECASE,
)


class CeskaSporitelnaParser(BaseParser):
    BANK_NAME = "ceska_sporitelna"

    def parse(self, pdf_path: str) -> list[dict]:
        from .document_reader import open_document

        all_lines = []
        current_year = None

        with open_document(pdf_path) as doc:
            for page in doc.pages:
                text = page.extract_text()
                if not text:
                    continue
                if not current_year:
                    ym = re.search(
                        r"(?:january|february|march|april|may|june|"
                        r"july|august|september|october|november|"
                        r"december|leden|únor|březen|duben|květen|"
                        r"červen|červenec|srpen|září|říjen|listopad|"
                        r"prosinec)\s+(\d{4})",
                        text, re.IGNORECASE,
                    )
                    if ym:
                        current_year = int(ym.group(1))
                for line in text.split("\n"):
                    s = line.strip()
                    if s:
                        all_lines.append(s)

        if not current_year:
            current_year = date.today().year

        txs = self._parse_blocks(all_lines, current_year)
        self._recover_missing_amounts(txs, all_lines)
        self._verify_totals(txs, all_lines, pdf_path)
        return txs

    def _is_date_line(self, line: str) -> bool:
        return bool(
            _DATE_RE.match(line)
            and not _SUMMARY_RE.match(line)
            and not line.strip().lower().startswith("fee")
        )

    def _can_look_back(self, line: str) -> bool:
        """Check if a line is a short orphan amount eligible for look-back.

        Continuation lines (pig savings, garbled OCR) belong to the
        transaction ABOVE and must NOT be looked back.
        Short amount-only lines (like "- 149,55 CZK" or "= 626,50 CZK")
        may be claimed by the transaction below via look-back.
        Note: "= NNN CZK" lines are CZK equivalents of the foreign-currency
        transaction below, so they ARE eligible for look-back.
        """
        if self._is_date_line(line):
            return False
        if _SUMMARY_RE.match(line) or line.startswith(_SKIP_PREFIXES):
            return False
        if _PIG_START_RE.match(line):
            return False
        if len(line) > _LOOKBACK_MAX_LEN:
            return False
        if not (_CZK_AMOUNT_RE.search(line) or _EUR_AMOUNT_RE.search(line)):
            return False
        # Orphan amounts are mostly just the amount + sign chars.
        # Continuation lines have descriptive text (e.g. garbled card
        # payment descriptions). Strip amounts and sign chars — if
        # significant text remains, it's a continuation, not an orphan.
        stripped = _CZK_AMOUNT_RE.sub("", line)
        stripped = _EUR_AMOUNT_RE.sub("", stripped)
        stripped = re.sub(r"[—–\-=~©€£(>\s\d]+", "", stripped).strip()
        if len(stripped) > 5:
            return False
        return True

    def _parse_blocks(self, lines: list[str], year: int) -> list[dict]:
        date_indices = [
            i for i, ln in enumerate(lines) if self._is_date_line(ln)
        ]

        # Pass 1: compute look-back (pre) for each date block.
        # Max 1 line look-back, only on short orphan-amount lines.
        pre_values = []
        for start in date_indices:
            pre = start
            look = start - 1
            if look >= 0 and self._can_look_back(lines[look]):
                pre = look
            pre_values.append(pre)

        # Pass 2: build non-overlapping blocks.
        # Each block ends at min(next_date_index, next_block_pre)
        # so look-back regions don't overlap with previous blocks.
        results = []
        for b_idx, start in enumerate(date_indices):
            pre = pre_values[b_idx]
            if b_idx + 1 < len(date_indices):
                next_date = date_indices[b_idx + 1]
                next_pre = pre_values[b_idx + 1]
                end = min(next_date, next_pre)
            else:
                end = len(lines)

            block = lines[pre:end]
            date_off = start - pre
            txs = self._parse_block(block, year, date_off)
            results.extend(txs)

        return results

    def _recover_missing_amounts(
        self, txs: list[dict], lines: list[str]
    ) -> None:
        """Recover missing amounts from statement summary totals.

        When OCR garbles an amount, the transaction is emitted with
        amount=0. We extract the incoming/outgoing totals from the
        summary lines and compute the gap to fill in the missing amount.
        """
        zero_txs = [t for t in txs if t["amount"] == 0.0]
        if not zero_txs:
            return

        # Extract summary totals
        expected_in = 0.0
        expected_out = 0.0
        for line in lines:
            m = _SUMMARY_AMOUNT_RE.search(line)
            if m:
                val = self.clean_amount(m.group(1))
                if "incoming" in line.lower():
                    expected_in = val
                elif "outgoing" in line.lower():
                    expected_out = val

        if not expected_in and not expected_out:
            return

        # Sum parsed amounts by type (exclude zero-amount txs)
        actual_in = sum(
            t["amount"] for t in txs
            if t["type"] == "income" and t["amount"] > 0
        )
        actual_out = sum(
            t["amount"] for t in txs
            if t["type"] == "expense" and t["amount"] > 0
        )

        # Try to recover each zero-amount transaction
        for t in zero_txs:
            if t["type"] == "expense":
                gap = round(expected_out - actual_out, 2)
            else:
                gap = round(expected_in - actual_in, 2)

            if gap > 0:
                t["amount"] = gap
                logger.info(
                    f"Ceska sporitelna: recovered amount {gap} CZK "
                    f"for {t['date']} {t['description']} from summary"
                )
                # Update running total so multiple missing txs work
                if t["type"] == "expense":
                    actual_out += gap
                else:
                    actual_in += gap

    def _verify_totals(
        self, txs: list[dict], lines: list[str], pdf_path: str
    ) -> None:
        """Compare parsed totals against statement summary and log mismatches."""
        if not txs:
            logger.warning(f"Ceska sporitelna: 0 transactions from {pdf_path}")
            return

        expected_in = expected_out = 0.0
        count_re = re.compile(
            r"(\d+)\s+(incoming|outgoing)\s+transactions?:", re.IGNORECASE,
        )
        exp_counts = {"incoming": 0, "outgoing": 0}
        for line in lines:
            m = _SUMMARY_AMOUNT_RE.search(line)
            if m:
                val = self.clean_amount(m.group(1))
                if "incoming" in line.lower():
                    expected_in = val
                else:
                    expected_out = val
            cm = count_re.search(line)
            if cm:
                key = "incoming" if "incoming" in line.lower() else "outgoing"
                exp_counts[key] = int(cm.group(1))

        actual_in = round(sum(t["amount"] for t in txs if t["type"] == "income"), 2)
        actual_out = round(sum(t["amount"] for t in txs if t["type"] == "expense"), 2)
        act_in_n = sum(1 for t in txs if t["type"] == "income" and not t.get("is_savings_roundup"))
        act_out_n = sum(1 for t in txs if t["type"] == "expense" and not t.get("is_savings_roundup"))

        ok = True
        for label, exp, act in [("INCOME", expected_in, actual_in), ("EXPENSE", expected_out, actual_out)]:
            if exp and abs(act - exp) > 0.02:
                logger.warning(f"Ceska sporitelna: {label} MISMATCH — parsed {act:.2f}, expected {exp:.2f}")
                ok = False
        for label, exp, act in [("INCOME COUNT", exp_counts["incoming"], act_in_n),
                                ("EXPENSE COUNT", exp_counts["outgoing"], act_out_n)]:
            if exp and act != exp:
                logger.warning(f"Ceska sporitelna: {label} MISMATCH — parsed {act}, expected {exp}")
                ok = False

        if ok:
            logger.info(f"Ceska sporitelna: {len(txs)} transactions, totals verified")
        else:
            logger.warning(f"Ceska sporitelna: {len(txs)} txs from {pdf_path} — totals DO NOT match summary")

    def _parse_block(
        self, block: list[str], year: int, date_off: int
    ) -> list[dict]:
        if not block or date_off >= len(block):
            return []

        date_line = block[date_off]
        dm = _DATE_RE.match(date_line)
        if not dm:
            return []

        month = _MONTH_MAP.get(dm.group(2).lower()[:3])
        if not month:
            return []
        try:
            tx_date = date(year, month, int(dm.group(1)))
        except ValueError:
            return []

        # Extract description (remove amounts from date line)
        rest = date_line[dm.end():].strip()
        desc = _CZK_AMOUNT_RE.sub("", rest)
        desc = _EUR_AMOUNT_RE.sub("", desc)
        desc = self._clean_desc(desc)
        if not desc:
            return []

        # Collect all amounts from block
        czk_main = []
        czk_pig = []
        eur_amounts = []

        for i, line in enumerate(block):
            is_dl = (i == date_off)

            # Skip summary/header lines that may be in the last block
            if _SUMMARY_RE.match(line) or line.startswith(_SKIP_PREFIXES):
                continue

            # EUR amounts
            eur_m = _EUR_AMOUNT_RE.search(line)
            if eur_m:
                val = self.clean_amount(eur_m.group(1))
                if val > 0:
                    neg = bool(re.search(
                        r"[—–\-]", line[:eur_m.start() + 5]
                    ))
                    eur_amounts.append((val, neg))
                if not _CZK_AMOUNT_RE.search(line):
                    continue

            # CZK amounts
            for czk_m in _CZK_AMOUNT_RE.finditer(line):
                sign = czk_m.group(1)
                raw = czk_m.group(2)
                val = self._extract_czk(raw, sign)
                if val == 0.0:
                    continue
                neg = bool(sign and re.search(r"[—–\-=~©]", sign))

                # Classify pig vs main.
                # Pig detection: line starts with pig char, OR pig char
                # appears just before the amount (handles continuation
                # lines where pig icon is mid-line).
                before_amount = line[:czk_m.start()]
                if not is_dl and _PIG_START_RE.match(line):
                    czk_pig.append((val, neg))
                elif _PIG_BEFORE_AMOUNT.search(before_amount):
                    czk_pig.append((val, neg))
                else:
                    czk_main.append((val, neg))

        # Pick main amount (largest CZK — pig round-ups are small)
        main_val = None
        main_neg = False

        if czk_main:
            czk_main.sort(key=lambda x: x[0], reverse=True)
            main_val, main_neg = czk_main[0]
        elif eur_amounts:
            main_val, main_neg = eur_amounts[0]

        if not main_val:
            # No parseable amount — OCR failure. Still emit if the
            # description looks like a real transaction so nothing is
            # silently dropped. Amount will be recovered from summary
            # totals in _recover_missing_amounts().
            dl_check = desc.lower()
            if not any(kw in dl_check for kw in _TX_KEYWORDS):
                return []
            logger.warning(
                f"Ceska sporitelna: OCR amount unreadable for "
                f"{tx_date} {desc} — will recover from summary"
            )
            main_val = 0.0

        # Determine type
        dl = desc.lower()
        if main_neg:
            tx_type = "expense"
        elif any(kw in dl for kw in EXPENSE_KEYWORDS):
            tx_type = "expense"
        elif any(kw in dl for kw in INCOME_KEYWORDS):
            tx_type = "income"
        else:
            tx_type = "income"

        tx = {
            "date": tx_date,
            "description": self.clean_description(desc),
            "original_description": desc,
            "amount": main_val,
            "type": tx_type,
            "currency": "CZK",
        }

        # Foreign currency info (like Raiffeisen)
        if eur_amounts and czk_main:
            tx["original_amount"] = eur_amounts[0][0]
            tx["original_currency"] = "EUR"
        elif eur_amounts and not czk_main:
            tx["currency"] = "EUR"
            tx["original_amount"] = eur_amounts[0][0]
            tx["original_currency"] = "EUR"

        result = [tx]

        # Pig/savings round-up as separate transaction
        if czk_pig:
            pig_val = czk_pig[0][0]
            result.append({
                "date": tx_date,
                "description": self.clean_description(
                    f"{desc} (savings round-up)"
                ),
                "original_description": f"{desc} (savings round-up)",
                "amount": pig_val,
                "type": "expense",
                "currency": "CZK",
                "is_savings_roundup": True,
            })

        return result

    def _extract_czk(self, raw: str, sign: str) -> float:
        """Extract CZK amount, stripping OCR icon-digit prefix.

        OCR sometimes reads category icons as a digit before the amount,
        e.g. "7 211,20" where "7" is an icon and "211,20" is the real
        amount. We detect this when: no sign character, and the raw
        amount is a single digit + space + valid amount.
        """
        sign_stripped = sign.strip() if sign else ""
        if not sign_stripped:
            m = _ICON_DIGIT_RE.match(raw)
            if m:
                stripped_val = self.clean_amount(m.group(2))
                if stripped_val > 0:
                    return stripped_val
        return self.clean_amount(raw)

    @staticmethod
    def _clean_desc(desc: str) -> str:
        desc = desc.replace("|", "").replace("©", "").replace("~", "")
        desc = re.sub(r"[—–©~=]+\s*$", "", desc)
        desc = re.sub(r"^[^\w\s]{1,3}\s*", "", desc)
        desc = re.sub(r"^[A-Z]{1,2}\s+", "", desc, count=1)
        desc = re.sub(r"^\d{1,3}[,.]?\s+", "", desc, count=1)
        desc = re.sub(r"\s+", " ", desc).strip()
        return desc
