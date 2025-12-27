"""FastAPI application entry point."""

from __future__ import annotations

import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import admin, assets, chat, pages, search, thumbnails
from app.config import get_settings
from app.database import close_database_connection, verify_database_connection
from app.middleware.headers import RateLimitHeadersMiddleware
from app.redis import close_redis, init_redis, verify_redis_connection
from app.services.embedding import preload_embedding_model
from app.services.storage import get_storage_service

logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan handler for startup/shutdown events."""
    # Startup
    logger.info("Starting SVS Browser API...")

    # Initialize MinIO bucket for thumbnail storage
    try:
        storage = get_storage_service()
        storage.ensure_bucket_exists()
        logger.info("MinIO storage initialized")
    except Exception as e:
        # Log but don't fail startup - thumbnails will fall back to external URLs
        logger.warning(f"Failed to initialize MinIO bucket: {e}")

    # Verify database connection
    db_ok = await verify_database_connection()
    if not db_ok:
        logger.error("Database connection failed - application may not function correctly")

    # Initialize Redis connection
    redis_ok = await init_redis()
    if not redis_ok:
        logger.warning("Redis connection failed - caching will be disabled")

    # Preload embedding model (for local backend only)
    # This is done in a non-blocking way to avoid slowing startup
    try:
        preload_embedding_model()
    except Exception as e:
        logger.warning(f"Embedding model preload failed: {e}")

    logger.info("SVS Browser API startup complete")

    yield

    # Shutdown
    logger.info("Shutting down SVS Browser API...")

    # Close Redis connection
    await close_redis()

    # Close database connections
    await close_database_connection()

    logger.info("SVS Browser API shutdown complete")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="NASA Scientific Visualization Studio Knowledge Browser API",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limit headers middleware
app.add_middleware(RateLimitHeadersMiddleware)

# Include API routers
app.include_router(search.router, prefix="/api/v1", tags=["search"])
app.include_router(pages.router, prefix="/api/v1", tags=["pages"])
app.include_router(assets.router, prefix="/api/v1", tags=["assets"])
app.include_router(chat.router, prefix="/api/v1", tags=["chat"])
app.include_router(thumbnails.router, prefix="/api/v1", tags=["thumbnails"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["admin"])


@app.get("/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "healthy", "version": settings.app_version}


@app.get("/ready")
async def readiness_check() -> dict[str, str | bool]:
    """
    Readiness check endpoint.

    Verifies that all required services are available and responding.
    Returns 503 if any critical service is unavailable.
    """
    db_ok = await verify_database_connection()
    redis_ok = await verify_redis_connection()

    status = {
        "status": "ready" if db_ok else "degraded",
        "database": db_ok,
        "redis": redis_ok,
    }

    # Database is required; Redis is optional (caching only)
    if not db_ok:
        raise HTTPException(
            status_code=503,
            detail={
                "status": "not ready",
                "database": db_ok,
                "redis": redis_ok,
                "message": "Database connection unavailable",
            },
        )

    return status
