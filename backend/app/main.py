import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from core.config import get_settings
from core.middleware import SecurityHeadersMiddleware
from core.rate_limit import limiter

settings = get_settings()
logger = logging.getLogger("alembic.runtime.migration")


def _run_alembic_upgrade():
    """Run Alembic migrations (called in a thread to avoid nested asyncio.run)."""
    from alembic.config import Config
    from alembic import command

    alembic_cfg = Config("alembic.ini")
    command.upgrade(alembic_cfg, "head")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Startup: run Alembic migrations
    logger.info("Running database migrations...")
    await asyncio.get_event_loop().run_in_executor(None, _run_alembic_upgrade)
    logger.info("Migrations complete.")

    # Fetch and store today's exchange rates (once per day)
    # Then recalculate historical snapshots with monthly average rates
    try:
        from core.database import async_session_factory
        from core.exchange_rates import ensure_daily_rates
        from features.portfolio.service import PortfolioService

        async with async_session_factory() as session:
            await ensure_daily_rates(session)
            await PortfolioService.recalculate_all_snapshots(session)
            await session.commit()
    except Exception as e:
        logger.warning(f"Could not complete startup exchange rate tasks: {e}")

    yield
    # Shutdown: cleanup if needed


app = FastAPI(
    title="Finance APP API",
    version="2.0.0",
    lifespan=lifespan,
)

# Rate limiting
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many requests. Please try again later."},
    )


app.add_middleware(SlowAPIMiddleware)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Security headers
app.add_middleware(SecurityHeadersMiddleware)


# Health check
@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "2.0.0"}


# Include feature routers
from features.auth.router import router as auth_router
from features.categories.router import router as categories_router
from features.statements.router import router as statements_router
from features.goals.router import router as goals_router
from features.analysis.router import router as analysis_router
from features.dashboard.router import router as dashboard_router
from features.accounts.router import router as accounts_router
from features.budgets.router import router as budgets_router
from features.bills.router import router as bills_router
from features.imports.router import router as imports_router
from features.settings.router import router as settings_router
from features.portfolio.router import router as portfolio_router
from features.donate.router import router as donate_router
from features.feedback.router import router as feedback_router

app.include_router(auth_router)
app.include_router(categories_router)
app.include_router(statements_router)
app.include_router(goals_router)
app.include_router(analysis_router)
app.include_router(dashboard_router)
app.include_router(accounts_router)
app.include_router(budgets_router)
app.include_router(bills_router)
app.include_router(imports_router)
app.include_router(settings_router, prefix="/settings", tags=["Settings"])
app.include_router(portfolio_router)
app.include_router(donate_router)
app.include_router(feedback_router)
