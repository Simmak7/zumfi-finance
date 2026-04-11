"""UniCredit Bank Czech Republic statement parser.

PDF format: Text-based, multi-line block layout.
Columns:     Datum | Valuta | Transakce | Příjmy | Výdaje
Date format: DD.MM.YYYY
Amount format: Czech (dot thousands, comma decimal) — 68.775,85 / -759,00

Transaction types:
  - Platba u obchodníka  — card payment (merchant details, optional foreign currency)
  - Tuzemská platba okamžitá - Mobile Banking — mobile bank transfer
  - PŘEVOD V RÁMCI BANKY — intra-bank transfer (usually income)
  - Tuzemská platba — standard domestic payment
  - Výběr z bankomatu — ATM withdrawal
"""

import re
import logging
from features.statements.parsers.base import BaseParser

logger = logging.getLogger(__name__)

# Date at start of line, optionally followed by a second (valuta) date
_DATE_LINE_RE = re.compile(
    r"^(\d{2}\.\d{2}\.\d{4})"           # booking date
    r"(?:\s+(\d{2}\.\d{2}\.\d{4}))?"    # optional valuta date
    r"\s+(.+)$"                          # rest of the line (title + amount)
)

# Amount at the end of a string — Czech format with optional minus
_AMOUNT_TAIL_RE = re.compile(
    r"(-?\d{1,3}(?:\.\d{3})*,\d{2})\s*$"
)

# Lines to skip entirely
_SKIP_PATTERNS = [
    "unicredit bank czech republic",
    "obchodní rejstřík",
    "ičo/identification",
    "číslo účtu",
    "číslo výpisu",
    "frekvence výpisu",
    "datum výpisu",
    "období výpisu",
    "typ účtu",
    "typ konta",
    "strana ",
    "datum valuta transakce",
    "datum  valuta",
    "překontrolujte si",
    "v případě nejasností",
    "m_modul_",
    "id 1",
]

# Known non-transaction entries that start with a date
_BALANCE_KEYWORDS = [
    "počáteční zůstatek",
    "konečný zůstatek",
    "počáteční  zůstatek",
    "konečný  zůstatek",
]

# Summary header keywords to skip (they appear near amounts but are not transactions)
_SUMMARY_KEYWORDS = [
    "příjmy",
    "výdaje",
    "počet kreditních",
    "počet debetních",
]

# Income keywords in transaction details
_INCOME_KEYWORDS = [
    "příchozí úhrada",
    "příchozí platba",
    "připsáno",
    "vklad",
    "převod ve prospěch",
    "úrok",
]


class UniCreditParser(BaseParser):
    BANK_NAME = "unicredit"

    def parse(self, pdf_path: str) -> list[dict]:
        from features.statements.parsers.document_reader import open_document

        all_lines = []
        with open_document(pdf_path) as doc:
            for page in doc.pages:
                text = page.extract_text()
                if text:
                    all_lines.extend(text.splitlines())

        lines = self._filter_lines(all_lines)
        blocks = self._split_into_blocks(lines)
        transactions = []
        for block in blocks:
            tx = self._parse_block(block)
            if tx:
                transactions.append(tx)

        logger.info(f"UniCredit: parsed {len(transactions)} transactions from {pdf_path}")
        return transactions

    def _filter_lines(self, lines: list[str]) -> list[str]:
        """Remove header/footer noise and blank lines."""
        filtered = []
        for line in lines:
            stripped = line.strip()
            if not stripped:
                continue
            low = stripped.lower()
            if any(pat in low for pat in _SKIP_PATTERNS):
                continue
            if any(kw in low for kw in _SUMMARY_KEYWORDS):
                continue
            # Skip standalone "Měna CZK" or "CZK" header fragments
            if low in ("měna", "czk", "měna czk", "příjmy", "výdaje",
                        "příjmy výdaje", "strana"):
                continue
            filtered.append(stripped)
        return filtered

    def _split_into_blocks(self, lines: list[str]) -> list[list[str]]:
        """Split filtered lines into transaction blocks.
        Each block starts with a date line and includes all subsequent
        detail lines until the next date line.
        """
        blocks = []
        current = []
        for line in lines:
            if _DATE_LINE_RE.match(line):
                if current:
                    blocks.append(current)
                current = [line]
            elif current:
                current.append(line)
        if current:
            blocks.append(current)
        return blocks

    def _parse_block(self, block: list[str]) -> dict | None:
        """Parse a single transaction block into a transaction dict."""
        first_line = block[0]
        m = _DATE_LINE_RE.match(first_line)
        if not m:
            return None

        date_str = m.group(1)
        rest = m.group(3)

        # Check if this is a balance entry, not a transaction
        rest_lower = rest.lower()
        if any(kw in rest_lower for kw in _BALANCE_KEYWORDS):
            return None

        # Extract amount from end of the first line
        amt_match = _AMOUNT_TAIL_RE.search(rest)
        if not amt_match:
            return None

        raw_amount = amt_match.group(1)
        title = rest[:amt_match.start()].strip()

        amount = self.clean_amount(raw_amount)
        if amount == 0.0:
            return None

        # Determine direction from sign
        is_expense = raw_amount.startswith("-")
        tx_type = "expense" if is_expense else "income"

        # Parse date
        tx_date = self.parse_date(date_str, "%d.%m.%Y")

        # Build description from detail lines
        detail_lines = block[1:]
        description = self._build_description(title, detail_lines)
        original_description = title + " " + " ".join(detail_lines)

        tx = {
            "date": tx_date,
            "description": self._clean_unicredit_description(description),
            "original_description": original_description.strip(),
            "amount": amount,
            "type": tx_type,
            "currency": "CZK",
        }

        # Extract foreign currency info if present
        foreign = self._extract_foreign_currency(detail_lines)
        if foreign:
            tx["original_amount"] = foreign["original_amount"]
            tx["original_currency"] = foreign["original_currency"]

        return tx

    def _build_description(self, title: str, details: list[str]) -> str:
        """Build a meaningful description from the transaction title and detail lines."""
        title_lower = title.lower()

        # Card payment — extract merchant name and city
        if "platba u obchodníka" in title_lower:
            return self._describe_card_payment(title, details)

        # Mobile banking transfer — use Popis field
        if "mobile banking" in title_lower or "tuzemská platba" in title_lower:
            return self._describe_transfer(title, details)

        # Intra-bank transfer
        if "převod v rámci banky" in title_lower:
            return self._describe_intrabank(title, details)

        # ATM withdrawal
        if "výběr z bankomatu" in title_lower:
            return self._describe_atm(title, details)

        # Fallback: use title + popis if available
        popis = self._extract_field(details, "popis:")
        if popis:
            return f"{title}, {popis}"
        return title

    def _describe_card_payment(self, title: str, details: list[str]) -> str:
        """Extract merchant name and city from card payment details.

        Detail lines pattern:
          [MO/TO transakce]
          Datum transakce: : DD.MM.YYYY
          5428-1XXX-XX68-2398       (masked card)
          ZUZANA ZAIATS             (cardholder)
          CZK 759,00                (original amount)
          PVTJ4423, Luxor20 Bondy MB   (merchant code, merchant name)
          Mlada Bolesla, CZE        (city, country)
        """
        merchant_name = None
        city = None

        for i, line in enumerate(details):
            # Skip known detail lines
            low = line.lower()
            if any(low.startswith(p) for p in (
                "datum transakce", "mo/to", "odchozí", "příchozí",
                "ref1:", "vs:", "ks:", "číslo účtu",
            )):
                continue
            # Skip masked card number
            if re.match(r"^\d{4}-\d{1}XXX-XX\d{2}-\d{4}$", line):
                continue
            # Skip cardholder name (all caps, no comma, no digits)
            if re.match(r"^[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ ]+$", line) and "," not in line:
                continue
            # Skip original amount line (CZK 759,00 / INR 50,00)
            if re.match(r"^[A-Z]{3}\s+\d", line):
                continue
            # Skip exchange rate line (0,47 EUR/CZK 25,095000)
            if re.match(r"^\d+,\d+\s+[A-Z]{3}/[A-Z]{3}", line):
                continue

            # City line: "City, COUNTRY_CODE" (2-3 letter country)
            # Check BEFORE merchant to avoid "KOSMONOSY, CZE" matching as merchant
            if not city:
                m = re.match(r"^(.+),\s*([A-Z]{2,3})$", line)
                if m and not re.search(r"\d", m.group(1)):
                    city = m.group(1).strip()
                    continue

            # Merchant line: "CODE, Merchant Name" (code must contain a digit)
            if not merchant_name:
                m = re.match(r"^(?=[A-Z0-9]*\d)[A-Z0-9]{4,},\s*(.+)$", line)
                if m:
                    merchant_name = m.group(1).strip()
                    continue

        if merchant_name and city:
            return f"{merchant_name}, {city}"
        if merchant_name:
            return merchant_name
        return title

    def _describe_transfer(self, title: str, details: list[str]) -> str:
        """Extract description from Popis field for bank transfers."""
        popis = self._extract_field(details, "popis:")
        recipient = self._extract_field(details, "příjemce:")
        if popis and recipient:
            return f"{recipient}, {popis}"
        if popis:
            return popis
        if recipient:
            return recipient
        # Shorten the title for cleaner descriptions
        short_title = title.replace("Tuzemská platba okamžitá - Mobile Banking", "Tuzemská platba")
        short_title = short_title.replace("Tuzemská platba - Mobile Banking", "Tuzemská platba")
        return short_title

    def _describe_intrabank(self, title: str, details: list[str]) -> str:
        """Extract payer info for intra-bank transfers."""
        payer = self._extract_field(details, "plátce:")
        popis = self._extract_field(details, "popis:")
        # Skip popis if it's just VS/KS/SS codes (no useful info)
        if popis and re.match(r"^[VS/KS0-9]+$", popis.replace(" ", "")):
            popis = None
        # Look for meaningful info in non-field detail lines
        if payer and not popis:
            for line in details:
                low = line.lower()
                if any(low.startswith(p) for p in (
                    "příchozí", "číslo účtu", "plátce:", "popis:", "ref1:", "vs:", "ks:",
                )):
                    continue
                # Lines with company/description info (e.g. "SKODA HR MZDY")
                if re.search(r"[a-zA-Z]{3,}", line) and not line.startswith("0"):
                    popis = line.strip()
                    break
        if payer and popis:
            return f"{payer}, {popis}"
        if payer:
            return payer
        if popis:
            return popis
        return title

    def _describe_atm(self, title: str, details: list[str]) -> str:
        """Extract ATM location if available."""
        for line in details:
            m = re.match(r"^(.+),\s*([A-Z]{2,3})$", line)
            if m:
                return f"Výběr z bankomatu, {m.group(1).strip()}"
        return title

    @staticmethod
    def _clean_unicredit_description(desc: str) -> str:
        """Clean description without stripping merchant name words.

        Unlike BaseParser.clean_description, this does NOT remove long uppercase
        words (e.g. STARBUCKS, KOSMONOSY) which are valid merchant/location names.
        """
        # Remove dates
        desc = re.sub(r"\d{2}\.\d{2}\.\d{4}", "", desc)
        desc = re.sub(r"\d{4}-\d{2}-\d{2}", "", desc)
        # Remove standalone long numeric codes only (not alphanumeric merchant names)
        desc = re.sub(r"\b\d{10,}\b", "", desc)
        desc = re.sub(r"\s+", " ", desc)
        return desc.strip().title()

    @staticmethod
    def _extract_field(details: list[str], prefix: str) -> str | None:
        """Extract a value from detail lines by prefix (case-insensitive)."""
        prefix_lower = prefix.lower()
        for line in details:
            if line.lower().startswith(prefix_lower):
                return line[len(prefix):].strip()
        return None

    @staticmethod
    def _extract_foreign_currency(details: list[str]) -> dict | None:
        """Extract foreign currency amount and code from detail lines.

        Patterns:
          INR 50,00                    (original amount)
          0,47 EUR/CZK 25,095000      (exchange rate)
        """
        for line in details:
            m = re.match(
                r"^([A-Z]{3})\s+(\d{1,3}(?:[.\s]\d{3})*,\d{2})\s*$",
                line,
            )
            if m:
                currency = m.group(1)
                if currency == "CZK":
                    continue
                try:
                    raw = m.group(2).replace(".", "").replace(" ", "").replace(",", ".")
                    return {
                        "original_amount": float(raw),
                        "original_currency": currency,
                    }
                except ValueError:
                    continue
        return None
