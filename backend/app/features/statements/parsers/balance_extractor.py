"""Extract closing balance and statement period from bank statement documents."""

import re
from calendar import monthrange
from datetime import date
from decimal import Decimal

BALANCE_PATTERNS = [
    # Czech: "Konečný zůstatek: 123 456,78" or concatenated "Konečnýzůstatek:"
    re.compile(
        r"(?:Konečný\s*zůstatek|Konecny\s*zustatek|Zůstatek\s+na\s+účtu|"
        r"Zustatek\s+na\s+uctu|Zůstatek\s+ke\s+dni|Konečný\s*zustatek)"
        r"\s*:?\s*([\d\s]+[,.]\d{2})\s*([A-Z]{3})?",
        re.IGNORECASE,
    ),
    # Slovak (FIO SK branch): "Nový zostatok 10 070,86"
    re.compile(
        r"Nový\s+zostatok\s*:?\s*(-?[\d\s]+[,.]\d{2})\s*([A-Z]{3})?",
        re.IGNORECASE,
    ),
    # English: "Closing Balance: 1,234.56 CZK"
    re.compile(
        r"(?:Closing\s+[Bb]alance|End(?:ing)?\s+[Bb]alance|"
        r"Balance\s+(?:at|as\s+of))"
        r"\s*:?\s*([\d,.\s]+\d)\s*([A-Z]{3})?",
        re.IGNORECASE,
    ),
    # Generic amount after balance keyword
    re.compile(
        r"(?:Konečný|Closing|Celkem|Total)\s+(?:zůstatek|zustatek|balance)"
        r"[\s:]+(-?[\d\s]+[,.]\d{2})",
        re.IGNORECASE,
    ),
]


def _parse_balance_amount(text: str) -> float:
    """Parse a balance amount string, handling Czech/European formats.

    Handles: "718 600.17", "718 600,17", "1,234.56", "1234.56"
    """
    cleaned = text.strip()
    # Remove currency codes
    cleaned = re.sub(r"[A-Z]{3}", "", cleaned).strip()

    # Strip spaces used as thousands separators
    cleaned = cleaned.replace(" ", "")

    # If comma is the decimal separator (e.g. "718600,17")
    if re.match(r"^[\d]+,\d{2}$", cleaned):
        cleaned = cleaned.replace(",", ".")
    else:
        # English: commas are thousands separators
        cleaned = cleaned.replace(",", "")

    try:
        return abs(float(cleaned))
    except ValueError:
        return 0.0


def extract_closing_balance(file_path: str) -> Decimal | None:
    """Extract closing balance from a statement document.

    Scans all pages for closing balance patterns.

    Returns:
        Balance as Decimal, or None if not found.
    """
    from .document_reader import open_document

    doc = open_document(file_path)
    full_text = "\n".join(page.extract_text() or "" for page in doc.pages)

    for pattern in BALANCE_PATTERNS:
        match = pattern.search(full_text)
        if match:
            amount_str = match.group(1)
            amount = _parse_balance_amount(amount_str)
            if amount > 0:
                return Decimal(str(round(amount, 2)))

    return None


# ── Period extraction ──

PERIOD_RANGE_PATTERNS = [
    # Czech: "za období 01.01.2025 - 31.01.2025" or with em-dash
    re.compile(
        r"za\s+obdob[ií]\s+(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\s*[-–]\s*"
        r"(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})",
        re.IGNORECASE,
    ),
    # Slovak (FIO SK): "Výpis za obdobie 1.1.2026-31.3.2026"
    re.compile(
        r"za\s+obdobie\s+(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\s*[-–]\s*"
        r"(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})",
        re.IGNORECASE,
    ),
    # Czech: "Období: 01.01.2025 - 31.01.2025"
    re.compile(
        r"[Oo]bdob[ií]\s*:?\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\s*[-–]\s*"
        r"(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})",
    ),
    # English: "Period: 01/01/2025 - 31/01/2025"
    re.compile(
        r"[Pp]eriod\s*:?\s*(\d{1,2})/(\d{1,2})/(\d{4})\s*(?:to|[-–])\s*"
        r"(\d{1,2})/(\d{1,2})/(\d{4})",
    ),
]

PERIOD_SINGLE_PATTERNS = [
    # Czech: "ke dni 31.01.2025"
    re.compile(
        r"ke\s+dni\s+(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})",
        re.IGNORECASE,
    ),
    # English: "Statement date: 31/01/2025" or "as of 31/01/2025"
    re.compile(
        r"(?:[Ss]tatement\s+date|[Aa]s\s+of)\s*:?\s*(\d{1,2})[./](\d{1,2})[./](\d{4})",
    ),
]


def extract_statement_period(file_path: str) -> tuple[date | None, date | None]:
    """Extract statement period from document text.

    Returns:
        (period_start, period_end) or (None, None) if not found.
    """
    from .document_reader import open_document

    doc = open_document(file_path)
    full_text = "\n".join(page.extract_text() or "" for page in doc.pages)

    # Try range patterns first (start - end)
    for pattern in PERIOD_RANGE_PATTERNS:
        match = pattern.search(full_text)
        if match:
            d1, m1, y1, d2, m2, y2 = (int(g) for g in match.groups())
            try:
                return date(y1, m1, d1), date(y2, m2, d2)
            except ValueError:
                continue

    # Try single-date patterns ("ke dni DD.MM.YYYY")
    for pattern in PERIOD_SINGLE_PATTERNS:
        match = pattern.search(full_text)
        if match:
            d, m, y = int(match.group(1)), int(match.group(2)), int(match.group(3))
            try:
                end_date = date(y, m, d)
                start_date = date(y, m, 1)
                return start_date, end_date
            except ValueError:
                continue

    return None, None
