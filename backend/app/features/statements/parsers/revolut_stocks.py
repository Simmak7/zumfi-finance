"""Revolut Securities stock statement parser.

Parses Revolut stock/ETF account statements that contain:
- USD and/or EUR sections
- Portfolio breakdown tables (Symbol, Company, ISIN, Quantity, Price, Value, %)
- Account summaries (starting/ending stock + cash values)
- Transaction history (trades, cash top-ups, withdrawals)

Returns structured holdings data + transactions (NOT BaseParser transactions).
"""

import re
import logging
from datetime import datetime

import pdfplumber

logger = logging.getLogger(__name__)

# Months for date parsing
MONTH_MAP = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}

# Holding line: TICKER  Company Name  ISIN  Quantity  Price  Value  Pct%
# Examples:
#   MSFT Microsoft US5949181045 20.99085667 US$401.14 US$8,420.27 76.39%
#   QDV5 iShares MSCI India Acc ETF IE00BZCQB185 403.6228006 €8.16 €3,293.56 24.15%
HOLDING_RE = re.compile(
    r"^(\S+)\s+"            # ticker (first non-space word)
    r"(.+?)\s+"             # company name (greedy middle)
    r"([A-Z]{2}[\w\d]{8,12})\s+"  # ISIN (2 letters + 8-12 alphanumeric)
    r"([\d.]+)\s+"          # quantity
    r"[^\d]*([\d,.]+)\s+"   # price (skip currency prefix)
    r"[^\d]*([\d,.]+)\s+"   # value (skip currency prefix)
    r"([\d.]+)%"            # percentage
)

# Period pattern: "01 Jan 2026 - 09 Feb 2026"
PERIOD_RE = re.compile(
    r"(\d{1,2})\s+(\w{3})\s+(\d{4})\s*-\s*(\d{1,2})\s+(\w{3})\s+(\d{4})"
)

# Account summary value: "US$10,079.86" or "€13,570.64"
VALUE_RE = re.compile(r"[US$€£]*([\d,]+\.?\d*)")

# Section headers
PORTFOLIO_HEADER_RE = re.compile(r"(USD|EUR)\s+Portfolio breakdown", re.IGNORECASE)
SUMMARY_HEADER_RE = re.compile(r"(USD|EUR)\s+Account summary", re.IGNORECASE)
TRANSACTIONS_HEADER_RE = re.compile(r"(USD|EUR)\s+Transactions", re.IGNORECASE)

# Transaction line pattern:
# Date: "25 Feb 2021 14:30:38 GMT" (GMT may merge with next word)
# Type: "Trade - Market" or "Stock split"
# The rest has: quantity, price, side(Buy/Sell), value, fees, commission
TRADE_DATE_RE = re.compile(
    r"^(\d{1,2}\s+\w{3}\s+\d{4})\s+\d{2}:\d{2}:\d{2}\s+GMT"
)

# Currency value extractor: "US$14", "US$3,297.20", "€46.95", "-US$0.30"
CURRENCY_VALUE_RE = re.compile(r"-?(?:US\$|€|£)([\d,]+\.?\d*)")


def _parse_value(text: str) -> float:
    """Extract numeric value from currency string like 'US$10,079.86' or '€13,640.50'."""
    m = VALUE_RE.search(text)
    if not m:
        return 0.0
    return float(m.group(1).replace(",", ""))


def _parse_date(day: str, month_abbr: str, year: str):
    """Parse date components into a date object."""
    month = MONTH_MAP.get(month_abbr.lower()[:3], 1)
    return datetime(int(year), month, int(day)).date()


def _detect_holding_type(name: str, isin: str) -> str:
    """Detect if a holding is a stock or ETF."""
    name_lower = name.lower()
    if "etf" in name_lower or "ishares" in name_lower:
        return "etf"
    # ISIN prefix: IE/LU = likely fund/ETF, DE with iShares = ETF
    if isin and isin[:2] in ("IE", "LU"):
        return "etf"
    return "stock"


def _extract_currency_values(text: str) -> list[float]:
    """Extract all currency values from text (US$14, €46.95, etc.)."""
    values = []
    for m in CURRENCY_VALUE_RE.finditer(text):
        raw = m.group(1).replace(",", "")
        try:
            val = float(raw)
            # Check if the match was preceded by a minus sign
            start = m.start()
            if start > 0 and text[start - 1] == '-':
                val = -val
            values.append(val)
        except ValueError:
            pass
    return values


def _parse_trade_line(line: str) -> dict | None:
    """Parse a single 'Trade - Market' transaction line.

    Handles column merging in PDF text (e.g., 'GMTMSFT', 'BuyUS$14').

    Returns:
        {"date": date, "ticker": str, "type": "BUY"|"SELL",
         "quantity": float, "price": float, "value": float, "fees": float}
        or None if line doesn't match.
    """
    if "Trade - Market" not in line:
        return None

    # Extract date from beginning
    date_match = re.match(
        r"(\d{1,2})\s+(\w{3})\s+(\d{4})\s+\d{2}:\d{2}:\d{2}\s+GMT",
        line
    )
    if not date_match:
        return None

    day, mon, year = date_match.group(1), date_match.group(2), date_match.group(3)
    txn_date = _parse_date(day, mon, year)

    # Everything after "GMT" (may merge with ticker)
    after_gmt = line[date_match.end():]

    # Extract ticker: text between GMT and "Trade - Market"
    trade_idx = after_gmt.index("Trade - Market")
    ticker = after_gmt[:trade_idx].strip()

    # After "Trade - Market"
    after_type = after_gmt[trade_idx + len("Trade - Market"):].strip()

    # Determine Buy or Sell from the line
    is_sell = "Sell" in after_type

    # Extract all numeric values after "Trade - Market"
    # Pattern: quantity  price  Buy/Sell+value  fees  commission
    # Example: "0.06023837 US$232.41 BuyUS$14 US$0 US$0"
    # Example: "0.12534539 US$39.81 BuyUS$4.99 US$0.01 US$0"

    # Get quantity (first decimal number)
    qty_match = re.match(r"(-?[\d.]+)", after_type)
    if not qty_match:
        return None
    quantity = float(qty_match.group(1))

    # Extract currency values (price, value, fees, commission)
    currency_vals = _extract_currency_values(after_type)

    # Should have at least 3 values: price, value, fees (commission may be 0)
    if len(currency_vals) < 3:
        return None

    price = currency_vals[0]
    value = currency_vals[1]
    fees = currency_vals[2]
    commission = currency_vals[3] if len(currency_vals) > 3 else 0.0

    return {
        "date": txn_date,
        "ticker": ticker,
        "type": "SELL" if is_sell else "BUY",
        "quantity": abs(quantity),
        "price": abs(price),
        "value": abs(value),
        "fees": abs(fees) + abs(commission),
    }


def _parse_split_line(line: str) -> dict | None:
    """Parse a 'Stock split' transaction line.

    Returns:
        {"date": date, "ticker": str, "type": "SPLIT", "quantity": float, ...}
        or None if line doesn't match.
    """
    if "Stock split" not in line:
        return None

    date_match = re.match(
        r"(\d{1,2})\s+(\w{3})\s+(\d{4})\s+\d{2}:\d{2}:\d{2}\s+GMT",
        line
    )
    if not date_match:
        return None

    day, mon, year = date_match.group(1), date_match.group(2), date_match.group(3)
    txn_date = _parse_date(day, mon, year)

    # Extract ticker between GMT and "Stock split"
    after_gmt = line[date_match.end():]
    split_idx = after_gmt.index("Stock split")
    ticker = after_gmt[:split_idx].strip()

    # Extract quantity after "Stock split"
    after_split = after_gmt[split_idx + len("Stock split"):].strip()
    qty_match = re.match(r"(-?[\d.]+)", after_split)
    if not qty_match:
        return None

    quantity = float(qty_match.group(1))

    return {
        "date": txn_date,
        "ticker": ticker,
        "type": "SPLIT",
        "quantity": quantity,
        "price": 0.0,
        "value": 0.0,
        "fees": 0.0,
    }


class RevolutStockParser:
    """Parse Revolut Securities account statements."""

    def parse(self, pdf_path: str) -> dict:
        """Parse a Revolut stock statement PDF.

        Returns:
            {
                "period_start": date,
                "period_end": date,
                "sections": [
                    {
                        "currency": "USD",
                        "starting_value": float,
                        "ending_value": float,
                        "cash_value": float,
                        "holdings": [...],
                        "transactions": [
                            {
                                "date": date, "ticker": str,
                                "type": "BUY"|"SELL"|"SPLIT",
                                "quantity": float, "price": float,
                                "value": float, "fees": float
                            }
                        ]
                    }
                ]
            }
        """
        result = {
            "period_start": None,
            "period_end": None,
            "sections": [],
        }

        all_text = ""
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                text = page.extract_text() or ""
                all_text += text + "\n"

        if not all_text.strip():
            logger.warning(f"RevolutStockParser: empty text from {pdf_path}")
            return result

        # Extract period from header
        period_match = PERIOD_RE.search(all_text)
        if period_match:
            d1, m1, y1, d2, m2, y2 = period_match.groups()
            result["period_start"] = _parse_date(d1, m1, y1)
            result["period_end"] = _parse_date(d2, m2, y2)

        lines = all_text.split("\n")
        sections = self._split_sections(lines)

        for currency, section_lines in sections.items():
            section = self._parse_section(currency, section_lines)
            if section["holdings"] or section["transactions"]:
                result["sections"].append(section)

        total_holdings = sum(len(s["holdings"]) for s in result["sections"])
        total_txns = sum(len(s["transactions"]) for s in result["sections"])
        logger.info(
            f"RevolutStockParser: parsed {total_holdings} holdings + "
            f"{total_txns} transactions "
            f"in {len(result['sections'])} currency sections from {pdf_path}"
        )

        return result

    def _split_sections(self, lines: list[str]) -> dict[str, list[str]]:
        """Split document text into currency sections (USD, EUR)."""
        sections = {}
        current_currency = None
        current_lines = []

        for line in lines:
            # Check for section headers
            summary_match = SUMMARY_HEADER_RE.search(line)
            portfolio_match = PORTFOLIO_HEADER_RE.search(line)
            transactions_match = TRANSACTIONS_HEADER_RE.search(line)

            if summary_match:
                new_currency = summary_match.group(1).upper()
                if current_currency and current_currency != new_currency:
                    sections[current_currency] = current_lines
                    current_lines = []
                current_currency = new_currency

            if portfolio_match and not current_currency:
                current_currency = portfolio_match.group(1).upper()

            if transactions_match and not current_currency:
                current_currency = transactions_match.group(1).upper()

            if current_currency:
                current_lines.append(line)

        if current_currency and current_lines:
            sections[current_currency] = current_lines

        return sections

    def _parse_section(self, currency: str, lines: list[str]) -> dict:
        """Parse a single currency section for holdings, summary, and transactions."""
        section = {
            "currency": currency,
            "starting_value": 0.0,
            "ending_value": 0.0,
            "cash_value": 0.0,
            "holdings": [],
            "transactions": [],
        }

        in_portfolio = False
        in_summary = False
        in_transactions = False

        for i, line in enumerate(lines):
            stripped = line.strip()
            if not stripped:
                continue

            # Detect portfolio breakdown section
            if PORTFOLIO_HEADER_RE.search(stripped):
                in_portfolio = True
                in_summary = False
                in_transactions = False
                continue

            # Detect account summary section
            if SUMMARY_HEADER_RE.search(stripped):
                in_summary = True
                in_portfolio = False
                in_transactions = False
                continue

            # Detect transactions section
            if TRANSACTIONS_HEADER_RE.search(stripped):
                in_transactions = True
                in_portfolio = False
                in_summary = False
                continue

            # End portfolio section at "Stocks value" total line
            if in_portfolio and stripped.startswith("Stocks value"):
                in_portfolio = False
                continue

            # Skip header row
            if in_portfolio and stripped.startswith("Symbol"):
                continue

            # Parse holdings
            if in_portfolio:
                holding = self._parse_holding_line(stripped)
                if holding:
                    section["holdings"].append(holding)

            # Parse summary values
            if in_summary:
                if "Stocks value" in stripped or "stocks value" in stripped.lower():
                    values = self._extract_summary_values(stripped)
                    if len(values) >= 2:
                        section["starting_value"] = values[0]
                        section["ending_value"] = values[1]
                    elif len(values) == 1:
                        section["ending_value"] = values[0]
                elif "Cash value" in stripped or "cash value" in stripped.lower():
                    values = self._extract_summary_values(stripped)
                    if values:
                        section["cash_value"] = values[-1]
                elif stripped.startswith("Total"):
                    in_summary = False

            # Parse transactions
            if in_transactions:
                # Skip header rows and non-transaction lines
                if stripped.startswith("Date") or stripped.startswith("Symbol"):
                    continue

                txn = _parse_trade_line(stripped)
                if txn:
                    section["transactions"].append(txn)
                    continue

                txn = _parse_split_line(stripped)
                if txn:
                    section["transactions"].append(txn)

        return section

    def _parse_holding_line(self, line: str) -> dict | None:
        """Parse a single portfolio holding line."""
        match = HOLDING_RE.match(line)
        if not match:
            return None

        ticker, name, isin, qty, price, value, pct = match.groups()

        # Skip zero-value holdings
        parsed_value = float(value.replace(",", ""))
        if parsed_value == 0:
            return None

        return {
            "ticker": ticker.strip(),
            "name": name.strip(),
            "isin": isin.strip(),
            "shares": float(qty),
            "price": float(price.replace(",", "")),
            "value": parsed_value,
            "pct": float(pct),
            "holding_type": _detect_holding_type(name, isin),
        }

    def _extract_summary_values(self, line: str) -> list[float]:
        """Extract all numeric values from a summary line."""
        values = []
        for m in VALUE_RE.finditer(line):
            raw = m.group(1).replace(",", "")
            if raw and raw != "0":
                try:
                    values.append(float(raw))
                except ValueError:
                    pass
        return values
