"""Base parser class for bank statement PDF parsing."""

import re
from abc import ABC, abstractmethod
from datetime import date, datetime

from core.currencies import ALL_CURRENCY_CODES

# Pre-build regex pattern for stripping known currency codes from descriptions
_CURRENCY_PATTERN = re.compile(
    r"\b(" + "|".join(sorted(ALL_CURRENCY_CODES, key=len, reverse=True)) + r")\b"
)


class BaseParser(ABC):
    """Abstract base class for bank statement parsers."""

    BANK_NAME: str = "unknown"

    @abstractmethod
    def parse(self, pdf_path: str) -> list[dict]:
        """Parse a bank statement PDF and return transaction dicts.

        Each dict must contain:
            date: date object
            description: cleaned description
            original_description: raw description
            amount: float (positive)
            type: "income" or "expense"
            currency: 3-letter code
        """
        ...

    @staticmethod
    def clean_description(desc: str) -> str:
        """Remove noise from bank descriptions."""
        desc = re.sub(r"\d{2}\.\d{2}\.\d{4}", "", desc)
        desc = re.sub(r"\d{4}-\d{2}-\d{2}", "", desc)
        desc = re.sub(r"\b[A-Z0-9]{8,}\b", "", desc)
        desc = _CURRENCY_PATTERN.sub("", desc)
        desc = re.sub(r"^Payment to ", "", desc)
        desc = re.sub(r"^Card transaction ", "", desc)
        return desc.strip().title()

    @staticmethod
    def clean_amount(text: str) -> float:
        """Parse amount from various formats.

        Handles:
            1,234.56   (English)
            1 234,56   (Czech/European)
            -1 234,56  (Czech negative)
            1234.56    (plain)
        """
        cleaned = text.strip()
        # Normalize Unicode minus/dash variants to ASCII hyphen-minus
        cleaned = re.sub(r"[\u2212\u2013\u2014\u00ad\u2010\u2011]", "-", cleaned)
        # Remove currency codes
        cleaned = re.sub(r"[A-Z]{3}", "", cleaned)
        cleaned = cleaned.strip()

        # Strip leading minus for format detection, re-apply after
        negative = cleaned.startswith("-")
        if negative:
            cleaned = cleaned[1:].strip()

        # European format: dot as thousands sep, comma as decimal (68.775,85)
        if re.match(r"^\d{1,3}(?:\.\d{3})+,\d{2}$", cleaned):
            cleaned = cleaned.replace(".", "").replace(",", ".")
        # Czech format: space as thousands sep, comma as decimal
        elif re.match(r"^[\d\s]+,\d{2}$", cleaned):
            cleaned = cleaned.replace(" ", "").replace(",", ".")
        else:
            # English format: comma as thousands sep, dot as decimal
            cleaned = cleaned.replace(" ", "").replace(",", "")

        try:
            return abs(float(cleaned))
        except ValueError:
            return 0.0

    @staticmethod
    def parse_date(date_str: str, fmt: str) -> date:
        """Parse date string with format, fallback to today."""
        try:
            return datetime.strptime(date_str.strip(), fmt).date()
        except ValueError:
            return datetime.now().date()
