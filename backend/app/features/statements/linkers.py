"""Portfolio linkers for statement processing.

Links parsed statement data to portfolio models:
- Savings statements → SavingsAccount + PortfolioSnapshot
- Stock statements → StockHolding + StockHoldingSnapshot + PortfolioSnapshot
- Stock P&L statements → StockTrade + StockDividend
"""

import logging
from calendar import monthrange
from collections import defaultdict
from datetime import date
from decimal import Decimal

from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from features.statements.models import Statement
from features.portfolio.models import (
    SavingsAccount, StockHolding, StockHoldingSnapshot,
    StockTrade, StockDividend,
)
from features.portfolio.service import PortfolioService

logger = logging.getLogger(__name__)

STOCK_COLORS = [
    "#0ea5e9", "#3b82f6", "#6366f1", "#a855f7",
    "#f59e0b", "#ef4444", "#10b981", "#64748b",
    "#0284c7", "#7c3aed", "#ec4899", "#14b8a6",
]


async def link_savings_account(
    db: AsyncSession,
    owner_id: int,
    bank_name: str | None,
    balance: Decimal,
    statement: Statement,
    *,
    currency: str | None = None,
    suggested_name: str | None = None,
    notes: str | None = None,
) -> bool:
    """Find or create a portfolio SavingsAccount and update its balance.

    Lookup strategy:
        - If `suggested_name` is provided (bank-specific parser extracted a
          product-typed name like "Fio Term Deposit (...8376)"), match on
          (institution, name) so multiple products at the same bank
          (regular savings + term deposit) stay as distinct accounts.
        - Otherwise fall back to matching by institution alone (backward
          compatible with banks that only expose a single savings product).

    Currency comes from the parser when available; we no longer hardcode CZK
    for banks whose savings/term-deposit accounts are in another currency
    (e.g. Fio SK term deposits in EUR).
    """
    if not bank_name:
        return False

    institution_lower = bank_name.lower()
    query = select(SavingsAccount).where(
        SavingsAccount.owner_id == owner_id,
        SavingsAccount.status == "active",
        func.lower(SavingsAccount.institution) == institution_lower,
    )
    if suggested_name:
        query = query.where(SavingsAccount.name == suggested_name)

    result = await db.execute(query)
    savings = result.scalar_one_or_none()

    if not savings:
        # Don't create a savings account if balance is zero — only create
        # when there is actual recorded data from a statement.
        if balance <= 0:
            logger.info(
                f"Skipping savings account creation for {bank_name}: "
                f"balance is {balance}"
            )
            return False
        bank_display = bank_name.capitalize()
        savings = SavingsAccount(
            owner_id=owner_id,
            name=suggested_name or f"{bank_display} Savings",
            institution=bank_name,
            balance=balance,
            currency=(currency or "CZK"),
            notes=notes,
        )
        db.add(savings)
        await db.flush()
        await db.refresh(savings)
        is_newest = True
    else:
        latest_result = await db.execute(
            select(Statement).where(
                Statement.linked_savings_id == savings.id,
                Statement.period_end.isnot(None),
            ).order_by(Statement.period_end.desc()).limit(1)
        )
        latest = latest_result.scalar_one_or_none()
        is_newest = not latest or (
            statement.period_end and statement.period_end >= latest.period_end
        )
        if is_newest:
            savings.balance = balance
            # Keep currency + notes in sync with the most recent statement,
            # but never overwrite a currency the user may have set manually
            # before the bank-specific extractor existed.
            if currency and (not savings.currency or savings.currency == "CZK"):
                savings.currency = currency
            if notes and not savings.notes:
                savings.notes = notes

    statement.linked_savings_id = savings.id
    await db.flush()

    # Create snapshot for the statement's month only (not today)
    snapshot_date = statement.period_end or date.today()
    await PortfolioService.record_snapshot_for_date(db, owner_id, snapshot_date)

    return True


def _build_monthly_cost_basis(
    transactions: list[dict],
) -> dict[str, dict]:
    """Replay transactions chronologically using average cost method.

    Args:
        transactions: Sorted list of {date, ticker, type, quantity, price, value, fees}

    Returns:
        Dict mapping "YYYY-MM" → {"shares": Decimal, "total_invested": Decimal}
        representing cumulative state at end of each month with activity.
    """
    current_shares = Decimal("0")
    current_cost = Decimal("0")
    monthly = {}

    for txn in transactions:
        qty = Decimal(str(txn["quantity"]))
        value = Decimal(str(txn["value"]))
        fees = Decimal(str(txn["fees"]))
        month_str = f"{txn['date'].year}-{txn['date'].month:02d}"

        if txn["type"] == "BUY":
            current_cost += value + fees
            current_shares += qty

        elif txn["type"] == "SELL":
            if current_shares > Decimal("0.0001"):
                avg_cost_per_share = current_cost / current_shares
                cost_to_remove = avg_cost_per_share * qty
                current_cost -= cost_to_remove
                current_shares -= qty
            if current_shares < Decimal("0.0001"):
                current_shares = Decimal("0")
                current_cost = Decimal("0")

        elif txn["type"] == "SPLIT":
            # quantity is the change in shares (positive=add, negative=remove)
            current_shares += qty
            if current_shares < Decimal("0.0001"):
                current_shares = Decimal("0")
                current_cost = Decimal("0")

        # Record state for this month (overwritten if multiple txns in same month)
        monthly[month_str] = {
            "shares": current_shares,
            "total_invested": current_cost,
        }

    return monthly


async def _forward_fill_invested(
    db: AsyncSession,
    owner_id: int,
    ticker: str,
    currency: str,
):
    """Forward-fill total_invested into snapshots that lack it.

    Uses all existing snapshots with total_invested as source data,
    and fills gaps by carrying forward the last known value.
    This works regardless of statement processing order.
    """
    # Get ALL snapshots for this ticker, ordered by month
    result = await db.execute(
        select(StockHoldingSnapshot).where(
            StockHoldingSnapshot.owner_id == owner_id,
            StockHoldingSnapshot.ticker == ticker,
            StockHoldingSnapshot.currency == currency,
        ).order_by(StockHoldingSnapshot.snapshot_month.asc())
    )
    snapshots = list(result.scalars().all())

    if not snapshots:
        return

    # Forward-fill: carry the last known total_invested forward
    last_known = None
    for snap in snapshots:
        if snap.total_invested is not None:
            last_known = snap.total_invested
        elif last_known is not None:
            snap.total_invested = last_known


async def link_stock_holdings(
    db: AsyncSession,
    owner_id: int,
    file_path: str,
    statement: Statement,
) -> int:
    """Parse a Revolut stock statement and upsert holdings + snapshots."""
    from features.statements.parsers.revolut_stocks import RevolutStockParser

    parser = RevolutStockParser()
    parsed = parser.parse(file_path)

    if parsed["period_start"]:
        statement.period_start = parsed["period_start"]
    if parsed["period_end"]:
        statement.period_end = parsed["period_end"]

    # Determine snapshot month for end-of-period holdings
    period_end = parsed["period_end"] or date.today()
    snap_month = f"{period_end.year}-{period_end.month:02d}"

    # Determine if this is a comprehensive multi-month statement (>3 months)
    # or a single-month statement with partial transaction data.
    period_start = parsed["period_start"]
    is_multi_month = (
        period_start and period_end
        and (period_end.year - period_start.year) * 12
        + (period_end.month - period_start.month) > 3
    )

    # For monthly statements: collect BUY transactions per ticker
    # to incrementally update existing cost basis (weighted average).
    monthly_buys: dict[str, list] = {}
    if not is_multi_month:
        for section in parsed["sections"]:
            for txn in section.get("transactions", []):
                if txn["type"] == "BUY":
                    monthly_buys.setdefault(txn["ticker"], []).append(txn)

    total_holdings = 0
    color_idx = 0

    for section in parsed["sections"]:
        currency = section["currency"]
        transactions = section.get("transactions", [])

        # Build per-ticker monthly cost basis from transactions
        ticker_monthly = {}
        if transactions and is_multi_month:
            # Group transactions by ticker
            by_ticker = defaultdict(list)
            for txn in transactions:
                by_ticker[txn["ticker"]].append(txn)

            for ticker, txns in by_ticker.items():
                # Sort by date
                txns.sort(key=lambda t: t["date"])
                ticker_monthly[ticker] = _build_monthly_cost_basis(txns)

        # Process end-of-period holdings (portfolio breakdown)
        for h in section["holdings"]:
            ticker = h["ticker"]

            # Get cost basis from transaction data if available
            monthly_data = ticker_monthly.get(ticker, {})
            final_cost = None
            avg_cost = None

            if monthly_data:
                # Get the latest month's cost basis
                sorted_months = sorted(monthly_data.keys())
                latest = monthly_data[sorted_months[-1]]

                # If transaction replay ends with ~0 shares but holdings
                # show non-zero, the stock was re-bought outside this
                # statement's transactions. Cost data is unreliable.
                replay_has_shares = latest["shares"] > Decimal("0.0001")
                holdings_has_shares = h["shares"] > 0.001

                if replay_has_shares:
                    final_cost = latest["total_invested"]
                    # Only use avg_cost if replay shares match holdings
                    # (within 5%), indicating comprehensive transaction data.
                    # Partial data (e.g. single-month statement) would give
                    # incorrect avg_cost.
                    replay_shares = float(latest["shares"])
                    holdings_shares = float(h["shares"])
                    shares_match = (
                        holdings_shares > 0.001
                        and abs(replay_shares - holdings_shares) / holdings_shares < 0.05
                    )
                    if shares_match:
                        avg_cost = final_cost / latest["shares"]
                    else:
                        logger.info(
                            f"  {ticker}: replay shares={replay_shares:.4f} vs "
                            f"holdings={holdings_shares:.4f} — skipping avg_cost"
                        )
                elif not holdings_has_shares:
                    # Both replay and holdings show 0 — fully sold
                    final_cost = Decimal("0")
                else:
                    # Replay=0 but holdings>0: re-bought outside this data
                    # Leave cost as None (unknown)
                    logger.info(
                        f"  {ticker}: replay ends at 0 shares but holdings "
                        f"show {h['shares']} — cost basis unknown"
                    )

            # For monthly statements: if this ticker had BUY transactions,
            # compute incremental cost basis from existing + new purchases.
            if not is_multi_month and ticker in monthly_buys and avg_cost is None:
                buys = monthly_buys[ticker]
                new_cost = sum(Decimal(str(b["value"])) + Decimal(str(b.get("fees", 0))) for b in buys)
                new_shares = sum(Decimal(str(b["quantity"])) for b in buys)

                # Check if there's an existing holding with cost data
                existing = await db.execute(
                    select(StockHolding).where(
                        StockHolding.owner_id == owner_id,
                        StockHolding.ticker == ticker,
                        StockHolding.currency == currency,
                    )
                )
                existing_holding = existing.scalar_one_or_none()
                old_avg = Decimal(str(existing_holding.avg_cost_per_share)) if existing_holding else Decimal("0")
                old_shares = Decimal(str(existing_holding.shares)) if existing_holding else Decimal("0")

                # Shares that existed before the buys in this statement
                pre_buy_shares = Decimal(str(h["shares"])) - new_shares
                if pre_buy_shares < 0:
                    pre_buy_shares = Decimal("0")

                old_cost = old_avg * pre_buy_shares if old_avg > 0 else Decimal("0")
                total_cost = old_cost + new_cost
                total_shares = Decimal(str(h["shares"]))

                if total_shares > Decimal("0.0001"):
                    avg_cost = total_cost / total_shares
                    final_cost = total_cost
                    logger.info(f"  {ticker}: incremental cost basis from {len(buys)} buys → avg_cost={avg_cost:.4f}")

            # Upsert stock holding
            stock = await _upsert_stock_holding(
                db, owner_id, h, currency,
                STOCK_COLORS[color_idx % len(STOCK_COLORS)],
                avg_cost=avg_cost,
            )
            color_idx += 1
            total_holdings += 1

            # Create end-of-period snapshot with market value + cost basis
            await _upsert_holding_snapshot(
                db, owner_id, h, currency, snap_month,
                total_invested=final_cost,
            )

            # Create historical monthly snapshots from transaction data
            # (without market value — we don't have month-end prices)
            if monthly_data:
                for month_str, state in monthly_data.items():
                    if month_str == snap_month:
                        continue  # Already created above with market data

                    hist_holding = {
                        "ticker": ticker,
                        "name": h["name"],
                        "isin": h.get("isin"),
                        "shares": float(state["shares"]),
                        "price": None,
                        "value": None,
                        "holding_type": h["holding_type"],
                    }
                    await _upsert_holding_snapshot(
                        db, owner_id, hist_holding, currency, month_str,
                        total_invested=state["total_invested"],
                    )

            # Forward-fill total_invested into snapshots that lack it
            await _forward_fill_invested(db, owner_id, ticker, currency)

        # Also process tickers that appear in transactions but NOT in holdings
        # (fully sold positions — create historical snapshots including 0-shares)
        holding_tickers = {h["ticker"] for h in section["holdings"]}
        for ticker, monthly_data in ticker_monthly.items():
            if ticker in holding_tickers:
                continue
            for month_str, state in monthly_data.items():
                hist_holding = {
                    "ticker": ticker,
                    "name": ticker,  # No name available for sold positions
                    "isin": None,
                    "shares": float(state["shares"]),
                    "price": None,
                    "value": None,
                    "holding_type": "stock",
                }
                await _upsert_holding_snapshot(
                    db, owner_id, hist_holding, currency, month_str,
                    total_invested=state["total_invested"],
                )

    await db.flush()

    # Mark stocks as "sold" if they were active but don't appear in this
    # statement's holdings. This catches stocks sold between statements.
    all_statement_tickers = set()
    for section in parsed["sections"]:
        for h in section["holdings"]:
            all_statement_tickers.add((h["ticker"], section["currency"]))

    active_result = await db.execute(
        select(StockHolding).where(
            StockHolding.owner_id == owner_id,
            StockHolding.status == "active",
            StockHolding.shares > Decimal("0.0001"),
        )
    )
    for holding in active_result.scalars().all():
        key = (holding.ticker, holding.currency)
        if key not in all_statement_tickers:
            # Stock was active but doesn't appear in the latest statement.
            # Only mark as sold if it had a snapshot in a previous month
            # (confirming it was previously tracked via Revolut).
            prev_snap = await db.execute(
                select(StockHoldingSnapshot).where(
                    StockHoldingSnapshot.owner_id == owner_id,
                    StockHoldingSnapshot.ticker == holding.ticker,
                    StockHoldingSnapshot.currency == holding.currency,
                    StockHoldingSnapshot.snapshot_month < snap_month,
                    StockHoldingSnapshot.shares > Decimal("0.0001"),
                ).limit(1)
            )
            if prev_snap.scalar_one_or_none():
                holding.status = "sold"
                holding.shares = Decimal("0")
                logger.info(
                    f"  {holding.ticker} ({holding.currency}): marked as sold "
                    f"(not in {snap_month} holdings)"
                )

    await db.flush()

    # Create portfolio snapshot for the statement's month
    parts = snap_month.split("-")
    snap_year, snap_mon = int(parts[0]), int(parts[1])
    _, last_day_num = monthrange(snap_year, snap_mon)
    snapshot_date = date(snap_year, snap_mon, last_day_num)
    await PortfolioService.record_snapshot_for_date(db, owner_id, snapshot_date)

    logger.info(
        f"Linked {total_holdings} stock holdings from statement {statement.id} "
        f"(month: {snap_month})"
    )
    return total_holdings


async def _upsert_stock_holding(
    db: AsyncSession,
    owner_id: int,
    holding: dict,
    currency: str,
    default_color: str,
    avg_cost: Decimal | None = None,
) -> StockHolding:
    """Find or create a stock holding, updating shares and price."""
    # Query without status filter to find existing records (active or sold)
    # so re-bought stocks reactivate instead of creating duplicates
    result = await db.execute(
        select(StockHolding).where(
            StockHolding.owner_id == owner_id,
            StockHolding.ticker == holding["ticker"],
            StockHolding.currency == currency,
        ).order_by(StockHolding.updated_at.desc()).limit(1)
    )
    stock = result.scalar_one_or_none()

    new_shares = Decimal(str(holding["shares"]))
    is_sold = new_shares < Decimal("0.0001")

    if stock:
        stock.shares = new_shares
        stock.current_price = Decimal(str(holding["price"])) if holding["price"] else None
        stock.name = holding["name"]
        stock.isin = holding.get("isin")
        stock.holding_type = holding["holding_type"]
        stock.status = "sold" if is_sold else "active"
        if avg_cost is not None and avg_cost > 0:
            stock.avg_cost_per_share = Decimal(str(round(float(avg_cost), 8)))
    else:
        computed_avg = Decimal("0")
        if avg_cost is not None and avg_cost > 0:
            computed_avg = Decimal(str(round(float(avg_cost), 8)))
        stock = StockHolding(
            owner_id=owner_id,
            name=holding["name"],
            ticker=holding["ticker"],
            isin=holding.get("isin"),
            holding_type=holding["holding_type"],
            shares=new_shares,
            avg_cost_per_share=computed_avg,
            current_price=Decimal(str(holding["price"])) if holding["price"] else None,
            currency=currency,
            color=default_color,
            status="sold" if is_sold else "active",
        )
        db.add(stock)

    await db.flush()
    return stock


async def link_stock_pnl(
    db: AsyncSession,
    owner_id: int,
    file_path: str,
    statement: Statement,
) -> int:
    """Parse a Revolut P&L statement and save trades + dividends."""
    from features.statements.parsers.revolut_pnl import RevolutPnlParser

    parser = RevolutPnlParser()
    parsed = parser.parse(file_path)

    if parsed["period_start"]:
        statement.period_start = parsed["period_start"]
    if parsed["period_end"]:
        statement.period_end = parsed["period_end"]

    total_items = 0

    for section in parsed["sections"]:
        currency = section["currency"]

        for sell in section["sells"]:
            # Deduplicate: check if identical trade already exists
            existing = await db.execute(
                select(StockTrade).where(
                    StockTrade.owner_id == owner_id,
                    StockTrade.ticker == sell["symbol"],
                    StockTrade.currency == currency,
                    StockTrade.date_sold == _parse_date_str(sell["date_sold"]),
                    StockTrade.date_acquired == _parse_date_str(sell["date_acquired"]),
                    StockTrade.quantity == Decimal(str(sell["quantity"])),
                )
            )
            if existing.scalar_one_or_none():
                continue

            trade = StockTrade(
                owner_id=owner_id,
                statement_id=statement.id,
                ticker=sell["symbol"],
                name=sell["name"],
                isin=sell.get("isin"),
                country=sell.get("country"),
                currency=currency,
                date_acquired=_parse_date_str(sell["date_acquired"]),
                date_sold=_parse_date_str(sell["date_sold"]),
                quantity=Decimal(str(sell["quantity"])),
                cost_basis=Decimal(str(sell["cost_basis"])),
                gross_proceeds=Decimal(str(sell["gross_proceeds"])),
                gross_pnl=Decimal(str(sell["gross_pnl"])),
                fees=Decimal(str(sell["fees"])),
                cost_basis_czk=Decimal(str(sell["cost_basis_czk"])) if sell.get("cost_basis_czk") else None,
                gross_proceeds_czk=Decimal(str(sell["gross_proceeds_czk"])) if sell.get("gross_proceeds_czk") else None,
                gross_pnl_czk=Decimal(str(sell["gross_pnl_czk"])) if sell.get("gross_pnl_czk") else None,
                rate_buy=Decimal(str(sell["rate_buy"])) if sell.get("rate_buy") else None,
                rate_sell=Decimal(str(sell["rate_sell"])) if sell.get("rate_sell") else None,
            )
            try:
                async with db.begin_nested():
                    db.add(trade)
                    await db.flush()
                total_items += 1
            except IntegrityError:
                logger.info(f"Skipped duplicate trade: {sell['symbol']} sold {sell['date_sold']}")
                continue

        for div in section["dividends"]:
            # Deduplicate: check if identical dividend already exists
            div_date = _parse_date_str(div["date"]) if div.get("date") else None
            div_ticker = div.get("ticker") or div.get("security_name")
            div_name = div.get("security_name") or div_ticker
            existing_div = await db.execute(
                select(StockDividend).where(
                    StockDividend.owner_id == owner_id,
                    StockDividend.currency == currency,
                    StockDividend.date == div_date,
                    StockDividend.net_amount == Decimal(str(div["net_amount"])),
                    StockDividend.isin == div.get("isin"),
                )
            )
            if existing_div.scalar_one_or_none():
                continue

            dividend = StockDividend(
                owner_id=owner_id,
                statement_id=statement.id,
                ticker=div_ticker,
                name=div_name,
                isin=div.get("isin"),
                country=div.get("country"),
                currency=currency,
                date=div_date,
                description=div.get("description"),
                gross_amount=Decimal(str(div["gross_amount"])),
                withholding_tax=Decimal(str(div["withholding_tax"])),
                net_amount=Decimal(str(div["net_amount"])),
            )
            try:
                async with db.begin_nested():
                    db.add(dividend)
                    await db.flush()
                total_items += 1
            except IntegrityError:
                logger.info(f"Skipped duplicate dividend: {div_ticker} on {div_date}")
                continue

    await db.flush()

    logger.info(
        f"Linked {total_items} P&L items from statement {statement.id}"
    )
    return total_items


def _parse_date_str(date_str: str):
    """Parse YYYY-MM-DD date string."""
    if not date_str:
        return None
    from datetime import datetime
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        return None


async def _upsert_holding_snapshot(
    db: AsyncSession,
    owner_id: int,
    holding: dict,
    currency: str,
    snapshot_month: str,
    total_invested: Decimal | None = None,
) -> StockHoldingSnapshot:
    """Create or update a per-holding monthly snapshot."""
    result = await db.execute(
        select(StockHoldingSnapshot).where(
            StockHoldingSnapshot.owner_id == owner_id,
            StockHoldingSnapshot.ticker == holding["ticker"],
            StockHoldingSnapshot.currency == currency,
            StockHoldingSnapshot.snapshot_month == snapshot_month,
        )
    )
    snap = result.scalar_one_or_none()

    market_value = round(holding["value"], 2) if holding.get("value") is not None else None
    price_val = Decimal(str(holding["price"])) if holding.get("price") is not None else None
    invested_val = None
    if total_invested is not None:
        invested_val = Decimal(str(round(float(total_invested), 2)))

    if snap:
        snap.shares = Decimal(str(holding["shares"]))
        if price_val is not None:
            snap.price = price_val
        if market_value is not None:
            snap.market_value = Decimal(str(market_value))
        snap.name = holding["name"]
        snap.holding_type = holding["holding_type"]
        if invested_val is not None:
            snap.total_invested = invested_val
    else:
        snap = StockHoldingSnapshot(
            owner_id=owner_id,
            ticker=holding["ticker"],
            currency=currency,
            snapshot_month=snapshot_month,
            name=holding["name"],
            holding_type=holding["holding_type"],
            shares=Decimal(str(holding["shares"])),
            price=price_val,
            market_value=Decimal(str(market_value)) if market_value is not None else None,
            total_invested=invested_val,
        )
        db.add(snap)

    return snap
