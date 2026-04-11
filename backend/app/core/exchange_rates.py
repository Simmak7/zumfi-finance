"""Exchange rate infrastructure using Czech National Bank (CNB) daily rates.

Provides currency conversion to CZK with in-memory + DB caching.
Rates are fetched from CNB at most once per day.
"""

import logging
from datetime import date, datetime, timezone
from decimal import Decimal

import httpx
from sqlalchemy import Column, Integer, String, Numeric, Date, DateTime, Index, UniqueConstraint, select, func
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import Base

logger = logging.getLogger(__name__)

CNB_URL = (
    "https://www.cnb.cz/en/financial-markets/foreign-exchange-market/"
    "central-bank-exchange-rate-fixing/central-bank-exchange-rate-fixing/daily.txt"
)
# Secondary CNB feed for currencies not in the daily fix (UAH, GEL, etc.)
CNB_OTHER_URL = (
    "https://www.cnb.cz/cs/financni-trhy/devizovy-trh/"
    "kurzy-ostatnich-men/kurzy-ostatnich-men/kurzy.txt"
)

# In-memory cache: refreshed once per day
_cache: dict = {"date": None, "rates": {}}


class ExchangeRate(Base):
    __tablename__ = "exchange_rates"

    id = Column(Integer, primary_key=True, index=True)
    rate_date = Column(Date, nullable=False)
    currency_code = Column(String(3), nullable=False)
    rate_to_czk = Column(Numeric(12, 6), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("rate_date", "currency_code", name="uq_exchange_rate_date_code"),
        Index("idx_exchange_rates_date", "rate_date"),
    )


def _parse_cnb_text(text: str) -> tuple[date | None, dict[str, float]]:
    """Parse CNB daily.txt format into a date and rates dict.

    Format:
        13 Feb 2026 #31
        Country|Currency|Amount|Code|Rate
        Australia|dollar|1|AUD|15.432
        ...
    """
    lines = text.strip().split("\n")
    if len(lines) < 3:
        return None, {}

    # Parse date from first line: "13 Feb 2026 #31"
    rate_date = None
    try:
        date_part = lines[0].split("#")[0].strip()
        rate_date = datetime.strptime(date_part, "%d %b %Y").date()
    except (ValueError, IndexError):
        logger.warning(f"Could not parse CNB date from: {lines[0]}")

    rates = {}
    for line in lines[2:]:  # skip header rows
        parts = line.strip().split("|")
        if len(parts) != 5:
            continue
        try:
            amount = int(parts[2])
            code = parts[3].strip()
            rate = float(parts[4].replace(",", "."))
            # rate_to_czk = rate per 1 unit of foreign currency
            rates[code] = rate / amount if amount > 0 else rate
        except (ValueError, IndexError):
            continue

    return rate_date, rates


async def _fetch_from_cnb() -> tuple[date | None, dict[str, float]]:
    """Fetch today's rates from CNB (daily + other currencies)."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(CNB_URL)
            resp.raise_for_status()
            rate_date, rates = _parse_cnb_text(resp.text)

            # Supplement with "other currencies" (UAH, GEL, etc.)
            try:
                resp2 = await client.get(CNB_OTHER_URL)
                resp2.raise_for_status()
                _, other_rates = _parse_cnb_text(resp2.text)
                for code, val in other_rates.items():
                    if code not in rates:
                        rates[code] = val
            except Exception as e2:
                logger.debug(f"CNB other currencies unavailable: {e2}")

            return rate_date, rates
    except Exception as e:
        logger.warning(f"Failed to fetch CNB rates: {e}")
        return None, {}


async def _load_from_db(db: AsyncSession, target_date: date | None = None) -> dict[str, float]:
    """Load rates from DB for the given date, or the most recent available."""
    if target_date:
        result = await db.execute(
            select(ExchangeRate).where(ExchangeRate.rate_date == target_date)
        )
    else:
        # Get the most recent date
        latest = await db.execute(select(func.max(ExchangeRate.rate_date)))
        max_date = latest.scalar()
        if not max_date:
            return {}
        result = await db.execute(
            select(ExchangeRate).where(ExchangeRate.rate_date == max_date)
        )

    rates = {}
    for row in result.scalars().all():
        rates[row.currency_code] = float(row.rate_to_czk)
    return rates


async def _store_in_db(db: AsyncSession, rate_date: date, rates: dict[str, float]):
    """Store rates in DB, upserting by (date, code)."""
    for code, rate in rates.items():
        existing = await db.execute(
            select(ExchangeRate).where(
                ExchangeRate.rate_date == rate_date,
                ExchangeRate.currency_code == code,
            )
        )
        row = existing.scalar_one_or_none()
        if row:
            row.rate_to_czk = Decimal(str(round(rate, 6)))
        else:
            db.add(ExchangeRate(
                rate_date=rate_date,
                currency_code=code,
                rate_to_czk=Decimal(str(round(rate, 6))),
            ))
    await db.flush()


async def get_exchange_rates(db: AsyncSession) -> dict[str, float]:
    """Get current exchange rates (CZK per 1 unit of foreign currency).

    Returns dict like {"USD": 23.45, "EUR": 25.12, ...}.
    Uses 3-tier caching: in-memory → DB → CNB fetch.
    """
    today = date.today()

    # 1. In-memory cache
    if _cache["date"] == today and _cache["rates"]:
        return _cache["rates"]

    # 2. Check DB for today
    db_rates = await _load_from_db(db, today)
    if db_rates:
        _cache["date"] = today
        _cache["rates"] = db_rates
        return db_rates

    # 3. Fetch from CNB
    rate_date, cnb_rates = await _fetch_from_cnb()
    if cnb_rates:
        store_date = rate_date or today
        await _store_in_db(db, store_date, cnb_rates)
        _cache["date"] = today
        _cache["rates"] = cnb_rates
        return cnb_rates

    # 4. Fallback: most recent DB rates
    fallback = await _load_from_db(db, None)
    if fallback:
        _cache["date"] = today
        _cache["rates"] = fallback
        return fallback

    logger.error("No exchange rates available from any source")
    return {}


async def get_rates_for_month(db: AsyncSession, year_month: str) -> dict[str, float]:
    """Get average exchange rates for a given month (YYYY-MM).

    Computes the average of all daily rates stored for that month.
    - Past months: the average is naturally locked (no new daily rates added).
    - Current month: running average of all days stored so far.

    Falls back to the most recent single-day rates before the month
    if no daily rates exist for the requested month (e.g. months before
    the app started collecting rates).
    """
    today = date.today()
    current_month = f"{today.year}-{today.month:02d}"

    # For the current month, ensure today's rate is stored first
    if year_month >= current_month:
        await get_exchange_rates(db)

    # Parse month boundaries
    parts = year_month.split("-")
    year, month = int(parts[0]), int(parts[1])
    first_day = date(year, month, 1)
    next_month_first = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)

    # Compute average rates across all days stored for this month
    result = await db.execute(
        select(
            ExchangeRate.currency_code,
            func.avg(ExchangeRate.rate_to_czk),
        ).where(
            ExchangeRate.rate_date >= first_day,
            ExchangeRate.rate_date < next_month_first,
        ).group_by(ExchangeRate.currency_code)
    )

    rates = {}
    for row in result:
        rates[row[0]] = round(float(row[1]), 6)

    if rates:
        return rates

    # Fallback: no rates for this month — use the most recent day before it
    latest = await db.execute(
        select(func.max(ExchangeRate.rate_date)).where(
            ExchangeRate.rate_date < first_day
        )
    )
    max_date = latest.scalar()
    if max_date:
        return await _load_from_db(db, max_date)

    # Last resort: fetch current rates
    return await get_exchange_rates(db)


async def convert_to_preferred(
    amount: float, from_currency: str, preferred_currency: str, db: AsyncSession
) -> float:
    """Convert amount from one currency to the user's preferred currency."""
    if from_currency == preferred_currency:
        return amount

    rates = await get_exchange_rates(db)
    return convert_amount(amount, from_currency, preferred_currency, rates)


def convert_amount(
    amount: float, from_currency: str, to_currency: str,
    rates: dict[str, float],
) -> float:
    """Convert amount between currencies using CZK-based rates.

    Rates dict maps currency code → CZK value (e.g. EUR → 25.5 means 1 EUR = 25.5 CZK).
    Handles all directions: CZK→foreign, foreign→CZK, foreign→foreign.
    """
    if from_currency == to_currency:
        return amount

    # CZK → foreign: divide by target rate
    if from_currency == "CZK":
        to_rate = rates.get(to_currency)
        return round(amount / to_rate, 2) if to_rate and to_rate > 0 else amount

    # Foreign → CZK: multiply by source rate
    if to_currency == "CZK":
        from_rate = rates.get(from_currency)
        return round(amount * from_rate, 2) if from_rate else amount

    # Foreign → foreign: cross-rate via CZK
    from_rate = rates.get(from_currency)
    to_rate = rates.get(to_currency)
    if from_rate and to_rate and to_rate > 0:
        return round(amount * from_rate / to_rate, 2)

    return amount


async def ensure_daily_rates(db: AsyncSession) -> None:
    """Fetch and store today's exchange rates if not already present.

    Called on app startup so rates are stored once per day regardless
    of whether any user visits the portfolio page.
    """
    today = date.today()
    existing = await db.execute(
        select(func.count()).select_from(ExchangeRate).where(
            ExchangeRate.rate_date == today
        )
    )
    if existing.scalar() > 0:
        return  # already stored today

    rate_date, cnb_rates = await _fetch_from_cnb()
    if cnb_rates:
        store_date = rate_date or today
        await _store_in_db(db, store_date, cnb_rates)
        _cache["date"] = today
        _cache["rates"] = cnb_rates
        logger.info(f"Stored {len(cnb_rates)} exchange rates for {store_date}")
