"""Revolut Profit and Loss statement parser.

Parses Revolut P&L statements that contain:
- Per-currency (USD/EUR) sells tables with realized gains/losses
- Per-currency dividend / other income tables
- Summary totals (gross proceeds, cost basis, gross PnL)
- CZK equivalents with exchange rates for each amount

Returns structured P&L data (NOT BaseParser transactions).
"""

import re
import logging

import pdfplumber

logger = logging.getLogger(__name__)

# Period: "01 Jan 2026 - 31 Jan 2026"
PERIOD_RE = re.compile(
    r"(\d{1,2})\s+(\w{3})\s+(\d{4})\s*-\s*(\d{1,2})\s+(\w{3})\s+(\d{4})"
)

MONTH_MAP = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}

# Currency amount: "US$192.37" or "€277.96" or "-US$33" or "-€141.05"
CURRENCY_VALUE_RE = re.compile(r"(-?)(?:US\$|€|£)([\d,]+\.?\d*)")

# Sell row: date_acquired  date_sold  symbol  name  ISIN  country  quantity  cost_basis  proceeds  pnl  fees
# Example: 2025-12-08 2026-01-28 BLND Blend Labs Inc US09352U1088 US 58.14199395 US$192.37 ... US$159.37 ... -US$33 ... US$0.01
SELL_DATE_RE = re.compile(r"^(\d{4}-\d{2}-\d{2})\s+(\d{4}-\d{2}-\d{2})\s+")

# CZK rate line: "4,012.12 CZK" and "Rate: 20.856"
CZK_AMOUNT_RE = re.compile(r"([\d,]+\.?\d*)\s*CZK")
RATE_RE = re.compile(r"Rate:\s*([\d.]+)")

# Section headers
PNL_HEADER_RE = re.compile(r"(USD|EUR)\s+Profit and Loss Statement", re.IGNORECASE)
SELLS_HEADER_RE = re.compile(r"^Sells$", re.IGNORECASE)
SELLS_SUMMARY_RE = re.compile(r"^Sells Summary$", re.IGNORECASE)
OTHER_INCOME_RE = re.compile(r"^Other income & fees$", re.IGNORECASE)

# Dividend row: date  description  security  ISIN  country  gross  tax  net
DIVIDEND_DATE_RE = re.compile(r"^(\d{4}-\d{2}-\d{2})\s+")


def _parse_date(day_str, month_abbr, year_str):
    from datetime import datetime
    month = MONTH_MAP.get(month_abbr.lower()[:3], 1)
    return datetime(int(year_str), month, int(day_str)).date()


def _parse_currency_value(text: str) -> float:
    """Parse 'US$192.37' or '-€141.05' to float."""
    m = CURRENCY_VALUE_RE.search(text)
    if not m:
        return 0.0
    sign = -1 if m.group(1) == "-" else 1
    return sign * float(m.group(2).replace(",", ""))


def _extract_all_currency_values(text: str) -> list[float]:
    """Extract all currency values from a text string."""
    values = []
    for m in CURRENCY_VALUE_RE.finditer(text):
        sign = -1 if m.group(1) == "-" else 1
        values.append(sign * float(m.group(2).replace(",", "")))
    return values


def _extract_czk_values(text: str) -> list[float]:
    """Extract CZK amounts from text."""
    values = []
    for m in CZK_AMOUNT_RE.finditer(text):
        values.append(float(m.group(1).replace(",", "")))
    return values


def _extract_rates(text: str) -> list[float]:
    """Extract exchange rates from text."""
    return [float(m.group(1)) for m in RATE_RE.finditer(text)]


class RevolutPnlParser:
    """Parse Revolut Profit and Loss statements."""

    def parse(self, pdf_path: str) -> dict:
        """Parse a Revolut P&L statement PDF.

        Returns:
            {
                "period_start": date,
                "period_end": date,
                "sections": [
                    {
                        "currency": "USD",
                        "sells_summary": {
                            "gross_proceeds": float,
                            "cost_basis": float,
                            "gross_pnl": float,
                        },
                        "dividends_summary": {
                            "dividend": float,
                            "withholding_tax": float,
                            "other_transactions": float,
                            "total": float,
                        },
                        "sells": [
                            {
                                "date_acquired": "2025-12-08",
                                "date_sold": "2026-01-28",
                                "symbol": "BLND",
                                "name": "Blend Labs Inc",
                                "isin": "US09352U1088",
                                "country": "US",
                                "quantity": 58.14199395,
                                "cost_basis": 192.37,
                                "gross_proceeds": 159.37,
                                "gross_pnl": -33.0,
                                "fees": 0.01,
                                "cost_basis_czk": 4012.12,
                                "gross_proceeds_czk": 3232.34,
                                "gross_pnl_czk": -779.78,
                                "rate_buy": 20.856,
                                "rate_sell": 20.282,
                            }
                        ],
                        "dividends": []
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
            logger.warning(f"RevolutPnlParser: empty text from {pdf_path}")
            return result

        # Extract period
        period_match = PERIOD_RE.search(all_text)
        if period_match:
            d1, m1, y1, d2, m2, y2 = period_match.groups()
            result["period_start"] = _parse_date(d1, m1, y1)
            result["period_end"] = _parse_date(d2, m2, y2)

        # Split into currency sections
        lines = all_text.split("\n")
        sections = self._split_currency_sections(lines)

        for currency, section_lines in sections.items():
            section = self._parse_section(currency, section_lines)
            result["sections"].append(section)

        total_sells = sum(len(s["sells"]) for s in result["sections"])
        total_divs = sum(len(s["dividends"]) for s in result["sections"])
        logger.info(
            f"RevolutPnlParser: {total_sells} sells, {total_divs} dividends "
            f"from {pdf_path}"
        )

        return result

    def _split_currency_sections(self, lines: list[str]) -> dict[str, list[str]]:
        """Split into USD and EUR sections."""
        sections: dict[str, list[str]] = {}
        current_currency = None
        current_lines: list[str] = []

        for line in lines:
            header_match = PNL_HEADER_RE.search(line)
            if header_match:
                new_currency = header_match.group(1).upper()
                if current_currency and current_currency != new_currency:
                    if current_currency not in sections:
                        sections[current_currency] = []
                    sections[current_currency].extend(current_lines)
                    current_lines = []
                current_currency = new_currency

            if current_currency:
                current_lines.append(line)

        if current_currency and current_lines:
            if current_currency not in sections:
                sections[current_currency] = []
            sections[current_currency].extend(current_lines)

        return sections

    def _parse_section(self, currency: str, lines: list[str]) -> dict:
        """Parse a single currency P&L section."""
        section = {
            "currency": currency,
            "sells_summary": {
                "gross_proceeds": 0.0,
                "cost_basis": 0.0,
                "gross_pnl": 0.0,
            },
            "dividends_summary": {
                "dividend": 0.0,
                "withholding_tax": 0.0,
                "other_transactions": 0.0,
                "total": 0.0,
            },
            "sells": [],
            "dividends": [],
        }

        in_sells_summary = False
        in_sells = False
        in_other_income = False
        in_other_summary = False

        i = 0
        while i < len(lines):
            stripped = lines[i].strip()
            if not stripped:
                i += 1
                continue

            # Detect section boundaries
            if SELLS_SUMMARY_RE.match(stripped):
                in_sells_summary = True
                in_sells = False
                in_other_income = False
                in_other_summary = False
                i += 1
                continue

            if re.match(r"^Other income & fees Summary$", stripped, re.IGNORECASE):
                in_other_summary = True
                in_sells_summary = False
                in_sells = False
                in_other_income = False
                i += 1
                continue

            if SELLS_HEADER_RE.match(stripped):
                in_sells = True
                in_sells_summary = False
                in_other_income = False
                in_other_summary = False
                i += 1
                continue

            if OTHER_INCOME_RE.match(stripped):
                in_other_income = True
                in_sells = False
                in_sells_summary = False
                in_other_summary = False
                i += 1
                continue

            # Parse sells summary values
            if in_sells_summary:
                if stripped.startswith("Gross Proceeds"):
                    section["sells_summary"]["gross_proceeds"] = _parse_currency_value(stripped)
                elif stripped.startswith("Cost Basis"):
                    section["sells_summary"]["cost_basis"] = _parse_currency_value(stripped)
                elif stripped.startswith("Gross PnL"):
                    section["sells_summary"]["gross_pnl"] = _parse_currency_value(stripped)

            # Parse other income summary
            if in_other_summary:
                if stripped.startswith("Dividend"):
                    section["dividends_summary"]["dividend"] = _parse_currency_value(stripped)
                elif stripped.startswith("Withholding Tax"):
                    val = _parse_currency_value(stripped)
                    section["dividends_summary"]["withholding_tax"] = val
                elif stripped.startswith("Other Transactions"):
                    section["dividends_summary"]["other_transactions"] = _parse_currency_value(stripped)
                elif stripped.startswith("Amount"):
                    section["dividends_summary"]["total"] = _parse_currency_value(stripped)

            # Parse individual sell rows
            if in_sells:
                if stripped.startswith("Date acquired") or stripped.startswith("Date sold"):
                    i += 1
                    continue
                if stripped.startswith("Total"):
                    in_sells = False
                    i += 1
                    continue

                sell = self._parse_sell_row(stripped, lines, i)
                if sell:
                    section["sells"].append(sell)

            # Parse individual dividend rows
            if in_other_income:
                if stripped.startswith("Date") and "Description" in stripped:
                    i += 1
                    continue
                if stripped.startswith("Total"):
                    in_other_income = False
                    i += 1
                    continue

                dividend = self._parse_dividend_row(stripped)
                if dividend:
                    section["dividends"].append(dividend)

            i += 1

        return section

    def _parse_sell_row(self, line: str, all_lines: list[str], idx: int) -> dict | None:
        """Parse a sell transaction row.

        The sell data spans multiple sub-lines due to CZK equivalents.
        Format: date_acquired date_sold SYMBOL Name ISIN Country Qty CostBasis Proceeds PnL Fees
        """
        date_match = SELL_DATE_RE.match(line)
        if not date_match:
            return None

        date_acquired = date_match.group(1)
        date_sold = date_match.group(2)
        rest = line[date_match.end():].strip()

        # Parse: SYMBOL  Name  ISIN  Country  Quantity  CostBasis  Proceeds  PnL  Fees
        # The tricky part is the name can be multiple words
        # Strategy: find ISIN pattern, then work from there
        isin_match = re.search(r"([A-Z]{2}[\w\d]{8,12})\s+(\w{2})\s+([\d.]+)\s+", rest)
        if not isin_match:
            return None

        before_isin = rest[:isin_match.start()].strip()
        parts = before_isin.split(None, 1)
        symbol = parts[0] if parts else ""
        name = parts[1].strip() if len(parts) > 1 else ""

        isin = isin_match.group(1)
        country = isin_match.group(2)
        quantity = float(isin_match.group(3))

        after_qty = rest[isin_match.end() + len(isin_match.group(3)):].strip()
        # Get the part after country + quantity
        after_isin = rest[isin_match.end():].strip()

        # Extract all currency values from the rest of the line
        # They should be: cost_basis, proceeds, pnl, fees
        values = _extract_all_currency_values(after_isin)

        cost_basis = values[0] if len(values) > 0 else 0.0
        gross_proceeds = values[1] if len(values) > 1 else 0.0
        gross_pnl = values[2] if len(values) > 2 else 0.0
        fees = values[3] if len(values) > 3 else 0.0

        # Try to extract CZK values and rates from subsequent lines
        cost_basis_czk = 0.0
        gross_proceeds_czk = 0.0
        gross_pnl_czk = 0.0
        rate_buy = None
        rate_sell = None

        # Look at the next few lines for CZK data
        context = ""
        for j in range(idx, min(idx + 4, len(all_lines))):
            context += all_lines[j] + " "

        czk_values = _extract_czk_values(context)
        rates = _extract_rates(context)

        if len(czk_values) >= 3:
            cost_basis_czk = czk_values[0]
            gross_proceeds_czk = czk_values[1]
            gross_pnl_czk = czk_values[2]
            # PnL CZK should match the sign
            if gross_pnl < 0 and gross_pnl_czk > 0:
                gross_pnl_czk = -gross_pnl_czk
        elif len(czk_values) >= 2:
            cost_basis_czk = czk_values[0]
            gross_proceeds_czk = czk_values[1]

        if len(rates) >= 2:
            rate_buy = rates[0]
            rate_sell = rates[1]
        elif len(rates) == 1:
            rate_buy = rates[0]

        return {
            "date_acquired": date_acquired,
            "date_sold": date_sold,
            "symbol": symbol,
            "name": name,
            "isin": isin,
            "country": country,
            "quantity": quantity,
            "cost_basis": abs(cost_basis),
            "gross_proceeds": abs(gross_proceeds),
            "gross_pnl": gross_pnl,
            "fees": abs(fees),
            "cost_basis_czk": cost_basis_czk,
            "gross_proceeds_czk": gross_proceeds_czk,
            "gross_pnl_czk": gross_pnl_czk,
            "rate_buy": rate_buy,
            "rate_sell": rate_sell,
        }

    def _parse_dividend_row(self, line: str) -> dict | None:
        """Parse a dividend/other income row.

        Raw text format examples:
          2025-12-11 MSFT Microsoft dividend US5949181045 US US$9.03 US$1.35 US$7.68
          2025-12-16 EXW1 iShares EURO STOXX 50 ETF (Dist) dividend DE0005933956 DE €0.15 - €0.15

        Before ISIN we have: "TICKER CompanyName [dividend|...]"
        First word = ticker symbol, trailing "dividend" = income type.
        """
        date_match = DIVIDEND_DATE_RE.match(line)
        if not date_match:
            return None

        date_str = date_match.group(1)
        rest = line[date_match.end():].strip()

        # Parse: Ticker CompanyName [type]  ISIN  Country  GrossAmount  Tax  NetAmount
        isin_match = re.search(r"([A-Z]{2}[\w\d]{8,12})\s+(\w{2})\s+", rest)
        if not isin_match:
            return None

        before_isin = rest[:isin_match.start()].strip()

        # First word is the ticker symbol (e.g. MSFT, SONY, EXW1)
        parts = before_isin.split(None, 1)
        ticker = parts[0] if parts else ""
        name_and_type = parts[1].strip() if len(parts) > 1 else ""

        # Strip trailing "dividend" / "custody fee" etc. to get clean company name
        description = ""
        if name_and_type:
            # Remove known trailing income-type words
            cleaned = re.sub(r"\s+(dividend|custody fee|interest|other)\s*$", "", name_and_type, flags=re.IGNORECASE)
            if cleaned != name_and_type:
                description = name_and_type[len(cleaned):].strip()
            security_name = cleaned if cleaned else name_and_type
        else:
            security_name = ticker

        isin = isin_match.group(1)
        country = isin_match.group(2)
        after = rest[isin_match.end():].strip()

        values = _extract_all_currency_values(after)
        gross_amount = values[0] if len(values) > 0 else 0.0
        withholding_tax = values[1] if len(values) > 1 else 0.0
        net_amount = values[2] if len(values) > 2 else 0.0

        return {
            "date": date_str,
            "ticker": ticker,
            "security_name": security_name,
            "description": description or "dividend",
            "isin": isin,
            "country": country,
            "gross_amount": gross_amount,
            "withholding_tax": withholding_tax,
            "net_amount": net_amount,
        }
