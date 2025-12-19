"""FastAPI application entry point."""

from __future__ import annotations

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import admin, assets, chat, pages, search, thumbnails
from app.config import get_settings
from app.services.storage import get_storage_service

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan handler for startup/shutdown events."""
    # Startup
    # Initialize MinIO bucket for thumbnail storage
    try:
        storage = get_storage_service()
        storage.ensure_bucket_exists()
    except Exception as e:
        # Log but don't fail startup - thumbnails will fall back to external URLs
        import logging

        logging.getLogger(__name__).warning(f"Failed to initialize MinIO bucket: {e}")

    # TODO: Initialize database connection pool
    # TODO: Initialize Redis connection
    # TODO: Load embedding model
    yield
    # Shutdown
    # TODO: Close database connections
    # TODO: Close Redis connection


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
async def readiness_check() -> dict[str, str]:
    """Readiness check endpoint."""
    # TODO: Check database connection
    # TODO: Check Redis connection
    return {"status": "ready"}
