from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.auth import get_current_user
from features.auth.models import User
from features.analysis.service import AnalysisService
from features.analysis.ai_engine import get_spending_summary, get_zumi_insight

router = APIRouter(prefix="/analysis", tags=["analysis"])


@router.get("/trends")
async def get_trends(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get monthly spending trends by category."""
    return await AnalysisService.get_monthly_trends(db, owner_id=user.id)


@router.get("/anomalies")
async def get_anomalies(
    month: str | None = Query(None, pattern=r"^\d{4}-\d{2}$"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Detect unusual spending patterns."""
    return await AnalysisService.detect_anomalies(db, owner_id=user.id, month=month)


@router.get("/recurring")
async def get_recurring(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Detect recurring/subscription expenses."""
    return await AnalysisService.detect_recurring(db, owner_id=user.id)


@router.get("/top-categories")
async def get_top_categories(
    month: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get top 5 expense categories for a month."""
    return await AnalysisService.get_top_categories(db, owner_id=user.id, month=month)


@router.get("/forecast")
async def get_forecast(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Predict next month's spending based on last 3 months."""
    return await AnalysisService.predict_spending(db, owner_id=user.id)


@router.get("/summary")
async def get_ai_summary(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get AI-generated spending summary (requires Ollama)."""
    trends = await AnalysisService.get_monthly_trends(db, owner_id=user.id)
    anomalies = await AnalysisService.detect_anomalies(db, owner_id=user.id)
    recurring = await AnalysisService.detect_recurring(db, owner_id=user.id)
    forecast = await AnalysisService.predict_spending(db, owner_id=user.id)

    summary = await get_spending_summary(trends, anomalies, recurring, forecast)

    return {
        "summary": summary or "AI summary unavailable. Ollama may not be running.",
        "trends": trends,
        "anomalies_count": len(anomalies),
        "recurring_total": sum(r["average_amount"] for r in recurring),
        "forecast": forecast,
    }


class ZumiInsightRequest(BaseModel):
    mood: str
    income: float
    expenses: float
    savings_rate: float
    health_score: int
    portfolio_change: float | None = None
    budget_pct: float | None = None
    goals_reached: int = 0
    goal_count: int = 0
    language: str | None = None  # "en", "cs", "uk" — falls back to user.language


@router.post("/zumi-insight")
@router.post("/zumfi-insight")  # backwards-compatible alias
async def get_zumi_insight_endpoint(
    request: ZumiInsightRequest,
    user: User = Depends(get_current_user),
):
    """Generate AI-powered speech bubble text for Zumi mascot."""
    # Prefer the language the client explicitly sent; fall back to the
    # user's saved preference; default to English.
    language = (request.language or getattr(user, "language", None) or "en").lower()

    insight = await get_zumi_insight(
        mood=request.mood,
        income=request.income,
        expenses=request.expenses,
        savings_rate=request.savings_rate,
        health_score=request.health_score,
        portfolio_change=request.portfolio_change,
        budget_pct=request.budget_pct,
        goals_reached=request.goals_reached,
        goal_count=request.goal_count,
        language=language,
    )

    return {"insight": insight}
