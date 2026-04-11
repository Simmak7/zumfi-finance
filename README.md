<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/Version-1.1-success?style=for-the-badge" alt="Version 1.1" />
  <img src="https://img.shields.io/badge/License-Private-red?style=for-the-badge" alt="License" />
</p>

<h1 align="center">ZUMFI</h1>
<h3 align="center">Your Personal Finance Companion</h3>

<p align="center">
  Take full control of your finances. Privacy-first, self-hosted money management<br/>
  with smart categorization and AI-powered insights — your data never leaves your server.
</p>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Meet Zumfi — Your Financial Mascot](#meet-zumfi--your-financial-mascot)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Project Status](#project-status)
- [Roadmap](#roadmap)

---

## Overview

**Zumfi** is a self-hosted personal finance application designed for users who want full control over their financial data. Upload bank statements as PDFs, and Zumfi automatically detects the bank, extracts transactions, classifies them into categories, and provides rich analytics — all without sending your data to third-party services.

Built with a modern React frontend and a FastAPI async backend, the entire stack runs locally via Docker Compose, including a local LLM (Ollama) for AI-powered financial summaries.

### Key Highlights

- **Privacy-first** — all data stays on your machine, no external APIs for core functionality
- **Multi-bank support** — automatic PDF parsing for Raiffeisen, Revolut, ČSOB, Česká spořitelna, UniCredit, FIO Banka, mBank, plus a Czech Universal format fallback for 20+ other banks
- **Smart categorization** — 4-tier classification engine that learns from your corrections
- **Interactive mascot** — Zumfi, a draggable animated companion that reacts to your financial health
- **Full financial suite** — dashboard, budgets, bills, goals, portfolio tracking, and more

---

## Features

### Bank Statement Parsing
Upload PDF bank statements and let Zumfi handle the rest. The parser auto-detects the bank format, extracts every transaction, and handles Czech number formatting, multi-line entries, and deduplication.

| Supported Bank | Format | Features |
|----------------|--------|----------|
| Raiffeisen CZ | PDF (Czech) | Current & savings accounts, multi-line block parsing |
| Revolut | PDF (English) | Multi-currency (EUR/USD/CZK/...) + P&L + stock transaction statements, balance-tracked direction resolution |
| ČSOB | PDF (Czech) | Dedicated parser, multi-amount row handling |
| Česká spořitelna | PDF (OCR) | Image-based scans via Tesseract 600 DPI, pig-savings round-up detection |
| UniCredit | PDF (Czech) | Block-based parsing, foreign-currency extraction |
| FIO Banka | PDF (Czech + Slovak) | Current accounts, term deposits, FX tail parsing for cross-border card payments |
| mBank | PDF (Czech + EUR variant) | Text-based parsing, concatenated-word fixups |
| Czech Universal | PDF (Czech + Slovak) | Generic fallback for 20+ Czech banks (Air Bank, KB, Moneta, Trinity, J&T, PPF, VÚB, and more) |

Additional formats supported via the **Import Wizard**: CSV and Excel files with custom column mapping.

### Dashboard & Analytics
A comprehensive financial overview at a glance:
- **KPI Cards** — total income, total spending, savings rate, remaining budget
- **Income vs. Expenses Chart** — dual-area visualization of monthly cash flow
- **Category Donut Chart** — interactive breakdown of spending by category
- **Spend Forecast** — predicted vs. actual spending projections
- **Anomaly Detection** — flags transactions that deviate >2 standard deviations from your patterns
- **Recurring Expense Detection** — automatically identifies subscription-like charges
- **Month-Close Wizard** — guided 5-step flow to review, reconcile, and allocate savings each month

### Smart Categorization
A 4-tier classification engine that improves over time:

| Tier | Method | Confidence |
|------|--------|------------|
| 1 | Regex pattern match | 1.0 |
| 2 | Substring keyword match | 0.9 |
| 3 | Fuzzy matching (SequenceMatcher) | 0.6 – 0.8 |
| 4 | Uncategorized (needs review) | 0.0 |

When you manually categorize a transaction, Zumfi extracts keywords and learns for next time. You can also apply a category to all similar transactions in one click.

### Budgets & Goals
- **Monthly budgets** — set per-category spending limits with planned vs. actual tracking
- **Savings goals** — define targets with deadlines, track progress with radial charts
- **Smart allocation** — surplus income is automatically suggested for distribution across your goals
- **Copy forward** — replicate last month's budget with one click

### Bills Tracker
- Track recurring bills (rent, utilities, subscriptions)
- Auto-detects payment status by matching transactions (fuzzy ILIKE + 15% amount tolerance)
- Status indicators: `Paid`, `Pending`, `Overdue`
- Discover new recurring bills automatically from transaction patterns

### Portfolio & Investments
- **Savings accounts** — track balances across multiple accounts and currencies
- **Stock holdings** — individual positions with shares, average cost, current price, and ISIN
- **P&L tracking** — trades, dividends, and gain/loss calculations
- **Monthly snapshots** — historical portfolio KPIs for trend analysis
- **Multi-currency** — CZK, EUR, USD with exchange rate support

### AI-Powered Insights
Optional local LLM integration via Ollama (llama3.2) provides:
- Natural language financial summaries
- Spending pattern analysis
- Non-blocking — gracefully degrades if Ollama is unavailable

---

## Meet Zumfi — Your Financial Mascot

<p align="center"><em>A lavender-white creature with a gold crown, whiskers, and a personality driven by your finances.</em></p>

Zumfi is an interactive SVG mascot that lives on your screen. Drag it anywhere, double-click to send it home, or hover it over dashboard elements for contextual financial commentary.

### Expressions & Outfits

Zumfi's appearance changes based on your financial health:

| Financial State | Expression | Outfit | Animation |
|----------------|------------|--------|-----------|
| Thriving (health > 85%, savings > 25%) | Excited | Celebration confetti | Celebrate |
| Goal reached | Excited | Celebration confetti | Hop |
| Budget master (all categories < 80%) | Happy | Sunglasses | Hop |
| Portfolio boom (> +5%) | Excited | Money tree | — |
| Steady (health 40-85%) | Happy | Casual | Idle |
| Overspending | Concerned | Broke outfit | — |
| Crisis (health < 20%) | Concerned | Broke + sweat drop | — |

### Proximity Intelligence

Drag Zumfi near any UI element tagged with a `data-zumfi-zone` attribute, and it generates context-aware speech bubbles. For example:
- Near the **income KPI** → compares income to last month
- Near the **category chart** → comments on your top spending category
- Near the **bills section** → reminds you about upcoming due dates
- Works across all pages: Dashboard, Transactions, Budget, Bills, Import, Portfolio, Settings

### Other Behaviors
- **Idle animations** — cycles through expressions when inactive
- **Emotional memory** — remembers mood history to detect multi-month trends
- **Persistent position** — drag position saved to localStorage
- **Mute option** — silence speech bubbles in preferences

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend** | React + Vite | 19.2 / 7.2 |
| **UI & Charts** | Recharts, Chart.js, Framer Motion | 3.6 / 4.5 / 12.26 |
| **Icons** | Lucide React | 0.562 |
| **Backend** | FastAPI + Uvicorn | 0.115 / 0.34 |
| **ORM** | SQLAlchemy (async) + Alembic | 2.0 / 1.14 |
| **Database** | PostgreSQL | 16 |
| **Cache & Queue** | Redis + Celery | 7 / 5.4 |
| **PDF Parsing** | pdfplumber + Tesseract OCR | 0.11 / 0.3 |
| **AI** | Ollama (local LLM — llama3.2) | latest |
| **Auth** | JWT (python-jose + bcrypt) | — |
| **Containerization** | Docker Compose | — |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Docker Compose                       │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌────────┐  ┌───────────┐  │
│  │ Frontend │  │ Backend  │  │  Redis  │  │ PostgreSQL│  │
│  │ React 19 │→ │ FastAPI  │→ │  7-alp  │  │    16     │  │
│  │ Vite 7   │  │ Uvicorn  │  └────┬───┘  └─────┬─────┘  │
│  │ :3001    │  │ :8001    │       │             │        │
│  └──────────┘  └────┬─────┘  ┌────┴───┐        │        │
│                     │        │ Celery  │        │        │
│                     │        │ Worker  │────────┘        │
│                     │        └────────┘                   │
│                     │                                     │
│                ┌────┴─────┐                               │
│                │  Ollama  │                               │
│                │ llama3.2 │                               │
│                │  :11435  │                               │
│                └──────────┘                               │
└──────────────────────────────────────────────────────────┘
```

### Backend Feature Modules

Each feature is self-contained with its own router, service, models, and schemas:

```
backend/app/features/
├── auth/            # JWT authentication
├── statements/      # PDF upload & multi-bank parsing
│   └── parsers/     # Bank-specific parser strategies
├── categories/      # Transaction classification engine
├── analysis/        # Analytics, trends, anomaly detection
├── dashboard/       # Aggregation & KPIs
├── goals/           # Savings goals & allocation
├── budgets/         # Monthly budget tracking
├── bills/           # Recurring bill management
├── imports/         # CSV/Excel import wizard
├── accounts/        # Multi-bank account management
├── portfolio/       # Savings & investment tracking
└── settings/        # User preferences
```

### Frontend Feature Modules

```
frontend/src/features/
├── auth/            # Login & registration
├── dashboard/       # Main overview + modals + charts
├── transactions/    # Transaction list, search, categorization
├── budget/          # Budget editor + goal management
├── bills/           # Recurring bills tracker
├── import/          # 4-step import wizard
├── portfolio/       # Savings, stocks, P&L
├── categories/      # Category editor
├── settings/        # Preferences
└── zumfi/           # Interactive mascot system
```

### Database Schema

20 migration files managing the following core tables:

| Table | Purpose |
|-------|---------|
| `users` | User accounts with auth & preferences |
| `categories` | Spending categories with icons & colors |
| `category_mappings` | Auto-learn keyword → category rules |
| `statements` | Uploaded bank statement metadata |
| `transactions` | Individual financial transactions |
| `goals` | Savings goals with targets & deadlines |
| `goal_contributions` | Monthly goal allocation records |
| `accounts` | Multi-bank account definitions |
| `budgets` | Monthly per-category budget allocations |
| `recurring_bills` | Bill definitions & schedules |
| `savings_accounts` | Portfolio savings tracking |
| `investments` | Portfolio investment records |
| `stock_holdings` | Individual stock/ETF positions |
| `stock_trades` | Buy/sell trade history |
| `stock_dividends` | Dividend payment records |
| `stock_snapshots` | Per-stock historical data |
| `portfolio_snapshots` | Monthly portfolio KPIs |
| `exchange_rates` | Currency conversion rates |

---

## Getting Started

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/)
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/Simmak7/zumfi.git
cd zumfi

# Copy environment template and configure
cp .env.example .env
# Edit .env with your preferred settings (database passwords, secret key, etc.)

# Start all services
docker-compose up -d --build

# The app will be available at:
# Frontend:  http://localhost:3001
# Backend:   http://localhost:8001
# API Docs:  http://localhost:8001/docs
```

### Quick Start

1. Open `http://localhost:3001` in your browser
2. Register a new account
3. Upload a bank statement PDF (Raiffeisen, Revolut, ČSOB, Česká spořitelna, UniCredit, FIO, mBank, or any Czech/Slovak bank via the universal parser)
4. Watch as transactions are automatically parsed and categorized
5. Explore the dashboard, set budgets, define savings goals
6. Drag Zumfi around the screen for financial insights

### Useful Commands

```bash
# Rebuild after code changes
docker-compose up -d --build backend frontend

# View backend logs
docker-compose logs -f backend

# Health check
curl http://localhost:8001/health

# Stop all services
docker-compose down
```

---

## Project Status

> **Current Version: 1.1** — Active Development

The application is fully functional with a comprehensive feature set. All core features are implemented and operational.

### Completed Sprints

| Sprint | Focus | Status |
|--------|-------|--------|
| Sprint 1 | Foundation — Auth, DB, Docker, basic UI | Done |
| Sprint 2-4 | Bills, Budgets, Import Wizard, Dashboard Viz, Smart Features | Done |
| Sprint 5 | Dashboard enhancements, shared components, multi-bank parsers | Done |
| Sprint 6 | Testing infrastructure, legacy cleanup, test suite | Done |
| Post-Sprint | Portfolio, Settings, Zumfi mascot, stock tracking, new parsers | Done |

### What's Working

- Full JWT authentication flow (register, login, session management)
- PDF upload and parsing for 7 dedicated bank parsers (Raiffeisen, Revolut, ČSOB, Česká spořitelna, UniCredit, FIO, mBank) plus a Czech Universal fallback for 20+ other banks
- CSV/Excel import with column mapping wizard
- Smart 4-tier transaction categorization with auto-learning
- Interactive dashboard with charts, KPIs, and month-close wizard
- Budget management with planned vs. actual tracking
- Savings goals with allocation suggestions
- Recurring bills tracker with auto-detection
- Portfolio tracking (savings + stocks + P&L)
- Multi-currency support (CZK, EUR, USD)
- Zumfi mascot with 12 financial moods and proximity intelligence
- Local AI summaries via Ollama (optional)
- Full Docker Compose deployment

---

## Roadmap

### Near-Term Goals

- [ ] **Mobile-responsive UI** — optimize layouts for tablets and phones
- [ ] **Data export** — CSV/PDF export of transactions and reports
- [ ] **Recurring transaction rules** — auto-categorize based on saved rules
- [ ] **Multi-language support** — Czech and English UI localization
- [ ] **Notifications** — email/push alerts for budget limits and bill due dates

### Medium-Term Goals

- [ ] **Bank API integrations** — direct account connection (PSD2/Open Banking)
- [ ] **Advanced reporting** — yearly summaries, tax-ready reports, net worth tracking
- [ ] **Shared households** — multi-user budgets with shared categories
- [ ] **Receipt scanning** — OCR for paper receipts with transaction matching
- [ ] **Investment analytics** — deeper portfolio analysis, benchmarking, asset allocation recommendations

### Long-Term Vision

- [ ] **Mobile app** — React Native companion app
- [ ] **AI financial advisor** — personalized recommendations based on spending patterns
- [ ] **Automated savings** — rule-based transfers and round-up savings
- [ ] **Community templates** — shareable budget and category templates

---

<p align="center">
  <sub>Built with care for people who want to understand their money.</sub>
</p>
