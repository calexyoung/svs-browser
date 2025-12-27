"""Redis connection management."""

from __future__ import annotations

import logging

import redis.asyncio as redis

from app.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

# Redis connection pool
_redis_pool: redis.ConnectionPool | None = None
_redis_client: redis.Redis | None = None


async def init_redis() -> bool:
    """Initialize Redis connection pool."""
    global _redis_pool, _redis_client
    try:
        _redis_pool = redis.ConnectionPool.from_url(
            settings.redis_url,
            decode_responses=True,
            max_connections=10,
        )
        _redis_client = redis.Redis(connection_pool=_redis_pool)
        # Verify connection
        await _redis_client.ping()
        logger.info("Redis connection initialized")
        return True
    except Exception as e:
        logger.error(f"Failed to initialize Redis: {e}")
        _redis_pool = None
        _redis_client = None
        return False


async def get_redis() -> redis.Redis | None:
    """Get Redis client instance."""
    global _redis_client
    if _redis_client is None:
        await init_redis()
    return _redis_client


async def verify_redis_connection() -> bool:
    """Verify Redis connection is working."""
    try:
        client = await get_redis()
        if client is None:
            return False
        await client.ping()
        return True
    except Exception as e:
        logger.error(f"Redis connection check failed: {e}")
        return False


async def close_redis() -> None:
    """Close Redis connection pool."""
    global _redis_pool, _redis_client
    try:
        if _redis_client is not None:
            await _redis_client.aclose()
            _redis_client = None
        if _redis_pool is not None:
            await _redis_pool.aclose()
            _redis_pool = None
        logger.info("Redis connection closed")
    except Exception as e:
        logger.error(f"Error closing Redis connection: {e}")
