from datetime import date
from calendar import monthrange

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.auth import get_current_user
from features.auth.models import User
from features.portfolio.schemas import (
    SavingsAccountCreate, SavingsAccountUpdate, SavingsAccountResponse,
    InvestmentCreate, InvestmentUpdate, InvestmentResponse,
    StockHoldingCreate, StockHoldingUpdate, StockHoldingResponse,
    PropertyCreate, PropertyUpdate, PropertyResponse,
    PortfolioSummary, StockBreakdownResponse, StockPnlSummary,
)
from features.portfolio.service import PortfolioService
from features.portfolio.conversion import get_stock_currency_breakdown, get_stock_history_converted
from features.portfolio.pnl_service import get_stock_pnl_summary
from features.portfolio.property_service import (
    PropertyService, compute_property_metrics, BASE_PRICES, get_country_average,
)

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


# ── Summary ──

@router.get("/summary", response_model=PortfolioSummary)
async def get_portfolio_summary(
    month: str | None = Query(default=None, description="YYYY-MM format"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get portfolio overview. Pass month=YYYY-MM for historical snapshot."""
    preferred = user.preferred_currency or "CZK"
    return await PortfolioService.get_summary(
        db, owner_id=user.id, month=month, preferred_currency=preferred,
    )


# ── Savings History ──

@router.get("/savings-history")
async def get_savings_history(
    months: int = Query(default=12, ge=1, le=36),
    end_month: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}$"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get monthly savings totals for chart display."""
    return await PortfolioService.get_savings_history(
        db, owner_id=user.id, months=months, end_month=end_month,
    )


# ── Portfolio History (total portfolio development) ──

@router.get("/portfolio-history")
async def get_portfolio_history(
    months: int = Query(default=12, ge=1, le=36),
    end_month: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}$"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get monthly total portfolio values for development chart."""
    preferred = user.preferred_currency or "CZK"
    return await PortfolioService.get_portfolio_history(
        db, owner_id=user.id, months=months, end_month=end_month,
        preferred_currency=preferred,
    )


# ── Stock Holdings History ──

@router.get("/stock-history")
async def get_stock_holdings_history(
    months: int = Query(default=12, ge=1, le=36),
    end_month: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}$"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get per-holding monthly snapshots for stock development chart."""
    return await PortfolioService.get_stock_holdings_history(
        db, owner_id=user.id, months=months, end_month=end_month,
    )


# ── Per-Stock Detail History ──

@router.get("/stocks/{ticker}/history")
async def get_stock_detail_history(
    ticker: str,
    currency: str = Query(..., description="Stock currency (USD/EUR)"),
    months: int = Query(default=60, ge=1, le=120),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get monthly history for a specific stock: invested vs market value."""
    history = await PortfolioService.get_stock_detail_history(
        db, owner_id=user.id, ticker=ticker, currency=currency, months=months,
    )
    return {"ticker": ticker, "currency": currency, "history": history}


# ── Stock Currency Breakdown ──

@router.get("/stock-breakdown", response_model=StockBreakdownResponse)
async def get_stock_breakdown(
    months: int = Query(default=12, ge=1, le=36),
    month: str | None = Query(default=None, description="YYYY-MM for historical breakdown"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get stock portfolio value by currency with conversion + monthly history."""
    preferred = user.preferred_currency or "CZK"
    breakdown = await get_stock_currency_breakdown(
        db, owner_id=user.id, preferred_currency=preferred, month=month,
    )
    history = await get_stock_history_converted(
        db, owner_id=user.id, preferred_currency=preferred, months=months,
    )
    return {**breakdown, "monthly_history": history}


# ── Stock Buys (from statement transactions) ──

@router.get("/stock-buys")
async def get_stock_buys(
    month: str | None = Query(default=None, description="YYYY-MM to filter by month"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get stock buy transactions extracted from uploaded stock statements."""
    from features.statements.models import Statement
    from features.statements.parsers.revolut_stocks import RevolutStockParser

    query = select(Statement).where(
        Statement.owner_id == user.id,
        Statement.statement_type == "stock",
    )
    if month:
        y, m = int(month[:4]), int(month[5:7])
        from calendar import monthrange
        first_day = date(y, m, 1)
        _, last = monthrange(y, m)
        last_day = date(y, m, last)
        query = query.where(
            Statement.period_start <= last_day,
            Statement.period_end >= first_day,
        )
    query = query.order_by(Statement.period_start)

    result = await db.execute(query)
    statements = result.scalars().all()

    buys = []
    seen = set()
    parser = RevolutStockParser()
    for stmt in statements:
        if not stmt.file_path:
            continue
        try:
            parsed = parser.parse(stmt.file_path)
        except Exception:
            continue
        for section in parsed.get("sections", []):
            currency = section.get("currency", "USD")
            for tx in section.get("transactions", []):
                if tx["type"] != "BUY":
                    continue
                tx_month = f"{tx['date'].year}-{tx['date'].month:02d}"
                if month and tx_month != month:
                    continue
                # Deduplicate by (ticker, date, quantity, price)
                key = (tx["ticker"], str(tx["date"]), round(float(tx["quantity"]), 4), round(float(tx["price"]), 2))
                if key in seen:
                    continue
                seen.add(key)
                buys.append({
                    "ticker": tx["ticker"],
                    "date": tx["date"].isoformat(),
                    "quantity": round(float(tx["quantity"]), 4),
                    "price": round(float(tx["price"]), 2),
                    "value": round(float(tx["value"]), 2),
                    "fees": round(float(tx.get("fees", 0)), 2),
                    "currency": currency,
                })

    total_invested = sum(b["value"] + b["fees"] for b in buys)
    return {"buys": buys, "total_invested": round(total_invested, 2)}


# ── Stock P&L (Realized Trades + Dividends) ──

@router.get("/stock-pnl", response_model=StockPnlSummary)
async def get_stock_pnl(
    month: str | None = Query(default=None, description="YYYY-MM to filter by month"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get realized stock trades and dividends from P&L statements."""
    preferred = user.preferred_currency or "CZK"
    return await get_stock_pnl_summary(db, owner_id=user.id, month=month, preferred_currency=preferred)


@router.get("/stock-pnl/history")
async def get_stock_pnl_history(
    months: int = Query(default=12, ge=1, le=24),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get monthly realized P&L totals for trend chart."""
    from features.portfolio.models import StockTrade, StockDividend
    from sqlalchemy import func, case

    today = date.today()
    target_months = []
    for i in range(months - 1, -1, -1):
        y, m = today.year, today.month - i
        while m <= 0:
            m += 12
            y -= 1
        target_months.append(f"{y}-{m:02d}")

    # Get monthly trade P&L
    trade_result = await db.execute(
        select(
            func.to_char(StockTrade.date_sold, 'YYYY-MM').label('month'),
            func.coalesce(func.sum(StockTrade.gross_pnl), 0).label('trade_pnl'),
            func.count(StockTrade.id).label('trade_count'),
        ).where(
            StockTrade.owner_id == user.id,
            StockTrade.date_sold.isnot(None),
        ).group_by('month')
    )
    trade_by_month = {r[0]: {'pnl': float(r[1]), 'count': int(r[2])} for r in trade_result}

    # Get monthly dividends
    div_result = await db.execute(
        select(
            func.to_char(StockDividend.date, 'YYYY-MM').label('month'),
            func.coalesce(func.sum(StockDividend.net_amount), 0).label('dividends'),
        ).where(
            StockDividend.owner_id == user.id,
        ).group_by('month')
    )
    div_by_month = {r[0]: float(r[1]) for r in div_result}

    history = []
    for m in target_months:
        trade_data = trade_by_month.get(m, {'pnl': 0, 'count': 0})
        dividends = div_by_month.get(m, 0)
        total = trade_data['pnl'] + dividends
        if trade_data['count'] > 0 or dividends > 0:
            history.append({
                'month': m,
                'trade_pnl': round(trade_data['pnl'], 2),
                'dividends': round(dividends, 2),
                'total': round(total, 2),
                'trade_count': trade_data['count'],
            })

    return {'history': history}


@router.post("/stock-pnl/deduplicate")
async def deduplicate_stock_pnl(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Remove duplicate stock trades and dividends."""
    from features.portfolio.pnl_service import deduplicate_pnl_records
    removed = await deduplicate_pnl_records(db, owner_id=user.id)
    return removed


# ── Recalculate Snapshots ──

@router.post("/recalculate-snapshots")
async def recalculate_snapshots(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Recalculate all portfolio snapshots using monthly average exchange rates."""
    updated = await PortfolioService.recalculate_all_snapshots(db)
    return {"updated": updated}


# ── Savings Accounts ──

@router.get("/savings", response_model=list[SavingsAccountResponse])
async def list_savings(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all active savings accounts."""
    return await PortfolioService.get_all_savings(db, owner_id=user.id)


@router.post("/savings", response_model=SavingsAccountResponse)
async def create_savings(
    request: SavingsAccountCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create a savings account."""
    account = await PortfolioService.create_savings(db, owner_id=user.id, **request.model_dump())
    await PortfolioService.record_current_snapshot(db, owner_id=user.id, preferred_currency=user.preferred_currency or "CZK")
    return account


@router.put("/savings/{account_id}", response_model=SavingsAccountResponse)
async def update_savings(
    account_id: int,
    request: SavingsAccountUpdate,
    month: str | None = Query(None, pattern=r"^\d{4}-\d{2}$"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update a savings account.

    When *month* (YYYY-MM) is provided the portfolio snapshot is
    recorded for that month instead of today.
    """
    account = await PortfolioService.update_savings(
        db, owner_id=user.id, account_id=account_id, **request.model_dump(exclude_unset=True)
    )
    if not account:
        raise HTTPException(status_code=404, detail="Savings account not found")
    target_date = None
    if month:
        y, m = int(month[:4]), int(month[5:7])
        _, last = monthrange(y, m)
        target_date = date(y, m, last)
    await PortfolioService.record_current_snapshot(
        db, owner_id=user.id,
        preferred_currency=user.preferred_currency or "CZK",
        target_date=target_date,
    )
    return account


@router.delete("/savings/{account_id}")
async def delete_savings(
    account_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete a savings account."""
    success = await PortfolioService.delete_savings(db, owner_id=user.id, account_id=account_id)
    if not success:
        raise HTTPException(status_code=404, detail="Savings account not found")
    await PortfolioService.record_current_snapshot(db, owner_id=user.id, preferred_currency=user.preferred_currency or "CZK")
    return {"success": True}


# ── Investments ──

@router.get("/investments", response_model=list[InvestmentResponse])
async def list_investments(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all active investments with computed metrics."""
    investments = await PortfolioService.get_all_investments(db, owner_id=user.id)
    result = []
    for inv in investments:
        metrics = PortfolioService.compute_investment_metrics(inv)
        result.append({
            **{c.name: getattr(inv, c.name) for c in inv.__table__.columns},
            **metrics,
        })
    return result


@router.post("/investments", response_model=InvestmentResponse)
async def create_investment(
    request: InvestmentCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create an investment."""
    inv = await PortfolioService.create_investment(db, owner_id=user.id, **request.model_dump())
    await PortfolioService.record_current_snapshot(db, owner_id=user.id, preferred_currency=user.preferred_currency or "CZK")
    metrics = PortfolioService.compute_investment_metrics(inv)
    return {
        **{c.name: getattr(inv, c.name) for c in inv.__table__.columns},
        **metrics,
    }


@router.put("/investments/{investment_id}", response_model=InvestmentResponse)
async def update_investment(
    investment_id: int,
    request: InvestmentUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update an investment."""
    inv = await PortfolioService.update_investment(
        db, owner_id=user.id, investment_id=investment_id, **request.model_dump(exclude_unset=True)
    )
    if not inv:
        raise HTTPException(status_code=404, detail="Investment not found")
    await PortfolioService.record_current_snapshot(db, owner_id=user.id, preferred_currency=user.preferred_currency or "CZK")
    metrics = PortfolioService.compute_investment_metrics(inv)
    return {
        **{c.name: getattr(inv, c.name) for c in inv.__table__.columns},
        **metrics,
    }


@router.delete("/investments/{investment_id}")
async def delete_investment(
    investment_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete an investment."""
    success = await PortfolioService.delete_investment(db, owner_id=user.id, investment_id=investment_id)
    if not success:
        raise HTTPException(status_code=404, detail="Investment not found")
    await PortfolioService.record_current_snapshot(db, owner_id=user.id, preferred_currency=user.preferred_currency or "CZK")
    return {"success": True}


# ── Stock Holdings ──

@router.get("/stocks", response_model=list[StockHoldingResponse])
async def list_stocks(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all active stock holdings with computed metrics."""
    stocks = await PortfolioService.get_all_stocks(db, owner_id=user.id)
    result = []
    for stock in stocks:
        metrics = PortfolioService.compute_stock_metrics(stock)
        result.append({
            **{c.name: getattr(stock, c.name) for c in stock.__table__.columns},
            **metrics,
        })
    return result


@router.post("/stocks", response_model=StockHoldingResponse)
async def create_stock(
    request: StockHoldingCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create a stock holding."""
    stock = await PortfolioService.create_stock(db, owner_id=user.id, **request.model_dump())
    await PortfolioService.record_current_snapshot(db, owner_id=user.id, preferred_currency=user.preferred_currency or "CZK")
    metrics = PortfolioService.compute_stock_metrics(stock)
    return {
        **{c.name: getattr(stock, c.name) for c in stock.__table__.columns},
        **metrics,
    }


@router.put("/stocks/{stock_id}", response_model=StockHoldingResponse)
async def update_stock(
    stock_id: int,
    request: StockHoldingUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update a stock holding."""
    stock = await PortfolioService.update_stock(
        db, owner_id=user.id, stock_id=stock_id, **request.model_dump(exclude_unset=True)
    )
    if not stock:
        raise HTTPException(status_code=404, detail="Stock holding not found")
    await PortfolioService.record_current_snapshot(db, owner_id=user.id, preferred_currency=user.preferred_currency or "CZK")
    metrics = PortfolioService.compute_stock_metrics(stock)
    return {
        **{c.name: getattr(stock, c.name) for c in stock.__table__.columns},
        **metrics,
    }


@router.delete("/stocks/{stock_id}")
async def delete_stock(
    stock_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete a stock holding."""
    success = await PortfolioService.delete_stock(db, owner_id=user.id, stock_id=stock_id)
    if not success:
        raise HTTPException(status_code=404, detail="Stock holding not found")
    await PortfolioService.record_current_snapshot(db, owner_id=user.id, preferred_currency=user.preferred_currency or "CZK")
    return {"success": True}


# ── Property Investments ──

@router.get("/properties/base-prices")
async def get_base_prices(
    user: User = Depends(get_current_user),
):
    """Return pre-seeded base prices per sqm grouped by country."""
    result = {}
    for country, cities in BASE_PRICES.items():
        currency = cities.get("_currency", "EUR")
        city_prices = {k: v for k, v in cities.items() if k != "_currency"}
        avg = get_country_average(country)
        result[country] = {
            "currency": currency,
            "cities": city_prices,
            "country_average": avg,
        }
    return result


@router.get("/properties", response_model=list[PropertyResponse])
async def list_properties(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all active property investments with computed metrics."""
    properties = await PropertyService.get_all(db, owner_id=user.id)
    result = []
    for prop in properties:
        metrics = compute_property_metrics(prop)
        result.append({
            **{c.name: getattr(prop, c.name) for c in prop.__table__.columns},
            **metrics,
        })
    return result


@router.post("/properties", response_model=PropertyResponse)
async def create_property(
    request: PropertyCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create a property investment."""
    prop = await PropertyService.create(db, owner_id=user.id, **request.model_dump())
    await PortfolioService.record_current_snapshot(
        db, owner_id=user.id, preferred_currency=user.preferred_currency or "CZK",
    )
    metrics = compute_property_metrics(prop)
    return {
        **{c.name: getattr(prop, c.name) for c in prop.__table__.columns},
        **metrics,
    }


@router.put("/properties/{property_id}", response_model=PropertyResponse)
async def update_property(
    property_id: int,
    request: PropertyUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update a property investment."""
    prop = await PropertyService.update(
        db, owner_id=user.id, property_id=property_id,
        **request.model_dump(exclude_unset=True),
    )
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    await PortfolioService.record_current_snapshot(
        db, owner_id=user.id, preferred_currency=user.preferred_currency or "CZK",
    )
    metrics = compute_property_metrics(prop)
    return {
        **{c.name: getattr(prop, c.name) for c in prop.__table__.columns},
        **metrics,
    }


@router.delete("/properties/{property_id}")
async def delete_property(
    property_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete a property investment."""
    success = await PropertyService.delete(db, owner_id=user.id, property_id=property_id)
    if not success:
        raise HTTPException(status_code=404, detail="Property not found")
    await PortfolioService.record_current_snapshot(
        db, owner_id=user.id, preferred_currency=user.preferred_currency or "CZK",
    )
    return {"success": True}


@router.get("/properties-history")
async def get_all_properties_history(
    months: int = Query(default=120, ge=1, le=240),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get aggregated monthly property value history for trend chart."""
    return await PropertyService.get_all_properties_history(
        db, owner_id=user.id, months=months,
    )


@router.get("/properties/{property_id}/history")
async def get_property_history(
    property_id: int,
    months: int = Query(default=120, ge=1, le=240),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get monthly value snapshots for a specific property."""
    history = await PropertyService.get_property_history(
        db, owner_id=user.id, property_id=property_id, months=months,
    )
    return {"property_id": property_id, "history": history}
