"""Response headers middleware."""

from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response


class RateLimitHeadersMiddleware(BaseHTTPMiddleware):
    """Middleware to add rate limit headers to responses."""

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        response = await call_next(request)

        # Add rate limit headers if they were set by the rate limiter
        if hasattr(request.state, "rate_limit_limit"):
            response.headers["X-RateLimit-Limit"] = str(request.state.rate_limit_limit)
            response.headers["X-RateLimit-Remaining"] = str(
                request.state.rate_limit_remaining
            )
            response.headers["X-RateLimit-Reset"] = str(request.state.rate_limit_reset)

        return response
