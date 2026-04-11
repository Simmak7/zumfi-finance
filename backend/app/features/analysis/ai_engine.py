"""Ollama AI integration for spending insights.

Provides natural language summaries and smart recommendations
using a local LLM via Ollama.
"""

import httpx
from core.config import get_settings

settings = get_settings()


async def get_spending_summary(
    trends: list[dict],
    anomalies: list[dict],
    recurring: list[dict],
    forecast: dict,
) -> str | None:
    """Generate a natural language spending summary using Ollama."""
    try:
        prompt = _build_summary_prompt(trends, anomalies, recurring, forecast)

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{settings.OLLAMA_HOST}/api/generate",
                json={
                    "model": "llama3.2",
                    "prompt": prompt,
                    "stream": False,
                },
            )

        if response.status_code == 200:
            result = response.json()
            return result.get("response", "").strip()

        return None

    except Exception:
        # AI is non-critical - fail silently
        return None


async def get_budget_recommendations(
    monthly_spending: dict[str, float],
    income: float,
) -> list[str] | None:
    """Generate budget recommendations using Ollama."""
    try:
        spending_text = "\n".join(
            f"- {cat}: {amt:.0f} CZK" for cat, amt in monthly_spending.items()
        )

        prompt = (
            f"Given monthly income of {income:.0f} CZK and these expenses:\n"
            f"{spending_text}\n\n"
            f"Give 3 short, specific budget recommendations. "
            f"Each should be one sentence. Be practical."
        )

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{settings.OLLAMA_HOST}/api/generate",
                json={"model": "llama3.2", "prompt": prompt, "stream": False},
            )

        if response.status_code == 200:
            result = response.json()
            text = result.get("response", "").strip()
            # Parse numbered list
            lines = [
                line.strip().lstrip("0123456789.-) ")
                for line in text.split("\n")
                if line.strip()
            ]
            return lines[:3] if lines else None

        return None

    except Exception:
        return None


_LANGUAGE_INSTRUCTIONS = {
    "en": "Respond in English.",
    "cs": "Respond in Czech (čeština). Use natural, friendly Czech — "
          "tykání (informal 'ty'). Keep it short and natural.",
    "uk": "Respond in Ukrainian (українська). Use natural, friendly "
          "Ukrainian. Keep it short and natural.",
}


async def get_zumi_insight(
    mood: str,
    income: float,
    expenses: float,
    savings_rate: float,
    health_score: int,
    portfolio_change: float | None = None,
    budget_pct: float | None = None,
    goals_reached: int = 0,
    goal_count: int = 0,
    language: str = "en",
) -> str | None:
    """Generate a short, character-appropriate Zumi speech bubble using Ollama."""
    try:
        lang_key = (language or "en").lower()
        lang_instruction = _LANGUAGE_INSTRUCTIONS.get(
            lang_key, _LANGUAGE_INSTRUCTIONS["en"]
        )

        parts = [
            "You are Zumi, a cute wise rabbit mascot in a personal finance app.",
            "Generate exactly ONE short sentence (max 15 words) as a speech bubble.",
            "Be warm, encouraging, specific with numbers, and slightly playful.",
            "Do NOT use emojis. Do NOT use quotation marks around your response.",
            lang_instruction,
            "",
            f"Current mood: {mood}",
            f"Monthly income: {income:.0f} CZK",
            f"Monthly expenses: {expenses:.0f} CZK",
            f"Savings rate: {savings_rate:.0f}%",
            f"Financial health score: {health_score}/100",
        ]

        if portfolio_change is not None:
            parts.append(f"Portfolio change: {portfolio_change:+.1f}%")
        if budget_pct is not None:
            parts.append(f"Budget usage: {budget_pct:.0f}%")
        if goal_count > 0:
            parts.append(f"Goals reached: {goals_reached}/{goal_count}")

        parts.append("")
        parts.append("Respond with only the speech bubble text, nothing else.")

        prompt = "\n".join(parts)

        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                f"{settings.OLLAMA_HOST}/api/generate",
                json={"model": "llama3.2", "prompt": prompt, "stream": False},
            )

        if response.status_code == 200:
            result = response.json()
            text = result.get("response", "").strip().strip('"\'')
            # Ensure it's reasonably short
            if text and len(text) < 120:
                return text

        return None

    except Exception:
        return None


def _build_summary_prompt(
    trends: list[dict],
    anomalies: list[dict],
    recurring: list[dict],
    forecast: dict,
) -> str:
    """Build the prompt for spending summary."""
    parts = ["Summarize this financial data in 2-3 sentences. Be specific with numbers."]

    if trends:
        top_movers = sorted(trends, key=lambda t: abs(t["diff_percent"]), reverse=True)[:3]
        parts.append("Category trends:")
        for t in top_movers:
            direction = "up" if t["diff_percent"] > 0 else "down"
            parts.append(f"- {t['category']}: {direction} {abs(t['diff_percent']):.0f}%")

    if anomalies:
        parts.append(f"There are {len(anomalies)} unusual transactions.")

    if recurring:
        total_recurring = sum(r["average_amount"] for r in recurring)
        parts.append(f"Fixed expenses total about {total_recurring:.0f} CZK/month.")

    if forecast.get("predicted_total_expenses"):
        parts.append(f"Predicted total: {forecast['predicted_total_expenses']:.0f} CZK.")

    return "\n".join(parts)
