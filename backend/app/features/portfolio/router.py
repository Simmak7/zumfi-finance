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
from core.exchange_rates import get_rates_for_month
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
    months: int = Query(default=12, ge=2, le=36),
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
    months: int = Query(default=12, ge=2, le=36),
    end_month: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}$"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get monthly total portfolio values for development chart."""
    return await PortfolioService.get_portfolio_history(
        db, owner_id=user.id, months=months, end_month=end_month,
    )


# ── Stock Holdings History ──

@router.get("/stock-history")
async def get_stock_holdings_history(
    months: int = Query(default=12, ge=2, le=36),
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
    months: int = Query(default=60, ge=2, le=120),
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
    months: int = Query(default=12, ge=2, le=36),
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


# ── Stock P&L (Realized Trades + Dividends) ──

@router.get("/stock-pnl", response_model=StockPnlSummary)
async def get_stock_pnl(
    month: str | None = Query(default=None, description="YYYY-MM to filter by month"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get realized stock trades and dividends from P&L statements."""
    return await get_stock_pnl_summary(db, owner_id=user.id, month=month)


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
    preferred = user.preferred_currency or "CZK"
    current_month = date.today().strftime("%Y-%m")
    rates = await get_rates_for_month(db, current_month)
    convert = PortfolioService._convert_amount
    result = []
    for prop in properties:
        metrics = compute_property_metrics(prop)
        currency = prop.currency or "CZK"
        raw_value = metrics.get("display_value") or float(prop.purchase_price)
        raw_cost = float(prop.purchase_price)
        raw_gain = metrics.get("gain_loss")
        data = {
            **{c.name: getattr(prop, c.name) for c in prop.__table__.columns},
            **metrics,
            "converted_value": convert(raw_value, currency, preferred, rates),
            "converted_purchase_price": convert(raw_cost, currency, preferred, rates),
            "converted_gain_loss": convert(raw_gain, currency, preferred, rates) if raw_gain is not None else None,
            "display_currency": preferred,
        }
        result.append(data)
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
    months: int = Query(default=120, ge=2, le=240),
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
    months: int = Query(default=120, ge=2, le=240),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get monthly value snapshots for a specific property."""
    history = await PropertyService.get_property_history(
        db, owner_id=user.id, property_id=property_id, months=months,
    )
    return {"property_id": property_id, "history": history}


# ── Seed Demo Snapshots ──

@router.post("/seed-demo-snapshots")
async def seed_demo_snapshots(
    request: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Seed historical portfolio + stock holding snapshots for demo data.

    Accepts:
    {
        "portfolio_snapshots": [
            {"month": "2025-09", "total_savings": ..., "total_investments": ..., "total_stocks": ..., "total_properties": ...},
        ],
        "stock_snapshots": [
            {"month": "2025-09", "ticker": "AAPL", "currency": "USD", "name": "Apple Inc.",
             "holding_type": "stock", "shares": 8, "price": 195.50},
        ]
    }
    """
    from decimal import Decimal as D
    from features.portfolio.models import StockHoldingSnapshot, PortfolioSnapshot

    created_portfolio = 0
    created_stocks = 0

    for ps in request.get("portfolio_snapshots", []):
        month = ps["month"]
        y, m = int(month[:4]), int(month[5:7])
        _, last = monthrange(y, m)
        snap_date = date(y, m, last)
        await PortfolioService.create_or_update_snapshot(
            db, user.id, snap_date,
            ps["total_savings"], ps["total_investments"],
            ps.get("total_stocks", 0), ps.get("total_properties", 0),
        )
        created_portfolio += 1

    for ss in request.get("stock_snapshots", []):
        month = ss["month"]
        shares = float(ss["shares"])
        price = float(ss["price"])
        market_value = round(shares * price, 2)
        total_invested = round(shares * float(ss.get("avg_cost", price)), 2)

        result = await db.execute(
            select(StockHoldingSnapshot).where(
                StockHoldingSnapshot.owner_id == user.id,
                StockHoldingSnapshot.ticker == ss["ticker"],
                StockHoldingSnapshot.currency == ss["currency"],
                StockHoldingSnapshot.snapshot_month == month,
            )
        )
        snap = result.scalar_one_or_none()
        if snap:
            snap.shares = D(str(shares))
            snap.price = D(str(price))
            snap.market_value = D(str(market_value))
            snap.total_invested = D(str(total_invested))
            snap.name = ss["name"]
            snap.holding_type = ss.get("holding_type", "stock")
        else:
            snap = StockHoldingSnapshot(
                owner_id=user.id,
                ticker=ss["ticker"],
                currency=ss["currency"],
                snapshot_month=month,
                name=ss["name"],
                holding_type=ss.get("holding_type", "stock"),
                shares=D(str(shares)),
                price=D(str(price)),
                market_value=D(str(market_value)),
                total_invested=D(str(total_invested)),
            )
            db.add(snap)
        created_stocks += 1

    await db.flush()
    await db.commit()
    return {"portfolio_snapshots": created_portfolio, "stock_snapshots": created_stocks}
