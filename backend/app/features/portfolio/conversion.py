"""Stock portfolio currency conversion helpers.

Provides per-currency breakdown and historical converted totals
for the stock breakdown modal.
"""

from decimal import Decimal
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.exchange_rates import get_rates_for_month
from features.portfolio.models import StockHoldingSnapshot
from features.portfolio.service import PortfolioService


async def get_stock_currency_breakdown(
    db: AsyncSession, owner_id: int,
    preferred_currency: str = "CZK", month: str | None = None,
) -> dict:
    """Compute per-currency stock value breakdown with conversion.

    When month is provided, uses snapshot data and that month's exchange rates.
    When month is None or current month, uses live stock data and fresh rates.
    """
    today = date.today()
    current_month = f"{today.year}-{today.month:02d}"
    is_current = month is None or month == current_month

    if is_current:
        # Live data + current month's average rates
        stocks = await PortfolioService.get_all_stocks(db, owner_id)
        rates = await get_rates_for_month(db, current_month)
        rates_label = f"{current_month} (avg)"

        value_by_currency: dict[str, float] = {}
        cost_by_currency: dict[str, float] = {}
        for stock in stocks:
            metrics = PortfolioService.compute_stock_metrics(stock)
            value = float(metrics["market_value"] or metrics["total_cost"] or 0)
            cost = float(metrics["total_cost"] or 0)
            currency = stock.currency
            value_by_currency[currency] = value_by_currency.get(currency, 0.0) + value
            cost_by_currency[currency] = cost_by_currency.get(currency, 0.0) + cost
    else:
        # Historical: use EXACT-month snapshots only (no carry-forward)
        # — missing stocks might already be sold.
        result = await db.execute(
            select(StockHoldingSnapshot).where(
                StockHoldingSnapshot.owner_id == owner_id,
                StockHoldingSnapshot.snapshot_month == month,
                StockHoldingSnapshot.shares > Decimal("0.0001"),
            )
        )
        snaps = list(result.scalars().all())
        rates = await get_rates_for_month(db, month)
        rates_label = f"{month} (avg)"

        value_by_currency = {}
        cost_by_currency = {}
        for snap in snaps:
            currency = snap.currency
            mv = float(snap.market_value) if snap.market_value is not None else None
            ti = float(snap.total_invested) if snap.total_invested is not None else 0
            value = mv if mv is not None else ti
            cost = ti
            value_by_currency[currency] = value_by_currency.get(currency, 0.0) + value
            cost_by_currency[currency] = cost_by_currency.get(currency, 0.0) + cost

    # Convert each bucket to preferred currency
    breakdown = []
    total_converted = 0.0
    total_cost_converted = 0.0

    for currency in sorted(value_by_currency):
        amount = value_by_currency[currency]
        cost = cost_by_currency.get(currency, 0.0)
        rate, converted = _convert_amount(amount, currency, preferred_currency, rates)
        _, cost_conv = _convert_amount(cost, currency, preferred_currency, rates)
        total_converted += converted
        total_cost_converted += cost_conv
        breakdown.append({
            "currency": currency,
            "original_amount": round(amount, 2),
            "exchange_rate": rate,
            "converted_amount": round(converted, 2),
        })

    return {
        "total_converted": round(total_converted, 2),
        "total_cost_converted": round(total_cost_converted, 2),
        "preferred_currency": preferred_currency,
        "currency_breakdown": breakdown,
        "rates_date": rates_label,
    }


async def get_stock_history_converted(
    db: AsyncSession, owner_id: int,
    preferred_currency: str = "CZK", months: int = 12
) -> list[dict]:
    """Get per-month total stock value converted to preferred currency.

    Uses EXACT-month snapshots only (no carry-forward) so values match
    get_stock_currency_breakdown(). Missing stocks might already be sold.
    Each month uses its own historical exchange rates.
    """
    today = date.today()

    # Build list of target months
    target_months = []
    for i in range(months - 1, -1, -1):
        y = today.year
        m = today.month - i
        while m <= 0:
            m += 12
            y -= 1
        target_months.append(f"{y}-{m:02d}")

    if not target_months:
        return []

    # Fetch all snapshots for the target months in one query
    all_snaps_result = await db.execute(
        select(StockHoldingSnapshot).where(
            StockHoldingSnapshot.owner_id == owner_id,
            StockHoldingSnapshot.snapshot_month.in_(target_months),
            StockHoldingSnapshot.shares > Decimal("0.0001"),
        )
    )
    all_snaps = list(all_snaps_result.scalars().all())

    # Group snapshots by month
    by_month: dict[str, list] = {m: [] for m in target_months}
    for s in all_snaps:
        if s.snapshot_month in by_month:
            by_month[s.snapshot_month].append(s)

    result = []
    for month_str in target_months:
        snaps = by_month[month_str]
        rates = await get_rates_for_month(db, month_str)
        total = 0.0
        for snap in snaps:
            mv = float(snap.market_value) if snap.market_value is not None else None
            ti = float(snap.total_invested) if snap.total_invested is not None else 0
            val = mv if mv is not None else ti
            currency = snap.currency
            _, converted = _convert_amount(val, currency, preferred_currency, rates)
            total += converted
        result.append({
            "month": month_str,
            "total_converted": round(total, 2),
        })
    return result


def _convert_amount(
    amount: float, from_currency: str,
    preferred_currency: str, rates: dict[str, float]
) -> tuple[float | None, float]:
    """Convert amount and return (rate_used, converted_amount)."""
    if from_currency == preferred_currency:
        return None, amount

    if preferred_currency == "CZK":
        rate = rates.get(from_currency)
        if rate:
            return round(rate, 4), round(amount * rate, 2)
        return None, amount

    # Cross-rate: from → CZK → preferred
    from_rate = rates.get(from_currency)
    to_rate = rates.get(preferred_currency)
    if from_rate and to_rate and to_rate > 0:
        cross = from_rate / to_rate
        return round(cross, 4), round(amount * cross, 2)

    return None, amount
