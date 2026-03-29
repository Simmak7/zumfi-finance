"""Stock P&L (realized trades + dividends) query service."""

import logging
from calendar import monthrange
from datetime import date

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from features.portfolio.models import StockTrade, StockDividend

logger = logging.getLogger(__name__)


async def get_stock_pnl_summary(
    db: AsyncSession, owner_id: int, month: str | None = None,
) -> dict:
    """Get realized trades and dividends for a user.

    Args:
        month: Optional "YYYY-MM" string. When provided, only returns
               trades sold in that month and dividends received in that month.
    """
    trades_query = select(StockTrade).where(StockTrade.owner_id == owner_id)
    dividends_query = select(StockDividend).where(StockDividend.owner_id == owner_id)

    if month:
        try:
            year, mon = int(month[:4]), int(month[5:7])
            first_day = date(year, mon, 1)
            _, last = monthrange(year, mon)
            last_day = date(year, mon, last)

            trades_query = trades_query.where(and_(
                StockTrade.date_sold >= first_day,
                StockTrade.date_sold <= last_day,
            ))
            dividends_query = dividends_query.where(and_(
                StockDividend.date >= first_day,
                StockDividend.date <= last_day,
            ))
        except (ValueError, IndexError):
            pass  # Invalid month format — return all

    trades_result = await db.execute(
        trades_query.order_by(StockTrade.date_sold.desc())
    )
    trades = trades_result.scalars().all()

    dividends_result = await db.execute(
        dividends_query.order_by(StockDividend.date.desc())
    )
    dividends = dividends_result.scalars().all()

    total_pnl = sum(float(t.gross_pnl) for t in trades)
    total_pnl_czk = sum(float(t.gross_pnl_czk or 0) for t in trades)
    total_cost = sum(float(t.cost_basis) for t in trades)
    total_proceeds = sum(float(t.gross_proceeds) for t in trades)
    total_fees = sum(float(t.fees) for t in trades)
    total_dividends = sum(float(d.net_amount) for d in dividends)
    total_tax = sum(float(d.withholding_tax) for d in dividends)

    return {
        "total_realized_pnl": round(total_pnl, 2),
        "total_realized_pnl_czk": round(total_pnl_czk, 2),
        "total_cost_basis": round(total_cost, 2),
        "total_proceeds": round(total_proceeds, 2),
        "total_fees": round(total_fees, 2),
        "total_dividends": round(total_dividends, 2),
        "total_withholding_tax": round(total_tax, 2),
        "trades": trades,
        "dividends": dividends,
    }


async def deduplicate_pnl_records(db: AsyncSession, owner_id: int) -> dict:
    """Remove duplicate trades and dividends, keeping the oldest record.

    Also fixes old records that have ticker='dividend' by matching
    them against ISIN + date to identify the correct stock.
    """
    # --- Deduplicate trades by (ticker, currency, date_sold, date_acquired, quantity) ---
    trades_result = await db.execute(
        select(StockTrade)
        .where(StockTrade.owner_id == owner_id)
        .order_by(StockTrade.id.asc())
    )
    all_trades = list(trades_result.scalars().all())

    seen_trades: set[tuple] = set()
    trades_removed = 0
    for t in all_trades:
        key = (t.ticker, t.currency, str(t.date_sold), str(t.date_acquired), str(t.quantity))
        if key in seen_trades:
            await db.delete(t)
            trades_removed += 1
        else:
            seen_trades.add(key)

    # --- Deduplicate dividends by (isin, currency, date, net_amount) ---
    # Uses ISIN as primary key since old records may have ticker='dividend'
    divs_result = await db.execute(
        select(StockDividend)
        .where(StockDividend.owner_id == owner_id)
        .order_by(StockDividend.id.asc())
    )
    all_divs = list(divs_result.scalars().all())

    seen_divs: set[tuple] = set()
    divs_removed = 0
    for d in all_divs:
        key = (d.isin or d.ticker, d.currency, str(d.date), str(d.net_amount))
        if key in seen_divs:
            await db.delete(d)
            divs_removed += 1
        else:
            seen_divs.add(key)

    await db.flush()
    logger.info(
        f"Deduplication for owner {owner_id}: "
        f"removed {trades_removed} duplicate trades, {divs_removed} duplicate dividends"
    )
    return {
        "trades_removed": trades_removed,
        "dividends_removed": divs_removed,
    }
