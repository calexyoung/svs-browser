"""Rate limiting middleware using Redis sliding window."""

from __future__ import annotations

import logging
import time
from typing import Callable

from fastapi import HTTPException, Request, status

from app.config import get_settings
from app.redis import get_redis

logger = logging.getLogger(__name__)
settings = get_settings()


class RateLimitExceeded(HTTPException):
    """Exception raised when rate limit is exceeded."""

    def __init__(self, limit: int, window: int, retry_after: int):
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "error": "rate_limit_exceeded",
                "message": f"Rate limit of {limit} requests per {window} seconds exceeded",
                "retry_after": retry_after,
            },
            headers={"Retry-After": str(retry_after)},
        )


def get_client_ip(request: Request) -> str:
    """Extract client IP from request, considering proxies."""
    # Check for forwarded headers (when behind proxy/load balancer)
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        # Take the first IP (original client)
        return forwarded.split(",")[0].strip()

    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip

    # Fall back to direct connection
    if request.client:
        return request.client.host

    return "unknown"


async def check_rate_limit(
    request: Request,
    key_prefix: str,
    limit: int,
    window: int = 60,
) -> None:
    """
    Check rate limit using Redis sliding window algorithm.

    Args:
        request: FastAPI request object
        key_prefix: Prefix for the Redis key (e.g., "search", "chat")
        limit: Maximum requests allowed in the window
        window: Time window in seconds (default: 60)

    Raises:
        RateLimitExceeded: If rate limit is exceeded
    """
    redis = await get_redis()

    # If Redis is unavailable, allow the request (fail open)
    if redis is None:
        logger.warning("Redis unavailable, skipping rate limit check")
        return

    client_ip = get_client_ip(request)
    current_time = int(time.time())
    window_start = current_time - window

    # Redis key for this client and endpoint type
    key = f"rate_limit:{key_prefix}:{client_ip}"

    try:
        # Use Redis pipeline for atomic operations
        pipe = redis.pipeline()

        # Remove old entries outside the window
        pipe.zremrangebyscore(key, 0, window_start)

        # Count requests in current window
        pipe.zcard(key)

        # Add current request with timestamp as score
        pipe.zadd(key, {f"{current_time}:{id(request)}": current_time})

        # Set expiry on the key
        pipe.expire(key, window + 1)

        results = await pipe.execute()
        request_count = results[1]  # zcard result

        if request_count >= limit:
            # Calculate retry-after based on oldest request in window
            oldest = await redis.zrange(key, 0, 0, withscores=True)
            if oldest:
                oldest_time = int(oldest[0][1])
                retry_after = max(1, window - (current_time - oldest_time))
            else:
                retry_after = window

            logger.warning(
                f"Rate limit exceeded for {client_ip} on {key_prefix}: "
                f"{request_count}/{limit} requests"
            )
            raise RateLimitExceeded(limit=limit, window=window, retry_after=retry_after)

        # Add rate limit headers to response
        request.state.rate_limit_limit = limit
        request.state.rate_limit_remaining = max(0, limit - request_count - 1)
        request.state.rate_limit_reset = current_time + window

    except RateLimitExceeded:
        raise
    except Exception as e:
        # Log error but don't block the request (fail open)
        logger.error(f"Rate limit check failed: {e}")


def create_rate_limiter(key_prefix: str, limit: int, window: int = 60) -> Callable:
    """
    Factory function to create rate limit dependencies.

    Args:
        key_prefix: Prefix for the Redis key
        limit: Maximum requests per window
        window: Time window in seconds

    Returns:
        FastAPI dependency function
    """

    async def rate_limiter(request: Request) -> None:
        await check_rate_limit(request, key_prefix, limit, window)

    return rate_limiter


# Pre-configured rate limiters based on settings
async def rate_limit_search(request: Request) -> None:
    """Rate limiter for search endpoints (60 req/min default)."""
    await check_rate_limit(
        request,
        key_prefix="search",
        limit=settings.rate_limit_search,
        window=60,
    )


async def rate_limit_chat(request: Request) -> None:
    """Rate limiter for chat endpoints (20 req/min default)."""
    await check_rate_limit(
        request,
        key_prefix="chat",
        limit=settings.rate_limit_chat,
        window=60,
    )


async def rate_limit_admin(request: Request) -> None:
    """Rate limiter for admin endpoints (30 req/min default)."""
    await check_rate_limit(
        request,
        key_prefix="admin",
        limit=settings.rate_limit_admin,
        window=60,
    )
