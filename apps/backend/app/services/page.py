"""Page service for database operations."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import date

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Asset, PageTag, SvsPage, SvsPageRelation, Tag
from app.schemas.page import (
    AssetBrief,
    AssetFileResponse,
    ContentParagraph,
    ContentSection,
    CreditInfo,
    MediaType,
    PageDetailResponse,
    RelatedPage,
    RichContent,
    SearchFacets,
    SearchResponse,
    SearchResult,
    SortOption,
    TagInfo,
)


class PageService:
    """Service for SVS page operations."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_page(self, svs_id: int) -> SvsPage | None:
        """Get a single SVS page by ID."""
        query = (
            select(SvsPage)
            .options(
                selectinload(SvsPage.assets).selectinload(Asset.files),
                selectinload(SvsPage.assets).selectinload(Asset.thumbnails),
                selectinload(SvsPage.tags).selectinload(PageTag.tag),
                selectinload(SvsPage.related_pages_from).selectinload(SvsPageRelation.target_page),
            )
            .where(SvsPage.svs_id == svs_id)
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_page_detail(self, svs_id: int) -> PageDetailResponse | None:
        """Get full page details formatted for API response."""
        page = await self.get_page(svs_id)
        if not page:
            return None

        # Build rich content from content_json
        content = None
        if page.content_json:
            sections = []
            for section_data in page.content_json.get("sections", []):
                paragraphs = [
                    ContentParagraph(html=p["html"], text=p["text"])
                    for p in section_data.get("paragraphs", [])
                    if "html" in p and "text" in p
                ]
                if paragraphs:
                    sections.append(
                        ContentSection(
                            type=section_data.get("type", "description"),
                            paragraphs=paragraphs,
                        )
                    )
            if sections:
                content = RichContent(
                    format_version=page.content_json.get("format_version", 1),
                    sections=sections,
                )

        # Parse credits from JSON
        credits = []
        if page.credits_json:
            for credit in page.credits_json:
                credits.append(
                    CreditInfo(
                        role=credit.get("role", ""),
                        name=credit.get("name", ""),
                        organization=credit.get("organization"),
                    )
                )

        # Format tags
        tags = [TagInfo(type=pt.tag.tag_type, value=pt.tag.value) for pt in page.tags]

        # Format assets with captions
        assets = []
        for asset in page.assets:
            files = [
                AssetFileResponse(
                    variant=f.variant,
                    url=f.file_url,
                    mime_type=f.mime_type,
                    size_bytes=f.size_bytes,
                )
                for f in asset.files
            ]
            thumbnail_url = None
            if asset.thumbnails:
                thumbnail_url = asset.thumbnails[0].url

            assets.append(
                AssetBrief(
                    asset_id=asset.asset_id,
                    title=asset.title,
                    type=asset.media_type,
                    caption_html=asset.caption_html,
                    caption_text=asset.caption_text or asset.description,
                    files=files,
                    thumbnail_url=thumbnail_url,
                )
            )

        # Format related pages
        related_pages = [
            RelatedPage(
                svs_id=rel.target_page.svs_id,
                title=rel.target_page.title,
                rel_type=rel.relation_type,
            )
            for rel in page.related_pages_from
        ]

        return PageDetailResponse(
            svs_id=page.svs_id,
            title=page.title,
            canonical_url=page.canonical_url,
            published_date=page.published_date,
            content=content,
            summary=page.description or page.summary,
            credits=credits,
            tags=tags,
            assets=assets,
            related_pages=related_pages,
        )

    async def search(
        self,
        query: str,
        media_types: list[MediaType] | None = None,
        domain: str | None = None,
        mission: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        sort: SortOption = SortOption.RELEVANCE,
        limit: int = 20,
        offset: int = 0,
    ) -> SearchResponse:
        """Search SVS pages with filters."""
        # Base query
        base_query = select(SvsPage).where(SvsPage.status == "active")

        # Text search - use PostgreSQL full-text search if search_vector is populated
        # Otherwise fall back to ILIKE
        search_condition = or_(
            SvsPage.title.ilike(f"%{query}%"),
            SvsPage.description.ilike(f"%{query}%"),
            SvsPage.summary.ilike(f"%{query}%"),
        )
        base_query = base_query.where(search_condition)

        # Date filters
        if date_from:
            base_query = base_query.where(SvsPage.published_date >= date_from)
        if date_to:
            base_query = base_query.where(SvsPage.published_date <= date_to)

        # Media type filter (requires join to assets)
        if media_types:
            media_type_values = [mt.value for mt in media_types]
            base_query = base_query.where(
                SvsPage.svs_id.in_(select(Asset.svs_id).where(Asset.media_type.in_(media_type_values)).distinct())
            )

        # Domain/mission filter (requires join to tags)
        if domain:
            base_query = base_query.where(
                SvsPage.svs_id.in_(
                    select(PageTag.svs_id)
                    .join(Tag)
                    .where(Tag.tag_type == "domain", Tag.normalized_value == domain.lower())
                )
            )
        if mission:
            base_query = base_query.where(
                SvsPage.svs_id.in_(
                    select(PageTag.svs_id)
                    .join(Tag)
                    .where(Tag.tag_type == "mission", Tag.normalized_value == mission.lower())
                )
            )

        # Get total count
        count_query = select(func.count()).select_from(base_query.subquery())
        count_result = await self.session.execute(count_query)
        total_count = count_result.scalar() or 0

        # Sorting
        if sort == SortOption.DATE_DESC:
            base_query = base_query.order_by(SvsPage.published_date.desc().nulls_last())
        elif sort == SortOption.DATE_ASC:
            base_query = base_query.order_by(SvsPage.published_date.asc().nulls_last())
        else:
            # Relevance - for now just order by ID, will improve with FTS
            base_query = base_query.order_by(SvsPage.svs_id.desc())

        # Pagination
        base_query = base_query.offset(offset).limit(limit)

        # Load related data
        base_query = base_query.options(
            selectinload(SvsPage.assets).selectinload(Asset.thumbnails),
            selectinload(SvsPage.tags).selectinload(PageTag.tag),
        )

        # Execute
        result = await self.session.execute(base_query)
        pages = result.scalars().all()

        # Format results
        results = []
        for page in pages:
            # Use local cached thumbnail if available
            if page.thumbnail_storage_uri:
                thumbnail_url = f"/api/v1/thumbnails/pages/{page.svs_id}"
            else:
                thumbnail_url = page.thumbnail_url
            media_types_list = []
            for asset in page.assets:
                if asset.media_type not in media_types_list:
                    media_types_list.append(asset.media_type)
                if not thumbnail_url and asset.thumbnails:
                    thumbnail_url = asset.thumbnails[0].url

            # Get tags
            tag_values = [pt.tag.value for pt in page.tags[:5]]  # Limit to 5 tags

            # Create snippet from description
            snippet = ""
            if page.description:
                snippet = page.description[:200] + "..." if len(page.description) > 200 else page.description
            elif page.summary:
                snippet = page.summary[:200] + "..." if len(page.summary) > 200 else page.summary

            results.append(
                SearchResult(
                    svs_id=page.svs_id,
                    title=page.title,
                    snippet=snippet,
                    published_date=page.published_date,
                    canonical_url=page.canonical_url,
                    thumbnail_url=thumbnail_url,
                    media_types=media_types_list,
                    tags=tag_values,
                    score=0.5,  # Placeholder score
                )
            )

        # Calculate facets (simplified - would be more efficient with aggregation queries)
        facets = await self._get_facets(query, date_from, date_to)

        # Build pagination URLs
        next_url = None
        prev_url = None
        if offset + limit < total_count:
            next_url = f"/api/v1/search?q={query}&offset={offset + limit}&limit={limit}"
        if offset > 0:
            prev_url = f"/api/v1/search?q={query}&offset={max(0, offset - limit)}&limit={limit}"

        return SearchResponse(
            count=total_count,
            results=results,
            facets=facets,
            next=next_url,
            previous=prev_url,
        )

    async def _get_facets(
        self,
        query: str,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> SearchFacets:
        """Get facet counts for search results."""
        # This is a simplified implementation
        # In production, these would be computed alongside the main query
        return SearchFacets(
            media_type={},
            domain={},
            mission={},
        )

    async def list_pages(
        self,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[Sequence[SvsPage], int]:
        """List pages with pagination."""
        # Count query
        count_query = select(func.count()).select_from(SvsPage)
        count_result = await self.session.execute(count_query)
        total_count = count_result.scalar() or 0

        # Data query
        query = select(SvsPage).order_by(SvsPage.svs_id.desc()).offset(offset).limit(limit)
        result = await self.session.execute(query)
        pages = result.scalars().all()

        return pages, total_count

    async def get_recent_highlights(self, limit: int = 6) -> list[SearchResult]:
        """Get recent pages with thumbnails for homepage highlights."""
        # Query for recent pages that have been crawled and have thumbnails
        query = (
            select(SvsPage)
            .where(
                SvsPage.status == "active",
                SvsPage.html_crawled_at.isnot(None),
                SvsPage.thumbnail_url.isnot(None),
            )
            .order_by(SvsPage.published_date.desc().nulls_last())
            .limit(limit)
            .options(
                selectinload(SvsPage.assets).selectinload(Asset.thumbnails),
                selectinload(SvsPage.tags).selectinload(PageTag.tag),
            )
        )
        result = await self.session.execute(query)
        pages = result.scalars().all()

        # Format results
        results = []
        for page in pages:
            # Get media types from assets
            media_types_list = []
            for asset in page.assets:
                if asset.media_type and asset.media_type not in media_types_list:
                    media_types_list.append(asset.media_type)

            # Get tags
            tag_values = [pt.tag.value for pt in page.tags[:5]]

            # Create snippet
            snippet = ""
            if page.description:
                snippet = page.description[:200] + "..." if len(page.description) > 200 else page.description
            elif page.summary:
                snippet = page.summary[:200] + "..." if len(page.summary) > 200 else page.summary

            # Use local cached thumbnail if available
            if page.thumbnail_storage_uri:
                thumbnail_url = f"/api/v1/thumbnails/pages/{page.svs_id}"
            else:
                thumbnail_url = page.thumbnail_url

            results.append(
                SearchResult(
                    svs_id=page.svs_id,
                    title=page.title,
                    snippet=snippet,
                    published_date=page.published_date,
                    canonical_url=page.canonical_url,
                    thumbnail_url=thumbnail_url,
                    media_types=media_types_list,
                    tags=tag_values,
                    score=1.0,
                )
            )

        return results
