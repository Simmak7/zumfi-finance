import os
import sys

# Ensure /app is on the Python path for imports
app_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if app_dir not in sys.path:
    sys.path.insert(0, app_dir)

from celery import Celery
from core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "finance_app",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["features.statements.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_default_queue="ai_analysis",
    result_expires=3600,
    worker_prefetch_multiplier=1,
    task_acks_late=True,
)
