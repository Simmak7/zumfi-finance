from datetime import date as date_type, datetime
from decimal import Decimal
from pydantic import BaseModel


# --- Savings Account ---

class SavingsAccountCreate(BaseModel):
    name: str
    institution: str | None = None
    balance: Decimal
    interest_rate: Decimal | None = None
    currency: str = "CZK"
    notes: str | None = None
    color: str | None = None


class SavingsAccountUpdate(BaseModel):
    name: str | None = None
    institution: str | None = None
    balance: Decimal | None = None
    interest_rate: Decimal | None = None
    currency: str | None = None
    notes: str | None = None
    color: str | None = None
    status: str | None = None


class SavingsAccountResponse(BaseModel):
    id: int
    name: str
    institution: str | None
    balance: Decimal
    interest_rate: Decimal | None
    currency: str
    notes: str | None
    color: str | None
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Investment ---

class InvestmentCreate(BaseModel):
    name: str
    ticker: str | None = None
    investment_type: str  # etf, stock, bond, crypto, other
    units: Decimal
    avg_purchase_price: Decimal
    current_price: Decimal | None = None
    currency: str = "USD"
    notes: str | None = None
    color: str | None = None


class InvestmentUpdate(BaseModel):
    name: str | None = None
    ticker: str | None = None
    investment_type: str | None = None
    units: Decimal | None = None
    avg_purchase_price: Decimal | None = None
    current_price: Decimal | None = None
    currency: str | None = None
    notes: str | None = None
    color: str | None = None
    status: str | None = None


class InvestmentResponse(BaseModel):
    id: int
    name: str
    ticker: str | None
    investment_type: str
    units: Decimal
    avg_purchase_price: Decimal
    current_price: Decimal | None
    currency: str
    notes: str | None
    color: str | None
    status: str
    total_invested: Decimal
    current_value: Decimal | None
    gain_loss: Decimal | None
    gain_loss_pct: Decimal | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Stock Holding ---

class StockHoldingCreate(BaseModel):
    name: str
    ticker: str | None = None
    isin: str | None = None
    holding_type: str = "stock"  # stock, etf
    shares: Decimal
    avg_cost_per_share: Decimal
    current_price: Decimal | None = None
    currency: str = "CZK"
    notes: str | None = None
    color: str | None = None


class StockHoldingUpdate(BaseModel):
    name: str | None = None
    ticker: str | None = None
    isin: str | None = None
    holding_type: str | None = None
    shares: Decimal | None = None
    avg_cost_per_share: Decimal | None = None
    current_price: Decimal | None = None
    currency: str | None = None
    notes: str | None = None
    color: str | None = None
    status: str | None = None


class StockHoldingResponse(BaseModel):
    id: int
    name: str
    ticker: str | None
    isin: str | None = None
    holding_type: str
    shares: Decimal
    avg_cost_per_share: Decimal
    current_price: Decimal | None
    currency: str
    notes: str | None
    color: str | None
    status: str
    total_cost: Decimal
    market_value: Decimal | None
    gain_loss: Decimal | None
    gain_loss_pct: Decimal | None
    created_at: datetime
    updated_at: datetime
    converted_value: float | None = None
    snapshot_month: str | None = None

    model_config = {"from_attributes": True}


# --- Stock Holding Snapshots ---

class StockHoldingSnapshotResponse(BaseModel):
    ticker: str
    currency: str
    name: str
    holding_type: str
    shares: Decimal
    price: Decimal | None
    market_value: Decimal | None

    model_config = {"from_attributes": True}


class StockHistoryMonth(BaseModel):
    month: str
    total_value: float
    holdings: list[StockHoldingSnapshotResponse]


# --- Stock Currency Breakdown ---

class CurrencyBreakdownItem(BaseModel):
    currency: str
    original_amount: float
    exchange_rate: float | None = None
    converted_amount: float


class MonthlyConvertedValue(BaseModel):
    month: str
    total_converted: float


class StockBreakdownResponse(BaseModel):
    total_converted: float
    total_cost_converted: float = 0.0
    preferred_currency: str
    currency_breakdown: list[CurrencyBreakdownItem]
    rates_date: str
    monthly_history: list[MonthlyConvertedValue]


# --- Stock Trades (P&L) ---

class StockTradeResponse(BaseModel):
    id: int
    ticker: str
    name: str
    isin: str | None = None
    country: str | None = None
    currency: str
    date_acquired: date_type | None = None
    date_sold: date_type | None = None
    quantity: Decimal
    cost_basis: Decimal
    gross_proceeds: Decimal
    gross_pnl: Decimal
    fees: Decimal
    cost_basis_czk: Decimal | None = None
    gross_proceeds_czk: Decimal | None = None
    gross_pnl_czk: Decimal | None = None
    rate_buy: Decimal | None = None
    rate_sell: Decimal | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class StockDividendResponse(BaseModel):
    id: int
    ticker: str | None = None
    name: str | None = None
    isin: str | None = None
    currency: str
    date: date_type | None = None
    description: str | None = None
    gross_amount: Decimal
    withholding_tax: Decimal
    net_amount: Decimal
    created_at: datetime

    model_config = {"from_attributes": True}


class StockPnlSummary(BaseModel):
    total_realized_pnl: float
    total_realized_pnl_czk: float
    total_cost_basis: float
    total_proceeds: float
    total_fees: float
    total_dividends: float
    total_withholding_tax: float
    trades: list[StockTradeResponse]
    dividends: list[StockDividendResponse]


# --- Portfolio Summary ---

class AllocationItem(BaseModel):
    name: str
    value: float
    percentage: float
    color: str | None = None


class PortfolioSummary(BaseModel):
    total_savings: float
    total_investments_value: float
    total_investments_cost: float
    total_stocks_value: float = 0.0
    total_stocks_cost: float = 0.0
    total_portfolio: float
    overall_gain_loss: float
    overall_gain_loss_pct: float
    stocks_gain_loss: float = 0.0
    stocks_gain_loss_pct: float = 0.0
    savings_accounts: list[SavingsAccountResponse]
    investments: list[InvestmentResponse]
    stock_holdings: list[StockHoldingResponse] = []
    allocation: list[AllocationItem]
    month: str | None = None
    is_historical: bool = False
    is_closed: bool = False
    previous_total_savings: float | None = None
    previous_total_investments: float | None = None
    previous_total_stocks: float | None = None
    previous_total_portfolio: float | None = None
    preferred_currency: str = "CZK"
    total_properties_value: float = 0.0
    total_properties_cost: float = 0.0
    properties: list = []
    previous_total_properties: float | None = None


# --- Property Investment ---

class PropertyCreate(BaseModel):
    name: str
    property_type: str  # flat, house
    country: str | None = "Czech Republic"
    city: str | None = None
    address: str | None = None
    square_meters: Decimal
    rooms: int | None = None
    has_balcony: bool = False
    has_garden: bool = False
    has_parking: bool = False
    renovation_state: str = "good"  # new, good, needs_renovation
    floor: str | None = None  # ground, middle, top
    purchase_price: Decimal
    price_per_sqm: Decimal | None = None
    estimated_value: Decimal | None = None
    currency: str = "CZK"
    purchase_date: date_type | None = None
    notes: str | None = None
    color: str | None = None


class PropertyUpdate(BaseModel):
    name: str | None = None
    property_type: str | None = None
    country: str | None = None
    city: str | None = None
    address: str | None = None
    square_meters: Decimal | None = None
    rooms: int | None = None
    has_balcony: bool | None = None
    has_garden: bool | None = None
    has_parking: bool | None = None
    renovation_state: str | None = None
    floor: str | None = None
    purchase_price: Decimal | None = None
    price_per_sqm: Decimal | None = None
    estimated_value: Decimal | None = None
    currency: str | None = None
    purchase_date: date_type | None = None
    notes: str | None = None
    color: str | None = None
    status: str | None = None


class PropertyResponse(BaseModel):
    id: int
    name: str
    property_type: str
    country: str | None
    city: str | None
    address: str | None
    square_meters: Decimal
    rooms: int | None
    has_balcony: bool
    has_garden: bool
    has_parking: bool
    renovation_state: str
    floor: str | None
    purchase_price: Decimal
    price_per_sqm: Decimal | None
    estimated_value: Decimal | None
    currency: str
    purchase_date: date_type | None
    notes: str | None
    color: str | None
    status: str
    # Computed fields
    computed_value: float | None = None
    display_value: float | None = None
    gain_loss: float | None = None
    gain_loss_pct: float | None = None
    converted_value: float | None = None
    converted_purchase_price: float | None = None
    converted_gain_loss: float | None = None
    display_currency: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
