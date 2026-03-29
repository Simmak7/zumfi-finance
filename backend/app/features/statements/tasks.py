"""Celery tasks for AI-assisted categorization.

These tasks run asynchronously via the Celery worker,
so they don't block HTTP requests.
"""

from core.celery_app import celery_app


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30)
def classify_with_ai(self, transaction_id: int, description: str, owner_id: int):
    """Use Ollama to classify a transaction description.

    This is a placeholder that will be fully implemented when
    Ollama integration is added in Phase 6 (Analysis feature).
    """
    try:
        import httpx
        from core.config import get_settings

        settings = get_settings()

        response = httpx.post(
            f"{settings.OLLAMA_HOST}/api/generate",
            json={
                "model": "llama3.2",
                "prompt": (
                    f"Classify this bank transaction into a category. "
                    f"Transaction: '{description}'. "
                    f"Respond with just the category name. "
                    f"Common categories: Groceries, Eating out, Entertainment, "
                    f"Transport, Utilities, Rent, Subscriptions, Shopping, Health."
                ),
                "stream": False,
            },
            timeout=30.0,
        )

        if response.status_code == 200:
            result = response.json()
            suggested = result.get("response", "").strip()
            return {
                "transaction_id": transaction_id,
                "suggested_category": suggested,
                "status": "completed",
            }

    except Exception as exc:
        return {
            "transaction_id": transaction_id,
            "suggested_category": None,
            "status": "failed",
            "error": str(exc),
        }
