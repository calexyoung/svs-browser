"""Search API endpoints."""
from __future__ import annotations


from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.page import MediaType, SearchResponse, SortOption
from app.services.search import SearchService

router = APIRouter()


@router.get("/search", response_model=SearchResponse)
async def search(
    q: str = Query(..., min_length=1, max_length=500, description="Search query"),
    media_type: list[MediaType] | None = Query(None, description="Filter by media types"),
    domain: str | None = Query(None, max_length=100, description="Filter by domain"),
    mission: str | None = Query(None, max_length=100, description="Filter by mission"),
    date_from: date | None = Query(None, description="Published after date"),
    date_to: date | None = Query(None, description="Published before date"),
    sort: SortOption = Query(SortOption.RELEVANCE, description="Sort order"),
    limit: int = Query(20, ge=1, le=100, description="Results per page"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    db: AsyncSession = Depends(get_db),
) -> SearchResponse:
    """
    Search SVS visualizations.

    Supports:
    - Full-text keyword search across titles and descriptions
    - Filtering by media type, domain, mission, and date range
    - Pagination with limit/offset
    - Sorting by relevance or date

    If the query is a numeric SVS ID (e.g., "5502"), it performs a direct lookup.
    """
    service = SearchService(db)
    return await service.search(
        query=q,
        media_types=media_type,
        domain=domain,
        mission=mission,
        date_from=date_from,
        date_to=date_to,
        sort=sort,
        limit=limit,
        offset=offset,
    )
