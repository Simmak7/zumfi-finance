<p align="center">
  <img src="frontend/public/favicon.svg" alt="Zumfi Logo" width="80" />
</p>

<h1 align="center">Zumfi Finance</h1>

<p align="center">
  <strong>Your Personal Finance Companion</strong><br/>
  Take full control of your finances. Privacy-first, self-hosted money management<br/>
  with smart categorization and AI-powered insights — your data never leaves your server.
</p>

<p align="center">
  <a href="https://zumfi.net">Website</a> &bull;
  <a href="#features">Features</a> &bull;
  <a href="#quick-start">Quick Start</a> &bull;
  <a href="#tech-stack">Tech Stack</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-BSL--1.1-blue" alt="License" />
  <img src="https://img.shields.io/badge/version-1.0.0-green" alt="Version" />
  <img src="https://img.shields.io/badge/docker-ready-2496ED?logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/self--hosted-yes-brightgreen" alt="Self-hosted" />
</p>

---

## What is Zumfi?

Zumfi is a **full-stack, self-hosted personal finance application** that helps you take complete control of your money. Upload bank statements, automatically categorize transactions, track your expenses, set budgets and savings goals, track your mortgage as well as your portfolio (stocks, savings accounts, property values), and get AI-powered financial insights — all running on your own infrastructure with your data never leaving your server.

**Your data stays yours.** No cloud subscriptions, no third-party analytics, no data selling. Everything runs locally via Docker.

Visit **[zumfi.net](https://zumfi.net)** for more information.

---

## Features

### Dashboard and Analytics
- **Monthly KPI cards** - income, expenses, savings rate, net worth at a glance
- **Interactive charts** - spending trends, expense category breakdowns
- **Month-close wizard** - guided workflow to review and finalize each month with savings allocation to your own savings goals
- **AI-powered insights** - anomaly detection, spend forecasts, recurring expense analysis (via local Ollama LLM)

### Bank Statement Parsing
- **Upload and parse** bank statements, stock statements, and savings account statements
- **Multi-currency support** with automatic conversion
- **Automatic PDF parsing** for Czech banks:
  - Raiffeisen CZ
  - CSOB / Ceska Sporitelna
  - Revolut
  - UniCredit
  - Czech Universal format
- **CSV and Excel import** wizard with column mapping
- **Multi-account support** with automatic statement linking

> **Your bank missing?** See [Contributing](#contributing) — we're building the world's most complete open-source bank parser, and every new format helps everyone.

### Smart Categorization
- **Automatic AI-learned category allocation** of transactions from bank statements
- **Intelligent categorization system:**
  - User-defined rules (highest priority)
  - AI-learned patterns from your corrections
  - Keyword-based matching
- **Auto-learning** - correcting a category teaches the system for next time

### Budgets
- **Monthly budget allocations** per category
- **Smart suggestions** based on historical spending
- **Visual comparison** - budgeted vs. actual with progress bars
- **Overspend alerts** when approaching or exceeding limits

### Savings Goals
- **Goal tracking** with target amounts and deadlines
- **Allocation wizard** - distribute surplus income across goals
- **Progress visualization** with contribution history

### Bills and Mortgages
- **Recurring bill tracker** with due date reminders
- **Mortgage calculator** with amortization schedule
- **Mortgage event tracking** (extra payments, rate changes)
- **Bill status checklist** per month

### Portfolio Tracker
- **Savings accounts** with balance and interest tracking
- **Investment accounts** - deposits, withdrawals, performance
- **Stock holdings** - shares, cost basis, market value, P and L
- **Real estate** - property values, mortgages, equity calculation
- **Multi-currency** portfolio with CZK/EUR/USD support

### Multi-Currency
- **Daily exchange rates** from the Czech National Bank (CNB)
- **Automatic conversion** across CZK, EUR, USD
- **Per-account currency** assignment
- **Portfolio values** consolidated in your preferred currency

### Internationalization
- **3 languages** supported: English, Czech, Ukrainian
- **Complete UI translation** including charts, labels, and messages

### Zumfi - Your Finance Mascot
- **Interactive rabbit mascot** with mood-based expressions
- **Financial mood awareness** - Zumfi reacts to your spending habits
- **Page-specific insights** - contextual tips on every page
- **Draggable and proximity-aware** - follows your cursor, hides near edges
- **Idle behaviors** - ambient animations when not interacting

### Security
- **JWT authentication** with refresh token rotation
- **Google OAuth** integration (optional)
- **TOTP two-factor authentication** (2FA)
- **Rate limiting** with Redis-backed sliding windows
- **Security headers** middleware
- **Multi-user support** with complete data isolation

---

## Installation

### The Lazy Way (AI-Assisted)

Already using an AI coding agent? Just give it this prompt and let it handle the rest:

**Claude Code / Claude CLI:**
```
Clone https://github.com/Simmak7/zumfi-finance.git and set it up:
create .env from .env.example, generate a secure SECRET_KEY,
and run docker-compose up -d --build. Then tell me the URL to open.
```

**OpenAI Codex / ChatGPT:**
```
Help me install Zumfi Finance from https://github.com/Simmak7/zumfi-finance.git
- clone the repo, configure .env with a strong secret key, start Docker services
```

**Cursor / Windsurf / Any AI IDE:**
> Open a terminal, paste the repo URL, and ask your AI assistant:
> *"Set up this project with Docker"*

The AI will clone, configure, build, and start everything. You just open **localhost:3001** when it's done.

---

### Manual Setup

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/)
- 4 GB RAM minimum (8 GB recommended for AI features)

### 1. Clone the repository

```bash
git clone https://github.com/Simmak7/zumfi-finance.git
cd zumfi-finance
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set a strong `SECRET_KEY`:
```bash
SECRET_KEY=your-random-32-character-string-here
```

### 3. Start all services

```bash
docker-compose up -d --build
```

This starts:
| Service | Description | Local Port |
|---------|-------------|------------|
| **Frontend** | React UI | [localhost:3001](http://localhost:3001) |
| **Backend** | FastAPI server | [localhost:8001](http://localhost:8001) |
| **PostgreSQL** | Database | 5433 |
| **Redis** | Cache and queue | 6380 |
| **Ollama** | Local AI (optional) | 11435 |
| **Celery** | Background tasks | - |

### 4. Open the app

Navigate to **http://localhost:3001** and create your account.

### 5. Optional - Enable AI insights

Pull a model into Ollama for AI-powered analysis:
```bash
docker exec finance_ollama ollama pull llama3.2
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, Vite 7, Framer Motion, Recharts, Chart.js, dnd-kit |
| **Backend** | Python, FastAPI 0.115, SQLAlchemy (async), Alembic |
| **Database** | PostgreSQL 16 |
| **Cache and Queue** | Redis 7, Celery |
| **AI Engine** | Ollama (local LLM - Llama, Mistral, etc.) |
| **Auth** | JWT with bcrypt, Google OAuth, TOTP 2FA |
| **Exchange Rates** | Czech National Bank (CNB) daily rates |
| **Containerization** | Docker Compose |

---

## Architecture

```
zumfi-finance/
  backend/
    Dockerfile
    app/
      main.py              # FastAPI entry (13 routers)
      core/                # Auth, DB, config, security
      migrations/          # Alembic DB migrations
      features/
        auth/              # JWT, OAuth, 2FA
        statements/        # PDF parsing engine
        categories/        # Smart categorization
        dashboard/         # KPIs and month-close
        budgets/           # Budget management
        goals/             # Savings goals
        bills/             # Bills and mortgages
        portfolio/         # Portfolio tracker
        analysis/          # AI insights (Ollama)
        accounts/          # Multi-bank accounts
        imports/           # CSV/Excel import
        settings/          # User preferences
        donate/            # Support the project
    tests/

  frontend/
    Dockerfile
    src/
      features/            # Feature modules
      components/          # Shared UI
      context/             # React contexts
      i18n/                # Translations (EN, CS, UK)
      services/api.js      # API client

  docker-compose.yml
  .env.example
  LICENSE
```

---

## Supported Banks

| Bank | Format | Status |
|------|--------|--------|
| Raiffeisen CZ | PDF | Fully supported |
| FIO Banka | PDF | Fully supported |
| Revolut | PDF | Fully supported |
| CSOB / Ceska Sporitelna | PDF | Fully supported |
| UniCredit | PDF | Fully supported |
| Universal format | PDF | Auto-detection fallback |
| Any bank | CSV / Excel | Via import wizard |

> **Your bank missing?** See [Contributing](#contributing) - we're building the world's most complete open-source bank parser, and every new format helps everyone.

---

## Environment Variables

See `.env.example` for all available configuration options:

| Variable | Description | Default |
|----------|-------------|---------|
| `SECRET_KEY` | JWT signing key | Must change for production |
| `POSTGRES_PASSWORD` | Database password | Must change for production |
| `DATABASE_URL` | PostgreSQL connection string | Auto-configured |
| `REDIS_URL` | Redis connection string | `redis://redis:6379/0` |
| `OLLAMA_HOST` | Ollama AI server | `http://ollama:11434` |
| `GOOGLE_CLIENT_ID` | Google OAuth (optional) | Empty |
| `GOOGLE_CLIENT_SECRET` | Google OAuth (optional) | Empty |
| `CORS_ORIGINS` | Allowed CORS origins | `http://localhost:3001` |

---

## Contributing

**Our vision: the first truly universal open-source personal finance app** - one that can parse bank statements from any bank in the world, in any language, in any format.

We already support several Czech banks and Revolut, but the world has thousands of banks. Every parser you contribute unlocks Zumfi for an entire country or institution. That's the power of open source.

### How you can help

**Add your bank's parser** - This is the single highest-impact contribution. Upload a sample statement (anonymized), write a parser, and suddenly every user of that bank can use Zumfi. We have a modular parser architecture that makes adding new banks straightforward.

**Improve existing features** - Better charts, smarter categorization, new languages, accessibility improvements - all welcome.

**Report bugs and suggest ideas** - Open an issue. Even "this doesn't work with my bank's PDF" is valuable feedback.

### Getting started

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Let's build something that gives everyone, everywhere, full control over their finances.

---

## Support the Project

If Zumfi helps you manage your finances, consider supporting the project:

- [GitHub Sponsors](https://github.com/sponsors/mzsim) - Buy a carrot for Zumfi the rabbit!
- Star this repository
- Share with friends

---

## Roadmap

- Mobile-responsive UI improvements
- Data export (CSV, PDF reports)
- Bank API integrations (PSD2 / Open Banking)
- Shared household accounts
- Receipt scanning (OCR)
- Native mobile app
- AI financial advisor chat

---

## License

This project is licensed under the **Business Source License 1.1** (BUSL-1.1).

- **Personal and non-commercial use**: Fully permitted
- **Commercial production use**: Requires a separate license
- **Change Date**: March 29, 2030 - after this date, the code becomes available under the Apache License 2.0

See the [LICENSE](LICENSE) file for full details.

---

<p align="center">
  Made with care by <a href="https://github.com/Simmak7">Simmak7</a><br/>
  <a href="https://zumfi.net">zumfi.net</a>
</p>
