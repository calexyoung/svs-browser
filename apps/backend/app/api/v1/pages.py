"""SVS Page API endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.page import PageDetailResponse, PageListResponse, SearchResult
from app.services.page import PageService

router = APIRouter()


@router.get("/pages/recent", response_model=list[SearchResult])
async def get_recent_highlights(
    limit: int = Query(6, ge=1, le=20, description="Number of recent items"),
    db: AsyncSession = Depends(get_db),
) -> list[SearchResult]:
    """
    Get recent SVS pages for homepage highlights.

    Returns pages ordered by publication date that have:
    - Been fully crawled (have content)
    - Have a thumbnail image
    """
    service = PageService(db)
    return await service.get_recent_highlights(limit=limit)


@router.get("/svs/{svs_id}", response_model=PageDetailResponse)
async def get_page(
    svs_id: int = Path(..., ge=1, description="SVS page ID"),
    db: AsyncSession = Depends(get_db),
) -> PageDetailResponse:
    """
    Get detailed information about an SVS page.

    Returns:
    - Full page metadata (title, description, publication date)
    - Credits and attribution
    - Associated tags
    - All assets with file variants and thumbnails
    - Related SVS pages
    """
    service = PageService(db)
    page = await service.get_page_detail(svs_id)

    if not page:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "PAGE_NOT_FOUND",
                "message": f"SVS page {svs_id} not found",
            },
        )

    return page


@router.get("/pages", response_model=PageListResponse)
async def list_pages(
    limit: int = Query(20, ge=1, le=100, description="Results per page"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    db: AsyncSession = Depends(get_db),
) -> PageListResponse:
    """
    List SVS pages with pagination.

    This endpoint is primarily for admin/development use.
    For searching content, use /search instead.
    """
    service = PageService(db)
    pages, total = await service.list_pages(limit=limit, offset=offset)

    # Convert to response format
    results = []
    for page in pages:
        results.append(
            PageDetailResponse(
                svs_id=page.svs_id,
                title=page.title,
                canonical_url=page.canonical_url,
                published_date=page.published_date,
                summary=page.description or page.summary,
                credits=[],
                tags=[],
                assets=[],
                related_pages=[],
            )
        )

    next_url = None
    prev_url = None
    if offset + limit < total:
        next_url = f"/api/v1/pages?offset={offset + limit}&limit={limit}"
    if offset > 0:
        prev_url = f"/api/v1/pages?offset={max(0, offset - limit)}&limit={limit}"

    return PageListResponse(
        count=total,
        results=results,
        next=next_url,
        previous=prev_url,
    )
