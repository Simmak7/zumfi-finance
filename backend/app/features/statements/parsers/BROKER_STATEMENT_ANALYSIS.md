# Broker/Investment Platform Statement Format Analysis — 25 Brokers

> Generated: 2026-03-02
> Purpose: Comprehensive analysis of investment broker statement formats for building parsers
> Application: Zumfi Finance App (stock/ETF statement import → holdings, trades, dividends)

---

## Table of Contents

1. [Application Data Requirements](#application-data-requirements)
2. [Pan-European Neobrokers (9)](#pan-european-neobrokers)
3. [Czech Republic Brokers (4)](#czech-republic-brokers)
4. [Major National Brokers (8)](#major-national-brokers)
5. [Nordic Brokers (2)](#nordic-brokers)
6. [Additional Platforms (2)](#additional-platforms)
7. [Cross-Broker Comparison Tables](#cross-broker-comparison-tables)
8. [Implementation Strategy](#implementation-strategy)

---

## Application Data Requirements

The application tracks three types of investment data:

### 1. Holdings (StockHolding + StockHoldingSnapshot)
```python
{
    "ticker": str,              # Exchange ticker symbol
    "name": str,                # Company/fund name
    "isin": str,                # ISIN code
    "holding_type": str,        # "stock" or "etf"
    "shares": float,            # Quantity held
    "avg_cost_per_share": float, # Average cost basis
    "current_price": float,     # Latest market price
    "currency": str,            # USD, EUR, CZK, GBP, etc.
}
```

### 2. Trades (StockTrade — realized P&L)
```python
{
    "ticker": str,
    "name": str,
    "isin": str,
    "country": str,             # Country code (US, DE, etc.)
    "currency": str,
    "date_acquired": date,
    "date_sold": date,
    "quantity": float,
    "cost_basis": float,        # Total cost of acquired shares
    "gross_proceeds": float,    # Total sale proceeds
    "gross_pnl": float,         # Realized profit/loss
    "fees": float,              # Trading fees
    "cost_basis_czk": float,    # CZK equivalent
    "gross_proceeds_czk": float,
    "gross_pnl_czk": float,
    "rate_buy": float,          # CZK exchange rate at purchase
    "rate_sell": float,         # CZK exchange rate at sale
}
```

### 3. Dividends (StockDividend)
```python
{
    "ticker": str,
    "name": str,
    "isin": str,
    "country": str,
    "currency": str,
    "date": date,
    "description": str,         # "dividend", "custody fee", etc.
    "gross_amount": float,
    "withholding_tax": float,
    "net_amount": float,
}
```

### Currently Implemented
- **Revolut Securities** — `parsers/revolut_stocks.py` (portfolio breakdown + transactions)
- **Revolut P&L** — `parsers/revolut_pnl.py` (realized trades + dividends with CZK conversions)

---

## PAN-EUROPEAN NEOBROKERS

### 1. Interactive Brokers (IBKR) — ~2.6M users globally

**Priority**: HIGH — Most comprehensive data of any broker

**Detection Keywords**: `"Interactive Brokers"`, `"IBKR"`, `"IB Group"`, `"TWS"`, `"Flex Query"`

**Available Formats**: CSV, XML (Flex Queries), PDF statements, OFX, API (Client Portal REST + TWS)

#### CSV Trade History (Activity Statement)
**Delimiter**: Comma (`,`)
**Date format**: `YYYY-MM-DD, HH:MM:SS` (ISO-like)
**Amount format**: Dot decimal, no thousands separator in CSV
**Encoding**: UTF-8

**Trade columns** (default Activity Statement CSV):
```
Trades,Header,DataDiscriminator,Asset Category,Currency,Symbol,Date/Time,Quantity,T. Price,C. Price,Proceeds,Comm/Fee,Basis,Realized P&L,MTM P&L,Code
```

| Column | Maps To |
|--------|---------|
| `Symbol` | ticker |
| `Date/Time` | date_sold (for sells) |
| `Quantity` | quantity (negative = sell) |
| `T. Price` | price |
| `Proceeds` | gross_proceeds |
| `Comm/Fee` | fees |
| `Basis` | cost_basis |
| `Realized P&L` | gross_pnl |
| `Asset Category` | "Stocks", "Equity and Index Options", "ETFs" → holding_type |
| `Currency` | currency |

**Flex Query** (most powerful — customizable XML/CSV):
- Can request ISIN, SEDOL, CUSIP, settlement date, exchange, lot-level detail
- Columns fully configurable: `TradeDate`, `SettleDateTarget`, `Symbol`, `ISIN`, `Description`, `AssetCategory`, `CurrencyPrimary`, `Quantity`, `TradePrice`, `TradeMoney`, `Proceeds`, `IBCommission`, `NetCash`, `CostBasisMoney`, `FifoPnlRealized`, `MtmPnl`
- Dividends: `Date`, `Symbol`, `ISIN`, `Description`, `Amount`, `Tax`, `Code` (withholding tax separate)
- Open Positions: `Symbol`, `ISIN`, `Quantity`, `CostBasisMoney`, `CostBasisPrice`, `MarkPrice`, `PositionValue`, `UnrealizedPnL`

#### Dividend Reporting
Dividends and withholding tax are SEPARATE rows in the CSV:
```
Dividends,Data,USD,AAPL,2024-06-15,APPLE INC - CASH DIVIDEND 0.24 PER SHARE,48.00
Withholding Tax,Data,USD,AAPL,2024-06-15,APPLE INC - CASH DIVIDEND 0.24 PER SHARE,-7.20
```
Must match by date + symbol to combine gross/tax/net.

#### Holdings/Portfolio
Open Positions section in Activity Statement:
```
Symbol,Quantity,Close Price,Value,Avg Cost,Unrealized P&L,Code
```

#### Cost Basis: FIFO (default), configurable to LIFO, Highest Cost, Specific Lot
#### Multi-currency: Full support. Each section grouped by currency. FX rates in separate section.
#### API: Client Portal REST API, TWS API, Flex Queries (HTTPS)

---

### 2. DEGIRO (flatexDEGIRO) — ~2.5M users

**Priority**: HIGH — Very popular in EU, used by many Czech investors

**Detection Keywords**: `"DEGIRO"`, `"flatexDEGIRO"`, `"degiro.cz"`, `"degiro.nl"`, `"Producttype"`

**Available Formats**: CSV (transactions, account), XLS (portfolio), PDF (annual/quarterly)

#### CSV Trade History (Transactions export)
**Delimiter**: Locale-dependent! Semicolon (`;`) for NL/DE/CZ, Comma (`,`) for EN
**Date format**: `DD-MM-YYYY HH:MM` (NL/CZ) or `YYYY-MM-DD HH:MM` (EN)
**Amount format**: Comma decimal for NL/DE/CZ (`1.234,56`), Dot decimal for EN
**Encoding**: UTF-8

**Columns** (Transactions CSV):
```
Datum;Tijd;Product;ISIN;Beurs;Uitvoeringsplaats;Aantal;Koers;;Lokale waarde;;Waarde;;Wisselkoers;Transactiekosten;;Totaal;;Order Id
```

English variant:
```
Date,Time,Product,ISIN,Reference Exchange,Execution Venue,Quantity,Price,,Local value,,Value,,Exchange rate,Transaction and/or third,,Total,,Order ID
```

| Column | Maps To |
|--------|---------|
| `Product` | name |
| `ISIN` | isin (PRIMARY identifier — DEGIRO does NOT provide ticker!) |
| `Date` + `Time` | date |
| `Quantity` | quantity (positive = buy, negative = sell) |
| `Price` | price per share |
| `Value` | total value in account currency |
| `Local value` | value in trading currency |
| `Exchange rate` | FX rate applied |
| `Transaction and/or third` | fees |
| `Total` | net amount |

**IMPORTANT**: DEGIRO uses ISIN as the primary identifier, NOT ticker symbols. You need an ISIN-to-ticker mapping.

#### Dividend Reporting
Dividends appear in the Account Statement CSV (NOT the Transactions CSV):
```
Date,Time,Product,ISIN,Description,FX,Change,,Balance,,Order Id
03-06-2024,08:00,APPLE INC,US0378331005,Dividend,,48.00,,1234.56,,
03-06-2024,08:00,APPLE INC,US0378331005,Dividend Tax,,-7.20,,1227.36,,
```
Dividend and tax are separate rows — match by date + ISIN.

#### Holdings/Portfolio
Portfolio CSV/XLS (from Portfolio page):
```
Product,Symbol/ISIN,Quantity,Closing Price,,Value,,
```

#### Cost Basis: Average Cost (display) / FIFO (for tax)
#### Multi-currency: Account currency (EUR typically). Local values shown alongside converted values. FX rate column.

---

### 3. Trading 212 — ~3M users

**Priority**: HIGH — Very popular with younger European investors

**Detection Keywords**: `"Trading 212"`, `"trading212"`, `"T212"`, `"Action,Time,ISIN"`, `"Result (EUR)"`

**Available Formats**: CSV (comprehensive), PDF statements

#### CSV Trade History
**Delimiter**: Comma (`,`)
**Date format**: `YYYY-MM-DD HH:MM:SS` (ISO)
**Amount format**: Dot decimal, no thousands separator
**Encoding**: UTF-8

**Columns**:
```
Action,Time,ISIN,Ticker,Name,No. of shares,Price / share,Currency (Price / share),Exchange rate,Result (EUR),Result,Currency (Result),Total (EUR),Total,Currency (Total),Withholding tax,Currency (Withholding tax),Charge amount (EUR),Stamp duty reserve tax (EUR),Notes,ID,Currency conversion fee (EUR)
```

| Column | Maps To |
|--------|---------|
| `Action` | "Market buy", "Market sell", "Limit buy", "Limit sell", "Dividend (Ordinary)", "Dividend (Dividend)", "Interest on cash" |
| `Time` | date |
| `ISIN` | isin |
| `Ticker` | ticker |
| `Name` | name |
| `No. of shares` | quantity (fractional supported) |
| `Price / share` | price |
| `Currency (Price / share)` | original currency |
| `Exchange rate` | FX rate |
| `Result (EUR)` | gross_pnl (for sells) |
| `Total (EUR)` | total value in account currency |
| `Withholding tax` | withholding_tax |
| `Charge amount (EUR)` | fees |
| `Stamp duty reserve tax (EUR)` | UK stamp duty |
| `Currency conversion fee (EUR)` | FX fee |

**EXCELLENT FORMAT** — One of the cleanest CSV exports. All data in a single file. Dividends and trades mixed together, distinguished by `Action` column.

#### Dividend Reporting
Inline in the same CSV:
```
Dividend (Ordinary),2024-06-15 10:00:00,US0378331005,AAPL,Apple Inc,10,,,,,48.00,USD,40.80,,,7.20,USD,,,,abc123,
```

Fields: `Withholding tax` column has the WHT amount. Gross = Total + Withholding tax.

#### Holdings: Must be computed from transaction history (no separate portfolio export CSV)
#### Cost Basis: Section 104 pooling (UK average cost)
#### Multi-currency: Account in EUR/GBP. FX rate and converted values shown alongside original currency.

---

### 4. eToro — ~35M users globally

**Priority**: MEDIUM — Large user base but complex format

**Detection Keywords**: `"eToro"`, `"etoro.com"`, `"Account Statement"`, `"Copy Trading"`

**Available Formats**: Excel (.xlsx — primary), PDF statements

#### Excel Trade History (Account Statement)
**Format**: Multi-sheet Excel workbook (.xlsx)
**Date format**: `DD/MM/YYYY HH:MM:SS`
**Amount format**: Dot decimal
**Sheets**:
1. **Account Summary** — Start/end balance, deposits, withdrawals, fees
2. **Closed Positions** — Realized trades
3. **Transactions** — All transactions (deposits, trades, dividends, fees)
4. **Dividends** — Dividend payments
5. **Financial Summary** — Tax-relevant summary

**Closed Positions columns**:
```
Position ID,Action,Amount,Units,Open Rate,Close Rate,Spread,Profit,Open Date,Close Date,Take Profit Rate,Stop Loss Rate,Rollover Fees And Dividends,Copied From,Type,ISIN,Notes
```

| Column | Maps To |
|--------|---------|
| `Action` | "Buy"/"Sell" (direction of position) |
| `Amount` | cost_basis |
| `Units` | quantity |
| `Open Rate` | purchase price |
| `Close Rate` | sale price |
| `Profit` | gross_pnl |
| `Open Date` | date_acquired |
| `Close Date` | date_sold |
| `ISIN` | isin |
| `Type` | "Real" (actual stock) or "CFD" |
| `Rollover Fees And Dividends` | includes overnight fees |

**Dividends sheet columns**:
```
Date of Payment,Instrument Name,Net Dividend Received (USD),Withholding Tax Rate (%),Withholding Tax Amount (USD),Position ID,Type,ISIN
```

#### Cost Basis: Per-position (each position tracked individually)
#### Multi-currency: USD-denominated account. All values in USD.
#### IMPORTANT: eToro shows CFD and real stock positions — filter by `Type == "Real"` for actual holdings

---

### 5. Trade Republic — ~4M users

**Priority**: HIGH — Fastest growing European neobroker

**Detection Keywords**: `"Trade Republic"`, `"traderepublic"`, `"Wertpapierabrechnung"`, `"Datum;Typ;ISIN"`, `"Ausführung"`

**Available Formats**: PDF (individual trade confirmations + periodic statements), CSV (transaction export)

#### CSV Trade History
**Delimiter**: Semicolon (`;`)
**Date format**: `DD.MM.YYYY` (German)
**Amount format**: Comma decimal (`1.234,56`) — German format
**Encoding**: UTF-8

**Columns** (Transaction export):
```
Datum;Typ;ISIN;Beschreibung;Stück;Kurs;Betrag;Gebühren;Steuern;Gesamt
```

| Column | Maps To | Notes |
|--------|---------|-------|
| `Datum` | date | DD.MM.YYYY |
| `Typ` | action | "Kauf" (buy), "Verkauf" (sell), "Dividende", "Sparplanausführung" (savings plan), "Zinsen" (interest) |
| `ISIN` | isin | PRIMARY identifier (no ticker!) |
| `Beschreibung` | name | Security name in German |
| `Stück` | quantity | Comma decimal (fractional) |
| `Kurs` | price | Comma decimal |
| `Betrag` | total value | |
| `Gebühren` | fees | Usually €1 per trade |
| `Steuern` | taxes | German withholding tax (Abgeltungssteuer) |
| `Gesamt` | net amount | |

**NO TICKER** — Trade Republic only provides ISIN. Need ISIN-to-ticker mapping.

#### PDF Statement Structure (Wertpapierabrechnung)
Each trade generates a separate 1-page PDF:
- Header: "Trade Republic Bank GmbH", client name
- "WERTPAPIERABRECHNUNG" title
- Details: ISIN, Wertpapier (security name), Handelsplatz (venue), Datum (date)
- Stück (quantity), Kurs (price), Kurswert (market value)
- Provision (commission), Gesamt (total)
- Settlement details

#### Dividend Reporting
Dividends in CSV as `Typ = "Dividende"`:
```
15.06.2024;Dividende;US0378331005;Apple Inc;10;0,24;2,40;0;0,63;1,77
```
`Steuern` column contains the German withholding tax. For foreign dividends, the WHT is pre-applied and may show in `Gebühren` or description.

#### Holdings: No portfolio snapshot export. Must compute from transactions.
#### Cost Basis: FIFO (German tax law — §23 EStG)
#### Multi-currency: EUR-denominated. FX conversion automatic, rate shown on PDF confirmations.

---

### 6. Scalable Capital — ~1M users

**Priority**: MEDIUM — Growing German broker

**Detection Keywords**: `"Scalable Capital"`, `"scalable.capital"`, `"Scalable Broker"`, `"Baader Bank"` (custodian)

**Available Formats**: CSV (transaction export), PDF (statements, tax reports)

#### CSV Trade History
**Delimiter**: Semicolon (`;`)
**Date format**: `DD.MM.YYYY` (German)
**Amount format**: Comma decimal (`1.234,56`)
**Encoding**: UTF-8

**Columns**:
```
Datum;Typ;ISIN;Wertpapier;Anteile;Kurs;Betrag;Gebühren;Steuern
```

Almost identical to Trade Republic format. Same German conventions.

| Column | Maps To |
|--------|---------|
| `Datum` | date |
| `Typ` | "Kauf", "Verkauf", "Dividende", "Ausschüttung" (distribution), "Sparplan" |
| `ISIN` | isin (no ticker) |
| `Wertpapier` | name |
| `Anteile` | quantity |
| `Kurs` | price |
| `Betrag` | total value |
| `Gebühren` | fees |
| `Steuern` | German tax withheld |

#### Dividend: Same as Trade Republic — `Typ = "Dividende"` or `"Ausschüttung"`
#### Cost Basis: FIFO (German law)
#### Multi-currency: EUR only. FX implicit.

---

### 7. XTB — ~1M users

**Priority**: MEDIUM-HIGH — Popular in CZ and Poland

**Detection Keywords**: `"XTB"`, `"X-Trade Brokers"`, `"xtb.com"`, `"xStation"`, `"XTB S.A."`

**Available Formats**: CSV/Excel (transaction history), PDF statements

#### CSV Trade History
**Delimiter**: Locale-dependent (`;` for PL/CZ, `,` for EN)
**Date format**: `YYYY-MM-DD HH:MM:SS` (ISO)
**Amount format**: Locale-dependent (comma decimal for PL/CZ, dot for EN)
**Encoding**: UTF-8

**Columns** (English):
```
Symbol,Type,Time,Comment,Volume,Price,Commission,Profit,Swap,Open Price,Close Price,Open Time,Close Time
```

| Column | Maps To |
|--------|---------|
| `Symbol` | ticker (XTB's own format, e.g., "AAPL.US", "VOW3.DE") |
| `Type` | "Buy", "Sell" |
| `Open Time` | date_acquired |
| `Close Time` | date_sold |
| `Volume` | quantity (in lots or shares depending on instrument) |
| `Open Price` | purchase price |
| `Close Price` | sale price |
| `Commission` | fees |
| `Profit` | gross_pnl |
| `Swap` | overnight fees |

**Note**: XTB uses custom ticker format with exchange suffix: `AAPL.US`, `SAP.DE`, `VOW3.DE`

#### Dividend Reporting
Dividends in a separate report or as `Type = "Dividend"` rows:
```
Symbol,Type,Time,Comment,Amount
AAPL.US,Dividend,2024-06-15 10:00:00,Cash dividend USD 0.24 per share,48.00
```
Withholding tax may be in a separate line or embedded in `Comment`.

#### Holdings: Position report from xStation platform
#### Cost Basis: Per-position (each trade tracked individually)
#### Multi-currency: Account in EUR/CZK/PLN/USD. Instruments traded in native currency. FX conversion on settlement.

---

### 8. Trading Republic (Lightyear) — ~500K users

**Priority**: LOW-MEDIUM

**Detection Keywords**: `"Lightyear"`, `"lightyear.com"`, `"Lightyear Financial"`

**Available Formats**: CSV (transaction export), PDF statements

#### CSV Trade History
**Delimiter**: Comma (`,`)
**Date format**: `YYYY-MM-DD` (ISO)
**Amount format**: Dot decimal
**Encoding**: UTF-8

**Columns**:
```
Date,Type,Ticker,ISIN,Name,Quantity,Price,Currency,Total,Fees,FX Rate,Amount (Account Currency)
```

Clean format, similar to Trading 212 in structure.

#### Dividends: Inline as `Type = "Dividend"` with WHT in separate column
#### Cost Basis: Average cost
#### Multi-currency: EUR-based. FX rate column for foreign trades.

---

### 9. BUX Zero — ~500K users

**Priority**: LOW

**Detection Keywords**: `"BUX"`, `"BUX Zero"`, `"bux.com"`, `"BUX Financial Services"`

**Available Formats**: CSV (transaction export), PDF annual statements

#### CSV Trade History
**Delimiter**: Comma (`,`) or Semicolon (`;`)
**Date format**: `DD-MM-YYYY` or `YYYY-MM-DD`
**Amount format**: Dot decimal
**Encoding**: UTF-8

**Columns**:
```
Date,Type,Product,ISIN,Quantity,Price,Amount,Currency,Fees
```

Simple format. ISIN as primary identifier.

---

## CZECH REPUBLIC BROKERS

### 10. Fio e-Broker — ~1M+ users (Fio banka)

**Priority**: HIGHEST — Most popular Czech broker

**Detection Keywords**: `"Fio e-Broker"`, `"fio banka"`, `"e-Broker"`, `"ebroker.fio.cz"`, `"Fio banka, a.s."`

**Available Formats**: CSV, PDF, GPC, OFX, JSON (via API), XML

#### CSV Trade History
**Delimiter**: Semicolon (`;`)
**Date format**: `dd.mm.yyyy` (Czech)
**Amount format**: Comma decimal, space thousands (`1 234,56`)
**Encoding**: Windows-1250

**Columns** (Obchody / Trades):
```
Datum;Čas;Ticker;ISIN;Název;Typ;Množství;Cena;Měna;Objem;Poplatky;Celkem;Trh
```

| Column | Maps To |
|--------|---------|
| `Datum` | date (dd.mm.yyyy) |
| `Čas` | time |
| `Ticker` | ticker |
| `ISIN` | isin |
| `Název` | name |
| `Typ` | "Nákup" (buy), "Prodej" (sell) |
| `Množství` | quantity |
| `Cena` | price per share |
| `Měna` | currency (CZK, USD, EUR) |
| `Objem` | total value |
| `Poplatky` | fees |
| `Celkem` | net amount |
| `Trh` | market/exchange |

#### Dividend Reporting (Výpis z účtu / Account Statement)
Dividends appear as entries with description:
```
Datum;Popis;Ticker;ISIN;Částka;Měna;Srážková daň;Čistá částka
```
"Dividenda" or "Výplata dividend" in description. Withholding tax in `Srážková daň` column.

#### Holdings/Portfolio (Stav portfolia)
```
Ticker;ISIN;Název;Množství;Nákupní cena;Aktuální cena;Tržní hodnota;Zisk/Ztráta;Zisk/Ztráta %;Měna
```

| Column | Maps To |
|--------|---------|
| `Ticker` | ticker |
| `ISIN` | isin |
| `Název` | name |
| `Množství` | shares |
| `Nákupní cena` | avg_cost_per_share |
| `Aktuální cena` | current_price |
| `Tržní hodnota` | market_value |
| `Zisk/Ztráta` | unrealized P&L |
| `Měna` | currency |

#### Fio API (Unique advantage!)
- REST API: `https://www.fio.cz/ib_api/rest/`
- Returns: JSON, XML, CSV, GPC, OFX
- Transaction history endpoint with token-based auth
- Can programmatically fetch all transactions without manual export

#### Cost Basis: FIFO (Czech tax law)
#### Multi-currency: Native multi-currency accounts (CZK, EUR, USD). Trades shown in trading currency.
#### Tax Report: "Podklady pro daňové přiznání" — Czech tax document with realized gains in CZK

---

### 11. Portu (Erste Group / Česká spořitelna) — ~100K users

**Priority**: MEDIUM — Growing Czech robo-advisor

**Detection Keywords**: `"Portu"`, `"portu.cz"`, `"Erste Asset Management"`, `"investiční strategie"`

**Available Formats**: PDF (quarterly/annual statements), CSV (limited portfolio export)

#### PDF Statement Structure
Portu is a robo-advisor — statements show portfolio allocations, not individual trades:

1. **Header**: "Portu" branding, client name, portfolio strategy name
2. **Portfolio Summary**: Total value, total invested, profit/loss, return %
3. **Asset Allocation**: ETF breakdown with:
   - ETF name, ISIN
   - Allocation % (target vs actual)
   - Quantity, price, value
4. **Transaction History**: Deposits, withdrawals, rebalancing trades
5. **Fee Summary**: Management fee (0.9-1.2% p.a.)

**Key fields in PDF**:
- ETF name + ISIN for each holding
- Quantity, price (EUR), value
- Total invested vs current value = P&L

#### Dividend Reporting: ETFs in Portu are typically accumulating (reinvesting), so no direct dividend payouts. Distributing ETFs show "Výplata výnosu".

#### Cost Basis: Average cost (managed portfolio)
#### Multi-currency: Portfolios in EUR or CZK. FX rate shown.
#### Czech Language: Fully Czech statements

---

### 12. Fondee — ~50K users

**Priority**: LOW-MEDIUM — Czech robo-advisor

**Detection Keywords**: `"Fondee"`, `"fondee.cz"`, `"Fondee a.s."`

**Available Formats**: PDF (statements), limited CSV

#### PDF Statement Structure
Similar to Portu — robo-advisor format:
1. Portfolio strategy overview
2. ETF holdings with ISIN, quantity, value
3. Transaction history (deposits, auto-rebalancing)
4. Performance summary (TWR return %)
5. Fee disclosure

#### Cost Basis: Average cost
#### Czech Language: Fully Czech

---

### 13. Patria Finance — ~100K users

**Priority**: MEDIUM — Traditional Czech broker

**Detection Keywords**: `"Patria"`, `"Patria Finance"`, `"patria.cz"`, `"CPBS"`, `"patria-direct"`

**Available Formats**: CSV/Excel (trade history, portfolio), PDF (statements, tax reports)

#### CSV Trade History (Obchody)
**Delimiter**: Semicolon (`;`)
**Date format**: `dd.mm.yyyy` (Czech)
**Amount format**: Comma decimal
**Encoding**: Windows-1250

**Columns**:
```
Datum obchodu;Datum vypořádání;Typ;Ticker;ISIN;Název;Množství;Cena;Měna;Objem;Poplatek;Celkem;Trh;Pokyn
```

| Column | Maps To |
|--------|---------|
| `Datum obchodu` | trade date |
| `Datum vypořádání` | settlement date |
| `Typ` | "Nákup", "Prodej" |
| `Ticker` | ticker |
| `ISIN` | isin |
| `Název` | name |
| `Množství` | quantity |
| `Cena` | price |
| `Měna` | currency |
| `Objem` | gross value |
| `Poplatek` | fees |
| `Celkem` | net amount |

#### Tax Report ("Podklady pro daňové přiznání")
```
ISIN;Název;Datum nákupu;Datum prodeje;Množství;Nákupní cena CZK;Prodejní cena CZK;Zisk/Ztráta CZK;Kurz nákup;Kurz prodej
```
All values converted to CZK with exchange rates — directly usable for `StockTrade.cost_basis_czk`, `gross_proceeds_czk`, `rate_buy`, `rate_sell`.

#### Holdings: Portfolio CSV with Ticker, ISIN, Name, Quantity, Avg Cost, Current Price, Value, P&L
#### Cost Basis: FIFO (Czech tax law)
#### Multi-currency: CZK, EUR, USD accounts

---

### 14. Finax (Slovakia/CZ) — Robo-advisor

**Priority**: LOW-MEDIUM

**Detection Keywords**: `"Finax"`, `"finax.eu"`, `"Finax, o.c.p."`

**Available Formats**: PDF (statements), limited CSV

Similar to Portu/Fondee robo-advisor format. ETF portfolios with ISIN, quantity, value. Slovak/Czech language.

---

## MAJOR NATIONAL BROKERS

### 15. Saxo Bank — ~1M users globally

**Priority**: MEDIUM — Comprehensive platform

**Detection Keywords**: `"Saxo Bank"`, `"saxobank"`, `"SaxoTrader"`, `"Saxo Markets"`

**Available Formats**: CSV, Excel, PDF, API (OpenAPI — REST, OAuth 2.0)

#### CSV Trade History
**Delimiter**: Comma (`,`)
**Date format**: `YYYY-MM-DDTHH:MM:SS` (ISO 8601)
**Amount format**: Dot decimal
**Encoding**: UTF-8

**Columns**:
```
Trade Date,Settlement Date,Account,Symbol,ISIN,Instrument,Asset Type,Trade Type,Direction,Quantity,Price,Currency,Amount,Commission,Exchange Rate,P&L
```

| Column | Maps To |
|--------|---------|
| `Trade Date` | date |
| `Settlement Date` | settlement date |
| `Symbol` | ticker |
| `ISIN` | isin |
| `Instrument` | name |
| `Asset Type` | "Stock", "ETF", "Bond", "Fund" → holding_type |
| `Direction` | "Buy" / "Sell" |
| `Quantity` | quantity |
| `Price` | price |
| `Commission` | fees |
| `P&L` | gross_pnl (for closed positions) |
| `Exchange Rate` | FX rate |

#### Dividends: Separate CSV or inline as `Trade Type = "Corporate Action"`, `Direction = "Dividend"`
#### Holdings: Position report CSV with full details
#### Cost Basis: FIFO (default)
#### API: OpenAPI (REST) — comprehensive, OAuth 2.0, covers accounts, positions, trades, prices

---

### 16. Swissquote — ~600K users

**Priority**: LOW-MEDIUM

**Detection Keywords**: `"Swissquote"`, `"swissquote.ch"`, `"Swissquote Bank SA"`

**Available Formats**: CSV, PDF statements

#### CSV Trade History
**Delimiter**: Semicolon (`;`)
**Date format**: `DD.MM.YYYY`
**Amount format**: Dot decimal, apostrophe thousands (`1'234.56` — Swiss format!)
**Encoding**: UTF-8

**Columns**:
```
Date;Time;Symbol;ISIN;Security Name;Transaction;Quantity;Price;Currency;Amount;Fees;Total;Exchange Rate
```

**SPECIAL**: Swiss apostrophe thousands separator (`1'234.56`). Need `clean_amount()` extension.

#### Cost Basis: Average cost (display)
#### Multi-currency: CHF base, multi-currency trading

---

### 17. Hargreaves Lansdown — ~1.8M users

**Priority**: MEDIUM (for UK users)

**Detection Keywords**: `"Hargreaves Lansdown"`, `"HL"`, `"hargreaveslansdown.co.uk"`, `"Fund and Share Account"`, `"Stocks & Shares ISA"`

**Available Formats**: CSV (transaction and portfolio), PDF statements

#### CSV Trade History
**Delimiter**: Comma (`,`)
**Date format**: `DD/MM/YYYY`
**Amount format**: Dot decimal. **UK share prices in PENCE** (divide by 100 for GBP!)
**Encoding**: UTF-8

**Columns** (Dealing History):
```
Trade Date,Settlement Date,Type,Stock,Stock Code,SEDOL,ISIN,Buy/Sell,Quantity,Price (p),Consideration,Commission,Stamp Duty,PTM Levy,Total Cost
```

| Column | Maps To |
|--------|---------|
| `Trade Date` | date |
| `Stock` | name |
| `Stock Code` | ticker (EPIC code) |
| `SEDOL` | UK identifier |
| `ISIN` | isin |
| `Buy/Sell` | "Buy"/"Sell" |
| `Quantity` | quantity |
| `Price (p)` | price IN PENCE (÷100 for GBP!) |
| `Consideration` | gross_proceeds |
| `Commission` | fees |
| `Stamp Duty` | additional fee (0.5% on UK buys) |

#### Dividends:
```
Date,Stock,SEDOL,Type,Shares Held,Rate per Share (p),Gross Amount,Tax Deducted,Net Amount
```

#### Holdings:
```
Stock,Stock Code,SEDOL,Quantity,Price (p),Value (GBP),Book Cost (GBP),Gain/Loss (GBP),Gain/Loss (%)
```

#### Cost Basis: Section 104 pooling (UK average cost)
#### IMPORTANT: Prices in pence for UK shares!

---

### 18. AJ Bell — ~500K users

**Priority**: LOW-MEDIUM

**Detection Keywords**: `"AJ Bell"`, `"Youinvest"`, `"AJ Bell Securities"`, `"ajbell.co.uk"`

Very similar to Hargreaves Lansdown format. Same UK conventions (prices in pence, SEDOL identifiers, Section 104 cost basis).

---

### 19. Freetrade — ~1M users

**Priority**: MEDIUM

**Detection Keywords**: `"Freetrade"`, `"Freetrade Limited"`, `"Instrument ISIN"`, `"Dividend Withheld Tax Percentage"`

**Available Formats**: CSV (comprehensive!), PDF statements

#### CSV Trade History — BEST DIVIDEND FORMAT
**Delimiter**: Comma (`,`)
**Date format**: `YYYY-MM-DDTHH:MM:SS.sssZ` (ISO 8601 with milliseconds)
**Amount format**: Dot decimal
**Encoding**: UTF-8

**Columns** (single unified CSV with everything):
```
Title,Type,Timestamp,Account Currency,Total Amount,Buy / Sell,Ticker,Currency,Price per Share,Quantity,Venue,Order ID,Order Type,Instrument ISIN,FX Rate,Base FX Rate,FX Fee (GBP),FX Fee Currency,Dividend Ex Date,Dividend Pay Date,Dividend Eligible Quantity,Dividend Amount Per Share,Dividend Gross Distribution Amount,Dividend Net Distribution Amount,Dividend Withheld Tax Amount,Dividend Withheld Tax Percentage,Stamp Duty
```

**Trades** (`Type = "ORDER"`):
| Column | Maps To |
|--------|---------|
| `Ticker` | ticker |
| `Instrument ISIN` | isin |
| `Title` | name |
| `Buy / Sell` | "BUY" / "SELL" |
| `Quantity` | quantity (fractional) |
| `Price per Share` | price (in full currency, NOT pence) |
| `FX Rate` | exchange rate |
| `FX Fee (GBP)` | FX fees |
| `Stamp Duty` | stamp duty fee |

**Dividends** (`Type = "DIVIDEND"`):
| Column | Maps To |
|--------|---------|
| `Dividend Gross Distribution Amount` | gross_amount |
| `Dividend Net Distribution Amount` | net_amount |
| `Dividend Withheld Tax Amount` | withholding_tax |
| `Dividend Withheld Tax Percentage` | WHT rate |
| `Dividend Ex Date` | ex-dividend date |
| `Dividend Pay Date` | payment date |
| `Dividend Eligible Quantity` | shares at ex-date |
| `Dividend Amount Per Share` | per-share rate |

**EXCELLENT** — Most detailed dividend data of any broker. All in one CSV.

#### Cost Basis: Section 104 (UK average cost)
#### Multi-currency: GBP base. FX Rate + Base FX Rate columns show actual rate vs mid-market.

---

### 20. Comdirect (Commerzbank) — ~2.8M users

**Priority**: LOW-MEDIUM (German market)

**Detection Keywords**: `"comdirect"`, `"Commerzbank"`, `"comdirect bank"`, `"Depotauszug"`

**Available Formats**: CSV, PDF (Depotauszug, Jahresdepotauszug, Wertpapierabrechnung)

#### CSV Trade History
**Delimiter**: Semicolon (`;`)
**Date format**: `DD.MM.YYYY`
**Amount format**: Comma decimal (`1.234,56`)
**Encoding**: ISO-8859-1

**Columns**:
```
Buchungstag;Geschäftsart;WKN;ISIN;Wertpapierbezeichnung;Stück;Kurs;Kurswert;Provision;Gesamt
```

Same German conventions as Trade Republic / Scalable.

#### Cost Basis: FIFO (German law)

---

### 21. Consorsbank (BNP Paribas) — ~1.5M users

**Priority**: LOW-MEDIUM

**Detection Keywords**: `"Consorsbank"`, `"consorsbank.de"`, `"BNP Paribas S.A. Niederlassung Deutschland"`

Very similar to Comdirect format. German conventions, semicolon CSV, ISIN + WKN identifiers.

---

### 22. ING DiBa Depot — ~9M users (subset uses Depot)

**Priority**: LOW-MEDIUM

**Detection Keywords**: `"ING-DiBa"`, `"ING Depot"`, `"ing.de"`, `"Wertpapierabrechnung"`

Same German broker format pattern. CSV with `;`, comma decimal, ISIN, WKN.

---

## NORDIC BROKERS

### 23. Nordnet — ~2M users

**Priority**: LOW

**Detection Keywords**: `"Nordnet"`, `"nordnet.se"`, `"nordnet.fi"`, `"nordnet.dk"`, `"nordnet.no"`

**Available Formats**: CSV, Excel, PDF

#### CSV Trade History
**Delimiter**: Semicolon (`;`)
**Date format**: `YYYY-MM-DD` (ISO — Nordic standard)
**Amount format**: Comma decimal for SE/FI/NO, dot for EN interface
**Encoding**: UTF-8

**Columns**:
```
Id;Transaktionsdag;Likviddag;Värdepapper;ISIN;Valuta;Antal;Kurs;Belopp;Courtage;Valuta;Konto
```

Swedish column names. "Antal" = quantity, "Kurs" = price, "Courtage" = commission.

---

### 24. Avanza — ~2M users

**Priority**: LOW

**Detection Keywords**: `"Avanza"`, `"avanza.se"`, `"Avanza Bank"`

**Available Formats**: CSV, Excel, PDF

#### CSV Trade History
**Delimiter**: Semicolon (`;`)
**Date format**: `YYYY-MM-DD`
**Amount format**: Comma decimal (Swedish)
**Encoding**: UTF-8

**Columns**:
```
Datum;Konto;Typ av transaktion;Värdepapper/beskrivning;Antal;Kurs;Belopp;Courtage;Valuta;ISIN
```

Swedish column names. Very similar to Nordnet.

---

## ADDITIONAL PLATFORMS

### 25. Freedom24 (Freedom Finance Europe) — ~500K users

**Priority**: LOW

**Detection Keywords**: `"Freedom24"`, `"Freedom Finance"`, `"freedom24.com"`, `"Freedom Holding"`

**Available Formats**: Excel/PDF broker reports, CSV

#### Report Structure
Excel multi-sheet format similar to eToro:
- Trades: Date, Symbol, ISIN, Direction, Quantity, Price, Commission, Total
- Dividends: Date, Security, Gross, Tax, Net
- Portfolio: Symbol, ISIN, Quantity, Avg Price, Market Price, Value, P&L

---

## CROSS-BROKER COMPARISON TABLES

### Date Formats

| Broker | CSV Date Format | Note |
|--------|----------------|------|
| IBKR | `YYYY-MM-DD, HH:MM:SS` | ISO with comma |
| DEGIRO | `DD-MM-YYYY HH:MM` | Locale-dependent |
| Trading 212 | `YYYY-MM-DD HH:MM:SS` | ISO |
| eToro | `DD/MM/YYYY HH:MM:SS` | Excel format |
| Trade Republic | `DD.MM.YYYY` | German |
| Scalable Capital | `DD.MM.YYYY` | German |
| XTB | `YYYY-MM-DD HH:MM:SS` | ISO |
| Fio e-Broker | `dd.mm.yyyy` | Czech |
| Patria Finance | `dd.mm.yyyy` | Czech |
| Saxo Bank | `YYYY-MM-DDTHH:MM:SS` | ISO 8601 |
| Swissquote | `DD.MM.YYYY` | Swiss |
| Hargreaves Lansdown | `DD/MM/YYYY` | UK |
| Freetrade | `YYYY-MM-DDTHH:MM:SSZ` | ISO 8601 UTC |
| Schwab | `MM/DD/YYYY` | US format! |
| Nordnet / Avanza | `YYYY-MM-DD` | ISO |

### CSV Delimiter & Number Format

| Broker | Delimiter | Decimal | Thousands |
|--------|-----------|---------|-----------|
| IBKR | `,` | `.` | none |
| DEGIRO (NL/DE/CZ) | `;` | `,` | `.` |
| DEGIRO (EN) | `,` | `.` | `,` |
| Trading 212 | `,` | `.` | none |
| eToro | N/A (xlsx) | `.` | `,` |
| Trade Republic | `;` | `,` | `.` |
| Scalable Capital | `;` | `,` | `.` |
| XTB (PL/CZ) | `;` | `,` | space |
| Fio e-Broker | `;` | `,` | space |
| Patria Finance | `;` | `,` | space |
| Saxo Bank | `,` | `.` | `,` |
| Swissquote | `;` | `.` | `'` (apostrophe!) |
| Hargreaves Lansdown | `,` | `.` | `,` |
| Freetrade | `,` | `.` | none |
| Schwab | `,` | `.` | `,` |
| German brokers | `;` | `,` | `.` |
| Nordic brokers | `;` | `,` | none |

### Identifier Availability

| Broker | Ticker | ISIN | SEDOL | WKN |
|--------|--------|------|-------|-----|
| IBKR | Yes | Yes (Flex) | Yes (Flex) | No |
| DEGIRO | No | **Yes** | No | No |
| Trading 212 | Yes | Yes | No | No |
| eToro | Partial | Yes | No | No |
| Trade Republic | **No** | **Yes** | No | Yes |
| Scalable Capital | **No** | **Yes** | No | Yes |
| XTB | Yes (custom) | Limited | No | No |
| Fio e-Broker | **Yes** | **Yes** | No | No |
| Patria Finance | **Yes** | **Yes** | No | No |
| Saxo Bank | Yes | Yes | No | No |
| Swissquote | Yes | Yes | No | No |
| Hargreaves Lansdown | EPIC | Limited | **Yes** | No |
| AJ Bell | Limited | Yes | **Yes** | No |
| Freetrade | **Yes** | **Yes** | No | No |
| Schwab | **Yes** | Limited | No | No |
| German brokers | No | **Yes** | No | **Yes** |
| Nordic brokers | Some | **Yes** | No | No |

### Buy/Sell Action Keywords by Language

| Language | Buy | Sell | Dividend | Savings Plan |
|----------|-----|------|----------|--------------|
| **English** | "Buy", "Market buy", "Limit buy", "Purchase" | "Sell", "Market sell", "Limit sell", "Sale" | "Dividend", "Dividend (Ordinary)", "Cash Dividend" | "Regular Investment" |
| **Czech** | "Nákup", "Koupě" | "Prodej" | "Dividenda", "Výplata dividend" | "Pravidelná investice" |
| **German** | "Kauf", "Kauforder" | "Verkauf", "Verkaufsorder" | "Dividende", "Ausschüttung" | "Sparplanausführung", "Sparplan" |
| **Swedish** | "Köp" | "Sälj" | "Utdelning" | "Månadsspar" |
| **Polish** | "Kupno" | "Sprzedaż" | "Dywidenda" | "Plan oszczędzania" |

### Cost Basis Methods

| Method | Brokers |
|--------|---------|
| **FIFO** | IBKR (default), Trade Republic, Scalable, Comdirect, Consorsbank, ING, Fio e-Broker, Patria, Nordnet |
| **Average Cost** | DEGIRO (display), Trading 212, Hargreaves Lansdown, AJ Bell, Freetrade, Swissquote |
| **Per-Position** | eToro, XTB |
| **Configurable** | IBKR (FIFO/LIFO/Specific Lot), Schwab (FIFO/LIFO/Highest/Lowest/Specific/Tax Optimizer) |

---

## IMPLEMENTATION STRATEGY

### Priority Tiers

**Tier 1 — Czech Brokers (Highest Priority)**:
1. **Fio e-Broker** — Most popular CZ broker, richest CSV, has API
2. **Patria Finance** — Traditional CZ broker, good CSV with CZK tax report

**Tier 2 — Pan-European Neobrokers (High Priority)**:
3. **Trading 212** — Excellent single-file CSV, very popular
4. **DEGIRO** — Very popular in EU/CZ, but ISIN-only (no ticker)
5. **Interactive Brokers** — Most comprehensive data (Flex Queries)
6. **Trade Republic** — Fastest growing, German format, ISIN-only

**Tier 3 — Other Popular Platforms**:
7. **XTB** — Popular in CZ/PL, custom ticker format
8. **Scalable Capital** — German format, very similar to Trade Republic
9. **Freetrade** — Best dividend data format
10. **eToro** — Large user base, Excel format, CFD filtering needed

**Tier 4 — National Brokers**:
11. **Saxo Bank** — Great API, comprehensive
12. **Hargreaves Lansdown** — UK, pence pricing
13. **Portu / Fondee / Finax** — Czech/SK robo-advisors, PDF-focused
14. **German brokers** (Comdirect, Consorsbank, ING Depot)
15. **Nordic brokers** (Nordnet, Avanza)

### Architecture Recommendations

1. **Create `BaseBrokerParser` class** distinct from the bank `BaseParser`:
   ```python
   class BaseBrokerParser(ABC):
       BROKER_NAME: str = "unknown"

       @abstractmethod
       def parse_trades(self, file_path: str) -> list[dict]:
           """Parse trade history → list of trade dicts"""

       @abstractmethod
       def parse_holdings(self, file_path: str) -> list[dict]:
           """Parse portfolio snapshot → list of holding dicts"""

       @abstractmethod
       def parse_dividends(self, file_path: str) -> list[dict]:
           """Parse dividend history → list of dividend dicts"""
   ```

2. **CSV Auto-Detection**: Detect broker from CSV header row:
   - `"Action,Time,ISIN,Ticker,Name"` → Trading 212
   - `"Datum;Typ;ISIN;Beschreibung"` → Trade Republic or Scalable
   - `"Datum;Čas;Ticker;ISIN;Název"` → Fio e-Broker
   - `"Title,Type,Timestamp,Account Currency"` → Freetrade
   - `"Date,Action,Symbol,Description,Quantity,Price,Fees & Comm"` → Schwab
   - `"Symbol,Type,Time,Comment,Volume"` → XTB

3. **ISIN-to-Ticker Mapping**: Many brokers (DEGIRO, Trade Republic, Scalable) only provide ISIN. Build a lookup service or use a free API (OpenFIGI, Yahoo Finance) to resolve ISIN → ticker.

4. **Extend `clean_amount()`** for broker-specific formats:
   - Swiss apostrophe: `1'234.56` → 1234.56
   - UK pence: `Price (p)` → divide by 100
   - German comma decimal: `1.234,56` → 1234.56

5. **Unified Import Flow**: Regardless of broker, all parsed data flows into:
   - Trades → `StockTrade` (via `link_stock_pnl()` pattern)
   - Holdings → `StockHolding` + `StockHoldingSnapshot` (via `link_stock_holdings()` pattern)
   - Dividends → `StockDividend`

6. **CSV vs PDF Priority**: For broker imports, CSV should be the PRIMARY format. Only fall back to PDF parsing for brokers that don't offer CSV (Portu, Fondee, Finax).

### Fields Extraction Matrix

| Field | IBKR | DEGIRO | T212 | eToro | TR | Fio | Patria | Saxo | HL | Freetrade |
|-------|------|--------|------|-------|----|----|--------|------|----|-----------|
| ticker | ✅ | ❌ | ✅ | ⚠️ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ISIN | ✅* | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ |
| name | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| quantity | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| price | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | pence! | ✅ |
| fees | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| P&L | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| dividend gross | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| dividend WHT | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| FX rate | ✅ | ✅ | ✅ | ❌ | ⚠️ | ✅ | ✅ | ✅ | ❌ | ✅ |
| CZK values | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |

✅ = Available, ❌ = Not available (must compute), ⚠️ = Partially available
\* IBKR requires Flex Query for ISIN
