"""Thumbnails API endpoints for serving cached thumbnails."""

from fastapi import APIRouter, Depends, HTTPException, Path
from fastapi.responses import RedirectResponse, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import SvsPage
from app.services.storage import get_storage_service, MinioStorageService
from app.services.thumbnail import ThumbnailService

router = APIRouter()


def get_thumbnail_service(
    storage: MinioStorageService = Depends(get_storage_service),
) -> ThumbnailService:
    """Get thumbnail service dependency."""
    return ThumbnailService(storage)


@router.get("/thumbnails/pages/{svs_id}")
async def get_page_thumbnail(
    svs_id: int = Path(..., description="SVS page ID"),
    db: AsyncSession = Depends(get_db),
    thumbnail_service: ThumbnailService = Depends(get_thumbnail_service),
) -> Response:
    """
    Get cached thumbnail for an SVS page.

    Returns:
    - Cached thumbnail from MinIO if available (200 with image data)
    - 307 redirect to external URL if not cached locally
    - 404 if page has no thumbnail
    """
    # Query page for thumbnail info
    query = select(SvsPage).where(SvsPage.svs_id == svs_id)
    result = await db.execute(query)
    page = result.scalar_one_or_none()

    if not page:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "PAGE_NOT_FOUND",
                "message": f"Page SVS-{svs_id} not found",
            },
        )

    # If we have a cached thumbnail, serve it from MinIO
    if page.thumbnail_storage_uri:
        thumbnail_data = thumbnail_service.get_thumbnail_data(page.thumbnail_storage_uri)
        if thumbnail_data:
            data, content_type = thumbnail_data
            return Response(
                content=data,
                media_type=content_type,
                headers={
                    "Cache-Control": "public, max-age=86400",  # Cache for 24 hours
                    "X-Thumbnail-Source": "cache",
                },
            )

    # If we have an external URL but no cache, redirect to it
    if page.thumbnail_url:
        return RedirectResponse(
            url=page.thumbnail_url,
            status_code=307,  # Temporary redirect
            headers={
                "X-Thumbnail-Source": "external",
            },
        )

    # No thumbnail available
    raise HTTPException(
        status_code=404,
        detail={
            "code": "THUMBNAIL_NOT_FOUND",
            "message": f"No thumbnail available for page SVS-{svs_id}",
        },
    )
