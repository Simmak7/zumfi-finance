import redis.asyncio as aioredis
from core.config import get_settings

settings = get_settings()
redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
