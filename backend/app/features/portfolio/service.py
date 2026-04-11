from calendar import monthrange
from datetime import date
from decimal import Decimal

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from features.portfolio.models import SavingsAccount, Investment, StockHolding, StockHoldingSnapshot, PortfolioSnapshot
from features.goals.models import GoalContribution
from core.exchange_rates import get_rates_for_month
from features.portfolio.property_service import PropertyService, compute_property_metrics, compute_property_value


class PortfolioService:
    # ── Month closed check ──

    @staticmethod
    async def _is_month_closed(db: AsyncSession, owner_id: int, month: str) -> bool:
        """A month is closed when goal allocations have been made and no surplus remains."""
        from features.goals.service import GoalService
        surplus = await GoalService.get_surplus(db, owner_id, month)
        return float(surplus["already_allocated"]) > 0 and float(surplus["available_surplus"]) == 0

    # ── Savings Account CRUD ──

    @staticmethod
    async def get_all_savings(db: AsyncSession, owner_id: int) -> list[SavingsAccount]:
        result = await db.execute(
            select(SavingsAccount)
            .where(SavingsAccount.owner_id == owner_id, SavingsAccount.status == "active")
            .order_by(SavingsAccount.created_at.desc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def create_savings(db: AsyncSession, owner_id: int, **kwargs) -> SavingsAccount:
        account = SavingsAccount(owner_id=owner_id, **kwargs)
        db.add(account)
        await db.flush()
        await db.refresh(account)
        return account

    @staticmethod
    async def update_savings(
        db: AsyncSession, owner_id: int, account_id: int, **kwargs
    ) -> SavingsAccount | None:
        result = await db.execute(
            select(SavingsAccount).where(
                SavingsAccount.id == account_id,
                SavingsAccount.owner_id == owner_id,
            )
        )
        account = result.scalar_one_or_none()
        if not account:
            return None

        for key, value in kwargs.items():
            if value is not None:
                setattr(account, key, value)

        await db.flush()
        await db.refresh(account)
        return account

    @staticmethod
    async def delete_savings(db: AsyncSession, owner_id: int, account_id: int) -> bool:
        result = await db.execute(
            select(SavingsAccount).where(
                SavingsAccount.id == account_id,
                SavingsAccount.owner_id == owner_id,
            )
        )
        account = result.scalar_one_or_none()
        if not account:
            return False
        await db.delete(account)
        await db.flush()
        return True

    # ── Investment CRUD ──

    @staticmethod
    async def get_all_investments(db: AsyncSession, owner_id: int) -> list[Investment]:
        result = await db.execute(
            select(Investment)
            .where(Investment.owner_id == owner_id, Investment.status == "active")
            .order_by(Investment.created_at.desc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def create_investment(db: AsyncSession, owner_id: int, **kwargs) -> Investment:
        inv = Investment(owner_id=owner_id, **kwargs)
        db.add(inv)
        await db.flush()
        await db.refresh(inv)
        return inv

    @staticmethod
    async def update_investment(
        db: AsyncSession, owner_id: int, investment_id: int, **kwargs
    ) -> Investment | None:
        result = await db.execute(
            select(Investment).where(
                Investment.id == investment_id,
                Investment.owner_id == owner_id,
            )
        )
        inv = result.scalar_one_or_none()
        if not inv:
            return None

        for key, value in kwargs.items():
            if value is not None:
                setattr(inv, key, value)

        await db.flush()
        await db.refresh(inv)
        return inv

    @staticmethod
    async def delete_investment(db: AsyncSession, owner_id: int, investment_id: int) -> bool:
        result = await db.execute(
            select(Investment).where(
                Investment.id == investment_id,
                Investment.owner_id == owner_id,
            )
        )
        inv = result.scalar_one_or_none()
        if not inv:
            return False
        await db.delete(inv)
        await db.flush()
        return True

    # ── Stock Holding CRUD ──

    @staticmethod
    async def get_all_stocks(db: AsyncSession, owner_id: int) -> list[StockHolding]:
        result = await db.execute(
            select(StockHolding)
            .where(
                StockHolding.owner_id == owner_id,
                StockHolding.status == "active",
                StockHolding.shares > Decimal("0.0001"),
            )
            .order_by(StockHolding.created_at.desc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def get_stocks_for_month(
        db: AsyncSession, owner_id: int, month: str,
    ) -> list[dict]:
        """Get stock holdings as they existed in a specific month.

        Uses carry-forward: for each stock, finds the latest snapshot
        on or before the target month. Falls back to total_invested
        when market_value is not available.

        Sold stocks are only shown up to their last snapshot month.
        """
        from features.portfolio.models import StockHoldingSnapshot

        # Build set of currently active stocks
        active_result = await db.execute(
            select(StockHolding.ticker, StockHolding.currency).where(
                StockHolding.owner_id == owner_id,
                StockHolding.status == "active",
                StockHolding.shares > Decimal("0.0001"),
            )
        )
        active_stocks = {(r[0], r[1]) for r in active_result}

        # Fetch all snapshots up to the target month
        result = await db.execute(
            select(StockHoldingSnapshot).where(
                StockHoldingSnapshot.owner_id == owner_id,
                StockHoldingSnapshot.snapshot_month <= month,
            ).order_by(StockHoldingSnapshot.snapshot_month.asc())
        )
        all_snaps = list(result.scalars().all())

        if not all_snaps:
            return []

        # Carry forward: keep only the latest snapshot per (ticker, currency)
        # Track last snapshot month for sold-stock limiting
        latest_by_stock: dict[tuple[str, str], StockHoldingSnapshot] = {}
        last_snap_month: dict[tuple[str, str], str] = {}
        for snap in all_snaps:
            key = (snap.ticker, snap.currency)
            latest_by_stock[key] = snap  # last one wins (ordered by month asc)
            last_snap_month[key] = snap.snapshot_month

        stock_responses = []
        for (ticker, currency), snap in latest_by_stock.items():
            key = (ticker, currency)
            # Sold stocks: don't carry forward beyond last snapshot
            if key not in active_stocks and month > last_snap_month[key]:
                continue

            shares = float(snap.shares or 0)
            if shares < 0.0001:
                continue

            # Look up StockHolding for metadata (any status)
            holding_result = await db.execute(
                select(StockHolding).where(
                    StockHolding.owner_id == owner_id,
                    StockHolding.ticker == ticker,
                    StockHolding.currency == currency,
                ).limit(1)
            )
            holding = holding_result.scalar_one_or_none()

            price = float(snap.price) if snap.price is not None else None
            market_value = float(snap.market_value) if snap.market_value is not None else None
            total_invested = float(snap.total_invested) if snap.total_invested is not None else None

            avg_cost = (total_invested / shares) if total_invested and shares > 0 else 0
            total_cost = total_invested if total_invested else round(shares * avg_cost, 2)
            gain_loss = round(market_value - total_cost, 2) if market_value is not None and total_cost else None
            gain_loss_pct = (
                round((gain_loss / total_cost) * 100, 2)
                if gain_loss is not None and total_cost > 0
                else None
            )

            stock_responses.append({
                "id": holding.id if holding else 0,
                "name": snap.name or (holding.name if holding else snap.ticker),
                "ticker": snap.ticker,
                "isin": holding.isin if holding else None,
                "holding_type": snap.holding_type or (holding.holding_type if holding else "stock"),
                "shares": snap.shares,
                "avg_cost_per_share": Decimal(str(round(avg_cost, 8))) if avg_cost else Decimal("0"),
                "current_price": snap.price,
                "currency": snap.currency,
                "notes": holding.notes if holding else None,
                "color": holding.color if holding else None,
                "status": "active",
                "total_cost": round(total_cost, 2) if total_cost else 0,
                "market_value": market_value,
                "gain_loss": gain_loss,
                "gain_loss_pct": gain_loss_pct,
                "created_at": holding.created_at if holding else snap.created_at,
                "updated_at": holding.updated_at if holding else snap.created_at,
                "snapshot_month": last_snap_month[key],
            })

        return stock_responses

    @staticmethod
    async def create_stock(db: AsyncSession, owner_id: int, **kwargs) -> StockHolding:
        stock = StockHolding(owner_id=owner_id, **kwargs)
        db.add(stock)
        await db.flush()
        await db.refresh(stock)
        return stock

    @staticmethod
    async def update_stock(
        db: AsyncSession, owner_id: int, stock_id: int, **kwargs
    ) -> StockHolding | None:
        result = await db.execute(
            select(StockHolding).where(
                StockHolding.id == stock_id,
                StockHolding.owner_id == owner_id,
            )
        )
        stock = result.scalar_one_or_none()
        if not stock:
            return None
        for key, value in kwargs.items():
            if value is not None:
                setattr(stock, key, value)
        await db.flush()
        await db.refresh(stock)
        return stock

    @staticmethod
    async def delete_stock(db: AsyncSession, owner_id: int, stock_id: int) -> bool:
        result = await db.execute(
            select(StockHolding).where(
                StockHolding.id == stock_id,
                StockHolding.owner_id == owner_id,
            )
        )
        stock = result.scalar_one_or_none()
        if not stock:
            return False
        await db.delete(stock)
        await db.flush()
        return True

    # ── Computed metrics ──

    @staticmethod
    def compute_stock_metrics(stock: StockHolding) -> dict:
        shares = float(stock.shares or 0)
        avg_cost = float(stock.avg_cost_per_share or 0)
        cur_price = float(stock.current_price) if stock.current_price is not None else None

        total_cost = round(shares * avg_cost, 2)
        market_value = round(shares * cur_price, 2) if cur_price is not None else None
        gain_loss = round(market_value - total_cost, 2) if market_value is not None else None
        gain_loss_pct = (
            round((gain_loss / total_cost) * 100, 2)
            if gain_loss is not None and total_cost > 0
            else None
        )

        return {
            "total_cost": total_cost,
            "market_value": market_value,
            "gain_loss": gain_loss,
            "gain_loss_pct": gain_loss_pct,
        }

    @staticmethod
    def compute_investment_metrics(inv: Investment) -> dict:
        units = float(inv.units or 0)
        avg_price = float(inv.avg_purchase_price or 0)
        cur_price = float(inv.current_price) if inv.current_price is not None else None

        total_invested = round(units * avg_price, 2)
        current_value = round(units * cur_price, 2) if cur_price is not None else None
        gain_loss = round(current_value - total_invested, 2) if current_value is not None else None
        gain_loss_pct = (
            round((gain_loss / total_invested) * 100, 2)
            if gain_loss is not None and total_invested > 0
            else None
        )

        return {
            "total_invested": total_invested,
            "current_value": current_value,
            "gain_loss": gain_loss,
            "gain_loss_pct": gain_loss_pct,
        }

    @staticmethod
    def _convert_amount(
        amount: float, from_currency: str,
        preferred_currency: str, rates: dict[str, float],
    ) -> float:
        """Convert amount to preferred currency using exchange rates."""
        from core.exchange_rates import convert_amount
        return convert_amount(amount, from_currency, preferred_currency, rates)

    @staticmethod
    def _sum_stocks_converted(
        stocks, preferred_currency: str, rates: dict[str, float],
    ) -> tuple[float, float]:
        """Sum stock market values and costs converted to preferred currency.

        Returns (total_value_converted, total_cost_converted).
        """
        total_value = 0.0
        total_cost = 0.0
        for stock in stocks:
            sm = PortfolioService.compute_stock_metrics(stock)
            raw_value = sm["market_value"] if sm["market_value"] is not None else sm["total_cost"]
            raw_cost = sm["total_cost"]
            currency = stock.currency
            total_value += PortfolioService._convert_amount(
                raw_value, currency, preferred_currency, rates,
            )
            total_cost += PortfolioService._convert_amount(
                raw_cost, currency, preferred_currency, rates,
            )
        return round(total_value, 2), round(total_cost, 2)

    # ── Portfolio Summary ──

    @staticmethod
    async def get_summary(
        db: AsyncSession, owner_id: int,
        month: str | None = None, preferred_currency: str = "CZK",
    ) -> dict:
        today = date.today()
        current_month = f"{today.year}-{today.month:02d}"
        is_current = month is None or month == current_month

        if not is_current:
            result = await PortfolioService._get_historical_summary(
                db, owner_id, month, preferred_currency,
            )
            result["is_closed"] = await PortfolioService._is_month_closed(db, owner_id, month)
            return result

        # Don't auto-create snapshots here — snapshots are created only
        # when the user explicitly adds/updates data (CRUD) or uploads statements.

        savings = await PortfolioService.get_all_savings(db, owner_id)
        investments = await PortfolioService.get_all_investments(db, owner_id)
        stocks = await PortfolioService.get_all_stocks(db, owner_id)
        properties = await PropertyService.get_all(db, owner_id)

        # Use current month's average exchange rate for consistency
        rates = await get_rates_for_month(db, current_month)

        total_savings = sum(float(a.balance) for a in savings)

        inv_with_metrics = []
        total_inv_cost = 0.0
        total_inv_value = 0.0
        has_any_inv_value = False

        for inv in investments:
            metrics = PortfolioService.compute_investment_metrics(inv)
            total_inv_cost += metrics["total_invested"]
            if metrics["current_value"] is not None:
                total_inv_value += metrics["current_value"]
                has_any_inv_value = True
            else:
                total_inv_value += metrics["total_invested"]
            inv_with_metrics.append((inv, metrics))

        # Stock holdings — convert each holding to preferred currency
        stock_with_metrics = []
        total_stocks_cost = 0.0
        total_stocks_value = 0.0
        has_any_stock_value = False

        for stock in stocks:
            sm = PortfolioService.compute_stock_metrics(stock)
            currency = stock.currency
            converted_cost = PortfolioService._convert_amount(
                sm["total_cost"], currency, preferred_currency, rates,
            )
            total_stocks_cost += converted_cost
            if sm["market_value"] is not None:
                converted_value = PortfolioService._convert_amount(
                    sm["market_value"], currency, preferred_currency, rates,
                )
                total_stocks_value += converted_value
                has_any_stock_value = True
            else:
                total_stocks_value += converted_cost
            stock_with_metrics.append((stock, sm))

        # Property investments — convert each to preferred_currency
        prop_with_metrics = []
        total_props_cost = 0.0
        total_props_value = 0.0
        for prop in properties:
            pm = compute_property_metrics(prop)
            currency = prop.currency or "CZK"
            raw_value = pm["display_value"] if pm["display_value"] is not None else float(prop.purchase_price)
            raw_cost = float(prop.purchase_price)
            converted_value = PortfolioService._convert_amount(
                raw_value, currency, preferred_currency, rates,
            )
            converted_cost = PortfolioService._convert_amount(
                raw_cost, currency, preferred_currency, rates,
            )
            total_props_value += converted_value
            total_props_cost += converted_cost
            prop_with_metrics.append((prop, pm, converted_value, converted_cost))

        total_portfolio = total_savings + total_inv_value + total_stocks_value + total_props_value
        overall_gain = (
            (total_inv_value - total_inv_cost if has_any_inv_value else 0.0)
            + (total_stocks_value - total_stocks_cost if has_any_stock_value else 0.0)
        )
        overall_cost = total_inv_cost + total_stocks_cost
        overall_pct = (
            round((overall_gain / overall_cost) * 100, 2)
            if overall_cost > 0 and (has_any_inv_value or has_any_stock_value)
            else 0.0
        )

        stocks_gain = total_stocks_value - total_stocks_cost if has_any_stock_value else 0.0
        stocks_gain_pct = (
            round((stocks_gain / total_stocks_cost) * 100, 2)
            if total_stocks_cost > 0 and has_any_stock_value else 0.0
        )

        # Build allocation breakdown
        allocation = []
        if total_portfolio > 0:
            if total_savings > 0:
                allocation.append({
                    "name": "Savings",
                    "value": round(total_savings, 2),
                    "percentage": round(total_savings / total_portfolio * 100, 1),
                    "color": "#22c55e",
                })

            # Group investments by type
            type_totals: dict[str, float] = {}
            type_colors = {
                "etf": "#6366f1",
                "stock": "#3b82f6",
                "bond": "#f59e0b",
                "crypto": "#a855f7",
                "other": "#64748b",
            }
            for inv, metrics in inv_with_metrics:
                val = metrics["current_value"] if metrics["current_value"] is not None else metrics["total_invested"]
                itype = inv.investment_type or "other"
                type_totals[itype] = type_totals.get(itype, 0.0) + val

            for itype, val in type_totals.items():
                label = itype.upper() if itype in ("etf",) else itype.capitalize()
                allocation.append({
                    "name": label,
                    "value": round(val, 2),
                    "percentage": round(val / total_portfolio * 100, 1),
                    "color": type_colors.get(itype, "#64748b"),
                })

            if total_stocks_value > 0:
                allocation.append({
                    "name": "Stock Portfolio",
                    "value": round(total_stocks_value, 2),
                    "percentage": round(total_stocks_value / total_portfolio * 100, 1),
                    "color": "#0ea5e9",
                })

            if total_props_value > 0:
                allocation.append({
                    "name": "Properties",
                    "value": round(total_props_value, 2),
                    "percentage": round(total_props_value / total_portfolio * 100, 1),
                    "color": "#f97316",
                })

        # Build investment response dicts
        inv_responses = []
        for inv, metrics in inv_with_metrics:
            inv_responses.append({
                "id": inv.id,
                "name": inv.name,
                "ticker": inv.ticker,
                "investment_type": inv.investment_type,
                "units": inv.units,
                "avg_purchase_price": inv.avg_purchase_price,
                "current_price": inv.current_price,
                "currency": inv.currency,
                "notes": inv.notes,
                "color": inv.color,
                "status": inv.status,
                "total_invested": metrics["total_invested"],
                "current_value": metrics["current_value"],
                "gain_loss": metrics["gain_loss"],
                "gain_loss_pct": metrics["gain_loss_pct"],
                "created_at": inv.created_at,
                "updated_at": inv.updated_at,
            })

        # Build stock response dicts
        stock_responses = []
        for stock, sm in stock_with_metrics:
            raw_val = sm["market_value"] if sm["market_value"] is not None else sm["total_cost"]
            converted_val = PortfolioService._convert_amount(
                raw_val, stock.currency, preferred_currency, rates,
            )
            stock_responses.append({
                "id": stock.id,
                "name": stock.name,
                "ticker": stock.ticker,
                "isin": stock.isin,
                "holding_type": stock.holding_type,
                "shares": stock.shares,
                "avg_cost_per_share": stock.avg_cost_per_share,
                "current_price": stock.current_price,
                "currency": stock.currency,
                "notes": stock.notes,
                "color": stock.color,
                "status": stock.status,
                "total_cost": sm["total_cost"],
                "market_value": sm["market_value"],
                "gain_loss": sm["gain_loss"],
                "gain_loss_pct": sm["gain_loss_pct"],
                "created_at": stock.created_at,
                "updated_at": stock.updated_at,
                "converted_value": converted_val,
            })

        # Build property response dicts
        prop_responses = []
        for prop, pm, conv_value, conv_cost in prop_with_metrics:
            currency = prop.currency or "CZK"
            rate_used = rates.get(currency) if currency != preferred_currency else None
            prop_responses.append({
                **{c.name: getattr(prop, c.name) for c in prop.__table__.columns},
                **pm,
                "converted_value": round(conv_value, 2),
                "converted_cost": round(conv_cost, 2),
                "exchange_rate": round(rate_used, 4) if rate_used else None,
                "target_currency": preferred_currency,
            })

        # Fetch previous month snapshot for delta display
        prev_month = today.month - 1 if today.month > 1 else 12
        prev_year = today.year if today.month > 1 else today.year - 1
        prev_snap = await PortfolioService._get_snapshot_for_month(db, owner_id, prev_year, prev_month)

        prev_total_stocks = float(prev_snap.total_stocks) if prev_snap else None
        prev_total_properties = float(prev_snap.total_properties) if prev_snap and prev_snap.total_properties else None

        prev_total_portfolio = None
        if prev_snap:
            prev_total_portfolio = (
                float(prev_snap.total_savings) + float(prev_snap.total_investments)
                + float(prev_snap.total_stocks)
                + (float(prev_snap.total_properties) if prev_snap.total_properties else 0)
            )

        return {
            "total_savings": round(total_savings, 2),
            "total_investments_value": round(total_inv_value, 2),
            "total_investments_cost": round(total_inv_cost, 2),
            "total_stocks_value": round(total_stocks_value, 2),
            "total_stocks_cost": round(total_stocks_cost, 2),
            "total_properties_value": round(total_props_value, 2),
            "total_properties_cost": round(total_props_cost, 2),
            "total_portfolio": round(total_portfolio, 2),
            "overall_gain_loss": round(overall_gain, 2),
            "overall_gain_loss_pct": overall_pct,
            "stocks_gain_loss": round(stocks_gain, 2),
            "stocks_gain_loss_pct": stocks_gain_pct,
            "savings_accounts": savings,
            "investments": inv_responses,
            "stock_holdings": stock_responses,
            "properties": prop_responses,
            "preferred_currency": preferred_currency,
            "allocation": allocation,
            "month": current_month,
            "is_historical": False,
            "is_closed": False,
            "previous_total_savings": float(prev_snap.total_savings) if prev_snap else None,
            "previous_total_investments": float(prev_snap.total_investments) if prev_snap else None,
            "previous_total_stocks": prev_total_stocks,
            "previous_total_properties": prev_total_properties,
            "previous_total_portfolio": prev_total_portfolio,
        }

    # ── Historical summary from snapshots ──

    @staticmethod
    async def _get_historical_summary(
        db: AsyncSession, owner_id: int, month: str,
        preferred_currency: str = "CZK",
    ) -> dict:
        try:
            year, mon = int(month[:4]), int(month[5:7])
        except (ValueError, IndexError):
            year, mon = date.today().year, date.today().month

        snap = await PortfolioService._get_snapshot_for_month(db, owner_id, year, mon)

        # Previous month snapshot for deltas
        prev_month = mon - 1 if mon > 1 else 12
        prev_year = year if mon > 1 else year - 1
        prev_snap = await PortfolioService._get_snapshot_for_month(db, owner_id, prev_year, prev_month)

        if snap:
            ts = float(snap.total_savings)
            ti = float(snap.total_investments)
            tp = float(snap.total_properties) if snap.total_properties else 0.0
        else:
            ts, ti, tp = 0.0, 0.0, 0.0

        # Return current accounts/investments for the page layout
        savings = await PortfolioService.get_all_savings(db, owner_id)
        investments = await PortfolioService.get_all_investments(db, owner_id)

        inv_responses = []
        total_inv_cost = 0.0
        for inv in investments:
            metrics = PortfolioService.compute_investment_metrics(inv)
            total_inv_cost += metrics["total_invested"]
            inv_responses.append({
                "id": inv.id,
                "name": inv.name,
                "ticker": inv.ticker,
                "investment_type": inv.investment_type,
                "units": inv.units,
                "avg_purchase_price": inv.avg_purchase_price,
                "current_price": inv.current_price,
                "currency": inv.currency,
                "notes": inv.notes,
                "color": inv.color,
                "status": inv.status,
                "total_invested": metrics["total_invested"],
                "current_value": metrics["current_value"],
                "gain_loss": metrics["gain_loss"],
                "gain_loss_pct": metrics["gain_loss_pct"],
                "created_at": inv.created_at,
                "updated_at": inv.updated_at,
            })

        # Use carry-forward for the stock LIST (shows all held stocks)
        stock_responses = await PortfolioService.get_stocks_for_month(db, owner_id, month)
        rates = await get_rates_for_month(db, month)

        # Add converted values to stock responses
        for sr in stock_responses:
            raw_val = sr["market_value"] if sr["market_value"] is not None else (sr["total_cost"] or 0)
            sr["converted_value"] = PortfolioService._convert_amount(
                float(raw_val), sr["currency"], preferred_currency, rates,
            )

        # Use EXACT-month snapshots for VALUE totals (matches bank statement)
        exact_snaps = await db.execute(
            select(StockHoldingSnapshot).where(
                StockHoldingSnapshot.owner_id == owner_id,
                StockHoldingSnapshot.snapshot_month == month,
                StockHoldingSnapshot.shares > Decimal("0.0001"),
            )
        )
        tst = 0.0
        total_stock_cost = 0.0
        for snap in exact_snaps.scalars():
            mv = float(snap.market_value) if snap.market_value is not None else None
            ti = float(snap.total_invested) if snap.total_invested is not None else 0
            raw_value = mv if mv is not None else ti
            tst += PortfolioService._convert_amount(
                float(raw_value), snap.currency, preferred_currency, rates,
            )
            total_stock_cost += PortfolioService._convert_amount(
                float(ti), snap.currency, preferred_currency, rates,
            )
        tst = round(tst, 2)
        total_stock_cost = round(total_stock_cost, 2)

        # Property responses from snapshots; fall back to current properties
        prop_responses = await PropertyService.get_properties_for_month(
            db, owner_id, month,
        )
        if not prop_responses:
            # No snapshots for this month — show current properties (read-only)
            all_props = await PropertyService.get_all(db, owner_id)
            for prop in all_props:
                pm = compute_property_metrics(prop)
                prop_responses.append({
                    **{c.name: getattr(prop, c.name) for c in prop.__table__.columns},
                    **pm,
                })
        # Convert each property to preferred_currency using month's rates
        tp_converted = 0.0
        total_props_cost = 0.0
        for p in prop_responses:
            currency = p.get("currency") or "CZK"
            raw_value = float(p.get("display_value") or p.get("purchase_price", 0))
            raw_cost = float(p.get("purchase_price", 0))
            conv_val = PortfolioService._convert_amount(
                raw_value, currency, preferred_currency, rates,
            )
            conv_cost = PortfolioService._convert_amount(
                raw_cost, currency, preferred_currency, rates,
            )
            tp_converted += conv_val
            total_props_cost += conv_cost
            rate_used = rates.get(currency) if currency != preferred_currency else None
            p["converted_value"] = round(conv_val, 2)
            p["converted_cost"] = round(conv_cost, 2)
            p["exchange_rate"] = round(rate_used, 4) if rate_used else None
            p["target_currency"] = preferred_currency
        tp = round(tp_converted, 2)

        total_portfolio = ts + ti + tst + tp

        # Build allocation from snapshot totals
        allocation = []
        if total_portfolio > 0:
            if ts > 0:
                allocation.append({
                    "name": "Savings",
                    "value": round(ts, 2),
                    "percentage": round(ts / total_portfolio * 100, 1),
                    "color": "#22c55e",
                })
            if ti > 0:
                type_colors = {
                    "etf": "#6366f1", "stock": "#3b82f6",
                    "bond": "#f59e0b", "crypto": "#a855f7", "other": "#64748b",
                }
                type_totals: dict[str, float] = {}
                for inv in investments:
                    m = PortfolioService.compute_investment_metrics(inv)
                    val = m["current_value"] if m["current_value"] is not None else m["total_invested"]
                    itype = inv.investment_type or "other"
                    type_totals[itype] = type_totals.get(itype, 0.0) + val
                for itype, val in type_totals.items():
                    label = itype.upper() if itype in ("etf",) else itype.capitalize()
                    allocation.append({
                        "name": label,
                        "value": round(val, 2),
                        "percentage": round(val / total_portfolio * 100, 1),
                        "color": type_colors.get(itype, "#64748b"),
                    })
            if tst > 0:
                allocation.append({
                    "name": "Stock Portfolio",
                    "value": round(tst, 2),
                    "percentage": round(tst / total_portfolio * 100, 1),
                    "color": "#0ea5e9",
                })
            if tp > 0:
                allocation.append({
                    "name": "Properties",
                    "value": round(tp, 2),
                    "percentage": round(tp / total_portfolio * 100, 1),
                    "color": "#f97316",
                })

        overall_gain = (
            (ti - total_inv_cost if ti > 0 and total_inv_cost > 0 else 0.0)
            + (tst - total_stock_cost if tst > 0 and total_stock_cost > 0 else 0.0)
        )
        overall_cost = total_inv_cost + total_stock_cost
        overall_pct = (
            round((overall_gain / overall_cost) * 100, 2)
            if overall_cost > 0 else 0.0
        )

        stocks_gain = tst - total_stock_cost if tst > 0 and total_stock_cost > 0 else 0.0
        stocks_gain_pct = (
            round((stocks_gain / total_stock_cost) * 100, 2)
            if total_stock_cost > 0 and tst > 0 else 0.0
        )

        prev_tp = float(prev_snap.total_properties) if prev_snap and prev_snap.total_properties else None

        return {
            "total_savings": ts,
            "total_investments_value": ti,
            "total_investments_cost": round(total_inv_cost, 2),
            "total_stocks_value": tst,
            "total_stocks_cost": total_stock_cost,
            "total_properties_value": tp,
            "total_properties_cost": round(total_props_cost, 2),
            "total_portfolio": round(total_portfolio, 2),
            "overall_gain_loss": round(overall_gain, 2),
            "overall_gain_loss_pct": overall_pct,
            "stocks_gain_loss": round(stocks_gain, 2),
            "stocks_gain_loss_pct": stocks_gain_pct,
            "savings_accounts": savings,
            "investments": inv_responses,
            "stock_holdings": stock_responses,
            "properties": prop_responses,
            "preferred_currency": preferred_currency,
            "allocation": allocation,
            "month": month,
            "is_historical": True,
            "previous_total_savings": float(prev_snap.total_savings) if prev_snap else None,
            "previous_total_investments": float(prev_snap.total_investments) if prev_snap else None,
            "previous_total_stocks": float(prev_snap.total_stocks) if prev_snap else None,
            "previous_total_properties": prev_tp,
            "previous_total_portfolio": (
                float(prev_snap.total_savings) + float(prev_snap.total_investments)
                + float(prev_snap.total_stocks)
                + (float(prev_snap.total_properties) if prev_snap.total_properties else 0)
            ) if prev_snap else None,
        }

    # ── Snapshot CRUD ──

    @staticmethod
    async def _get_savings_for_month(
        db: AsyncSession, owner_id: int, month_str: str,
    ) -> float:
        """Derive total savings for a month from statement closing balances.

        Only includes savings backed by a statement whose period_end falls
        in the target month.  Returns 0.0 when no savings statements exist
        for that month — preventing ghost data from current live balances.
        """
        from features.statements.models import Statement

        y, m = int(month_str[:4]), int(month_str[5:7])
        first_day = date(y, m, 1)
        _, last = monthrange(y, m)
        last_day = date(y, m, last)

        result = await db.execute(
            select(
                Statement.linked_savings_id,
                func.max(Statement.closing_balance),
            ).where(
                Statement.owner_id == owner_id,
                Statement.statement_type == "savings",
                Statement.closing_balance.isnot(None),
                Statement.linked_savings_id.isnot(None),
                Statement.period_end >= first_day,
                Statement.period_end <= last_day,
            ).group_by(Statement.linked_savings_id)
        )
        rows = result.all()
        return sum(float(row[1]) for row in rows if row[1] is not None)

    @staticmethod
    async def _get_snapshot_for_month(
        db: AsyncSession, owner_id: int, year: int, month: int,
    ) -> PortfolioSnapshot | None:
        first_day = date(year, month, 1)
        _, last = monthrange(year, month)
        last_day = date(year, month, last)
        result = await db.execute(
            select(PortfolioSnapshot)
            .where(
                PortfolioSnapshot.owner_id == owner_id,
                PortfolioSnapshot.snapshot_date >= first_day,
                PortfolioSnapshot.snapshot_date <= last_day,
            )
            .order_by(PortfolioSnapshot.snapshot_date.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def create_or_update_snapshot(
        db: AsyncSession, owner_id: int, snapshot_date: date,
        total_savings: float | None = None,
        total_investments: float | None = None,
        total_stocks: float | None = None,
        total_properties: float | None = None,
    ) -> PortfolioSnapshot:
        """Create or update a portfolio snapshot.

        Merge semantics: when updating an existing snapshot, None values
        preserve existing data. When creating a new snapshot, None defaults to 0.
        """
        result = await db.execute(
            select(PortfolioSnapshot).where(
                PortfolioSnapshot.owner_id == owner_id,
                PortfolioSnapshot.snapshot_date == snapshot_date,
            )
        )
        existing = result.scalar_one_or_none()
        if existing:
            if total_savings is not None:
                existing.total_savings = Decimal(str(round(total_savings, 2)))
            if total_investments is not None:
                existing.total_investments = Decimal(str(round(total_investments, 2)))
            if total_stocks is not None:
                existing.total_stocks = Decimal(str(round(total_stocks, 2)))
            if total_properties is not None:
                existing.total_properties = Decimal(str(round(total_properties, 2)))
        else:
            existing = PortfolioSnapshot(
                owner_id=owner_id,
                snapshot_date=snapshot_date,
                total_savings=Decimal(str(round(total_savings or 0, 2))),
                total_investments=Decimal(str(round(total_investments or 0, 2))),
                total_stocks=Decimal(str(round(total_stocks or 0, 2))),
                total_properties=Decimal(str(round(total_properties or 0, 2))),
            )
            db.add(existing)
        await db.flush()
        return existing

    @staticmethod
    async def get_savings_history(
        db: AsyncSession, owner_id: int, months: int = 12,
        end_month: str | None = None,
    ) -> list[dict]:
        """Return one savings data-point per month (latest snapshot in each month)."""
        if end_month:
            anchor_year, anchor_month = int(end_month[:4]), int(end_month[5:7])
        else:
            today = date.today()
            anchor_year, anchor_month = today.year, today.month
        points = []
        for i in range(months - 1, -1, -1):
            # Walk backwards from anchor month
            y = anchor_year
            m = anchor_month - i
            while m <= 0:
                m += 12
                y -= 1
            snap = await PortfolioService._get_snapshot_for_month(db, owner_id, y, m)
            points.append({
                "month": f"{y}-{m:02d}",
                "total_savings": float(snap.total_savings) if snap else 0.0,
                "total_investments": float(snap.total_investments) if snap else 0.0,
                "total_stocks": float(snap.total_stocks) if snap else 0.0,
            })
        return points

    @staticmethod
    async def get_portfolio_history(
        db: AsyncSession, owner_id: int, months: int = 12,
        end_month: str | None = None, preferred_currency: str = "CZK",
    ) -> list[dict]:
        """Return total portfolio value per month for trend chart.

        Properties are always included (self-calculated) even if no
        portfolio snapshot exists for that month. Savings, investments
        and stocks only appear from uploaded/manually-added data.
        Property values are converted to preferred_currency.
        """
        from features.portfolio.property_service import PropertyService

        if end_month:
            anchor_year, anchor_month = int(end_month[:4]), int(end_month[5:7])
        else:
            today = date.today()
            anchor_year, anchor_month = today.year, today.month

        # Pre-load property history with per-property breakdown for currency conversion
        prop_history = await PropertyService.get_all_properties_history(db, owner_id, months)
        prop_currencies = prop_history.get("currencies", {})
        prop_by_month: dict[str, list[dict]] = {}
        for h in prop_history.get("history", []):
            prop_by_month[h["month"]] = h.get("properties", [])

        # Pre-load exchange rates for each month to avoid repeated DB calls.
        # Also fetch latest rates as fallback for currencies missing in older months
        # (e.g. UAH only appears in the "other currencies" feed stored from a later date).
        rates_cache: dict[str, dict] = {}
        from core.exchange_rates import get_exchange_rates
        latest_rates = await get_exchange_rates(db)

        # Collect all property currencies that need conversion
        needed_currencies = {
            prop_currencies.get(p["name"], "CZK")
            for props in prop_by_month.values()
            for p in props
        } - {preferred_currency}

        points = []
        for i in range(months - 1, -1, -1):
            y = anchor_year
            m = anchor_month - i
            while m <= 0:
                m += 12
                y -= 1
            month_str = f"{y}-{m:02d}"
            snap = await PortfolioService._get_snapshot_for_month(db, owner_id, y, m)
            if snap:
                ts = float(snap.total_savings)
                ti = float(snap.total_investments)
                tst = float(snap.total_stocks)
            else:
                ts, ti, tst = 0.0, 0.0, 0.0
            # Properties are always self-calculated from PropertySnapshot,
            # not from PortfolioSnapshot (which may be stale or missing).
            # Convert each property value to preferred_currency.
            month_props = prop_by_month.get(month_str, [])
            tp = 0.0
            if month_props:
                if month_str not in rates_cache:
                    rates_cache[month_str] = await get_rates_for_month(db, month_str)
                rates = rates_cache[month_str]
                # Supplement missing currencies from latest rates
                for cur in needed_currencies:
                    if cur not in rates and cur in latest_rates:
                        rates[cur] = latest_rates[cur]
                for p in month_props:
                    currency = prop_currencies.get(p["name"], "CZK")
                    tp += PortfolioService._convert_amount(
                        p["estimated_value"], currency, preferred_currency, rates,
                    )
                tp = round(tp, 2)
            points.append({
                "month": month_str,
                "total_savings": ts,
                "total_investments": ti,
                "total_stocks": tst,
                "total_properties": tp,
                "total_portfolio": round(ts + ti + tst + tp, 2),
            })
        return points

    @staticmethod
    async def get_stock_holdings_history(
        db: AsyncSession, owner_id: int, months: int = 12,
        end_month: str | None = None,
    ) -> list[dict]:
        """Return per-month stock holding snapshots for trend charting.

        Uses carry-forward: for each target month, takes the latest snapshot
        on or before that month for every stock. Falls back to total_invested
        when market_value is not available.

        Stocks that no longer exist in StockHolding (fully sold) are only
        shown up to their last snapshot month — not carried beyond it.
        """
        from features.portfolio.models import StockHoldingSnapshot

        if end_month:
            anchor_year, anchor_month = int(end_month[:4]), int(end_month[5:7])
        else:
            today = date.today()
            anchor_year, anchor_month = today.year, today.month

        # Build list of target months
        target_months = []
        for i in range(months - 1, -1, -1):
            y = anchor_year
            m = anchor_month - i
            while m <= 0:
                m += 12
                y -= 1
            target_months.append(f"{y}-{m:02d}")

        if not target_months:
            return []

        # Fetch ALL snapshots up to the current month in one query
        all_snaps_result = await db.execute(
            select(StockHoldingSnapshot).where(
                StockHoldingSnapshot.owner_id == owner_id,
                StockHoldingSnapshot.snapshot_month <= target_months[-1],
            ).order_by(StockHoldingSnapshot.snapshot_month.asc())
        )
        all_snaps = list(all_snaps_result.scalars().all())

        # Build set of currently active stocks from StockHolding
        active_result = await db.execute(
            select(StockHolding.ticker, StockHolding.currency).where(
                StockHolding.owner_id == owner_id,
                StockHolding.status == "active",
                StockHolding.shares > Decimal("0.0001"),
            )
        )
        active_stocks = {(r[0], r[1]) for r in active_result}

        # Index snapshots by (ticker, currency) → list of (month, snap_data)
        # Track each stock's last snapshot month for carry-forward limits
        by_stock: dict[tuple[str, str], list[tuple[str, dict]]] = {}
        last_snap_month: dict[tuple[str, str], str] = {}
        for s in all_snaps:
            key = (s.ticker, s.currency)
            snap_data = {
                "ticker": s.ticker,
                "currency": s.currency,
                "name": s.name,
                "holding_type": s.holding_type,
                "shares": s.shares,
                "price": s.price,
                "market_value": s.market_value,
                "total_invested": s.total_invested,
            }
            by_stock.setdefault(key, []).append((s.snapshot_month, snap_data))
            last_snap_month[key] = s.snapshot_month

        # For each target month, only use snapshots from months that have
        # actual data — no carry-forward beyond last uploaded snapshot.
        result = []
        for month_str in target_months:
            holdings = []
            total_value = 0.0
            for key, snap_list in by_stock.items():
                # Don't carry forward beyond the stock's last actual snapshot
                if month_str > last_snap_month[key]:
                    continue

                # Find latest snapshot on or before this month
                latest = None
                for snap_month, snap_data in snap_list:
                    if snap_month <= month_str:
                        latest = snap_data
                    else:
                        break
                if latest is None:
                    continue
                shares = float(latest["shares"] or 0)
                if shares < 0.0001:
                    continue
                mv = float(latest["market_value"]) if latest["market_value"] is not None else None
                invested = float(latest["total_invested"]) if latest["total_invested"] is not None else None
                # Use market_value if available, else fall back to total_invested
                value = mv if mv is not None else (invested if invested is not None else 0.0)
                total_value += value
                holdings.append({
                    "ticker": latest["ticker"],
                    "currency": latest["currency"],
                    "name": latest["name"],
                    "holding_type": latest["holding_type"],
                    "shares": latest["shares"],
                    "price": latest["price"],
                    "market_value": Decimal(str(round(value, 2))) if value else None,
                })
            result.append({
                "month": month_str,
                "total_value": round(total_value, 2),
                "holdings": holdings,
            })
        return result

    @staticmethod
    async def get_stock_detail_history(
        db: AsyncSession,
        owner_id: int,
        ticker: str,
        currency: str,
        months: int = 60,
    ) -> list[dict]:
        """Return monthly snapshots for a specific stock (for detail modal chart)."""
        from features.portfolio.models import StockHoldingSnapshot

        snaps_result = await db.execute(
            select(StockHoldingSnapshot).where(
                StockHoldingSnapshot.owner_id == owner_id,
                StockHoldingSnapshot.ticker == ticker,
                StockHoldingSnapshot.currency == currency,
            ).order_by(StockHoldingSnapshot.snapshot_month.asc())
        )
        snaps = list(snaps_result.scalars().all())

        # Limit to the last N months of data
        if len(snaps) > months:
            snaps = snaps[-months:]

        return [
            {
                "month": s.snapshot_month,
                "shares": float(s.shares) if s.shares else 0,
                "price": float(s.price) if s.price else None,
                "market_value": float(s.market_value) if s.market_value else None,
                "total_invested": float(s.total_invested) if s.total_invested else None,
            }
            for s in snaps
        ]

    @staticmethod
    async def record_current_snapshot(
        db: AsyncSession, owner_id: int, preferred_currency: str = "CZK",
        target_date: date | None = None,
    ) -> None:
        """Compute live portfolio totals and save a snapshot.

        When *target_date* is given (historical month edit via
        PUT /savings/{id}?month=YYYY-MM), only total_savings is updated
        for that month.  Current stocks/investments/properties are NOT
        injected into the historical snapshot.

        Without target_date, snapshots today with full live data.
        """
        snap_date = target_date or date.today()
        snap_month = f"{snap_date.year}-{snap_date.month:02d}"

        if target_date is not None:
            # Historical month: only update savings (the field the user
            # just edited). Don't inject current stocks/investments/properties.
            savings = await PortfolioService.get_all_savings(db, owner_id)
            total_savings = sum(float(a.balance) for a in savings)
            await PortfolioService.create_or_update_snapshot(
                db, owner_id, snap_date,
                total_savings=total_savings,
            )
            return

        savings = await PortfolioService.get_all_savings(db, owner_id)
        investments = await PortfolioService.get_all_investments(db, owner_id)
        stocks = await PortfolioService.get_all_stocks(db, owner_id)
        rates = await get_rates_for_month(db, snap_month)

        total_savings = sum(float(a.balance) for a in savings)
        total_inv = 0.0
        for inv in investments:
            m = PortfolioService.compute_investment_metrics(inv)
            total_inv += m["current_value"] if m["current_value"] is not None else m["total_invested"]
        total_stocks, _ = PortfolioService._sum_stocks_converted(
            stocks, preferred_currency, rates,
        )
        # Convert property values to preferred_currency for snapshot
        all_props = await PropertyService.get_all(db, owner_id)
        total_properties = 0.0
        for prop in all_props:
            v = compute_property_value(prop)
            raw = float(v) if v else float(prop.purchase_price)
            total_properties += PortfolioService._convert_amount(
                raw, prop.currency or "CZK", preferred_currency, rates,
            )
        total_properties = round(total_properties, 2)
        await PropertyService.record_property_snapshots(db, owner_id)
        await PortfolioService.create_or_update_snapshot(
            db, owner_id, snap_date, total_savings, total_inv, total_stocks, total_properties,
        )

    @staticmethod
    async def recalculate_all_snapshots(db: AsyncSession) -> int:
        """Recalculate total_savings, total_stocks, and total_properties in all PortfolioSnapshots.

        Savings are re-derived from Statement.closing_balance (statement-driven).
        Stocks use StockHoldingSnapshots with monthly average exchange rates.
        Properties use PropertySnapshots with monthly average exchange rates.
        Called once on startup to fix ghost data and rate inconsistencies.
        Returns the number of snapshots updated.
        """
        import logging
        from features.auth.models import User
        from features.portfolio.models import PropertyInvestment, PropertySnapshot

        logger = logging.getLogger(__name__)

        # Get all users who have snapshots
        user_result = await db.execute(
            select(User.id, User.preferred_currency).where(
                User.id.in_(
                    select(PortfolioSnapshot.owner_id).distinct()
                )
            )
        )
        users = list(user_result.all())

        updated = 0
        for user_id, pref_currency in users:
            preferred = pref_currency or "CZK"

            # Get all snapshots for this user
            snaps_result = await db.execute(
                select(PortfolioSnapshot).where(
                    PortfolioSnapshot.owner_id == user_id,
                ).order_by(PortfolioSnapshot.snapshot_date.asc())
            )
            snapshots = list(snaps_result.scalars().all())

            for snap in snapshots:
                y, m = snap.snapshot_date.year, snap.snapshot_date.month
                month_str = f"{y}-{m:02d}"
                rates = await get_rates_for_month(db, month_str)

                # Recalculate total_stocks from StockHoldingSnapshots
                stock_snaps = await db.execute(
                    select(StockHoldingSnapshot).where(
                        StockHoldingSnapshot.owner_id == user_id,
                        StockHoldingSnapshot.snapshot_month == month_str,
                        StockHoldingSnapshot.shares > Decimal("0.0001"),
                    )
                )
                new_total_stocks = 0.0
                for ss in stock_snaps.scalars():
                    mv = float(ss.market_value) if ss.market_value is not None else None
                    ti = float(ss.total_invested) if ss.total_invested is not None else 0
                    raw_value = mv if mv is not None else ti
                    new_total_stocks += PortfolioService._convert_amount(
                        float(raw_value), ss.currency, preferred, rates,
                    )
                new_total_stocks = round(new_total_stocks, 2)

                # Recalculate total_properties from PropertySnapshots + conversion
                prop_snaps = await db.execute(
                    select(PropertySnapshot, PropertyInvestment)
                    .join(PropertyInvestment, PropertySnapshot.property_id == PropertyInvestment.id)
                    .where(
                        PropertySnapshot.owner_id == user_id,
                        PropertySnapshot.snapshot_month == month_str,
                    )
                )
                new_total_props = 0.0
                for ps, prop in prop_snaps.all():
                    raw_value = float(ps.estimated_value)
                    currency = prop.currency or "CZK"
                    new_total_props += PortfolioService._convert_amount(
                        raw_value, currency, preferred, rates,
                    )
                new_total_props = round(new_total_props, 2)

                # Recalculate total_savings from statement closing balances
                new_total_savings = await PortfolioService._get_savings_for_month(
                    db, user_id, month_str,
                )

                # Delete all-zero snapshots (ghost data with no backing information)
                old_inv = float(snap.total_investments)
                all_zero = (
                    new_total_savings < 0.01
                    and old_inv < 0.01
                    and new_total_stocks < 0.01
                    and new_total_props < 0.01
                )
                if all_zero:
                    await db.delete(snap)
                    updated += 1
                    continue

                # Update if changed
                old_savings = float(snap.total_savings)
                old_stocks = float(snap.total_stocks)
                old_props = float(snap.total_properties) if snap.total_properties else 0.0
                if (abs(new_total_savings - old_savings) > 0.01
                        or abs(new_total_stocks - old_stocks) > 0.01
                        or abs(new_total_props - old_props) > 0.01):
                    snap.total_savings = Decimal(str(new_total_savings))
                    snap.total_stocks = Decimal(str(new_total_stocks))
                    snap.total_properties = Decimal(str(new_total_props))
                    updated += 1

        if updated:
            await db.flush()
            logger.info(f"Recalculated {updated} portfolio snapshots (includes ghost data cleanup)")
        return updated

    @staticmethod
    async def record_snapshot_for_date(
        db: AsyncSession, owner_id: int, target_date: date,
        preferred_currency: str = "CZK",
    ) -> None:
        """Create/update a snapshot for a specific date using statement data only.

        Savings: from Statement.closing_balance for the target month (not live balances).
        Stocks: from StockHoldingSnapshots for the target month (not current holdings).
        Investments: not touched (preserved via merge semantics).
        Properties: not touched (preserved via merge semantics).

        This ensures snapshots only reflect data that was actually imported
        for the specific month — no ghost data from current live values.
        """
        y, m = target_date.year, target_date.month
        month_str = f"{y}-{m:02d}"
        rates = await get_rates_for_month(db, month_str)

        # Savings: derive from statement closing_balance for this month only.
        # Returns 0.0 when no savings statement covers this month.
        total_savings = await PortfolioService._get_savings_for_month(
            db, owner_id, month_str,
        )

        # Stocks: from StockHoldingSnapshots for the target month.
        stock_snaps_result = await db.execute(
            select(StockHoldingSnapshot).where(
                StockHoldingSnapshot.owner_id == owner_id,
                StockHoldingSnapshot.snapshot_month == month_str,
                StockHoldingSnapshot.shares > Decimal("0.0001"),
            )
        )
        total_stocks = 0.0
        for ss in stock_snaps_result.scalars():
            mv = float(ss.market_value) if ss.market_value is not None else None
            ti_val = float(ss.total_invested) if ss.total_invested is not None else 0
            raw_value = mv if mv is not None else ti_val
            total_stocks += PortfolioService._convert_amount(
                float(raw_value), ss.currency, preferred_currency, rates,
            )
        total_stocks = round(total_stocks, 2)

        await PortfolioService.create_or_update_snapshot(
            db, owner_id, target_date, total_savings, None, total_stocks,
        )
