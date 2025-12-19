"""Search service with PostgreSQL full-text search."""
from __future__ import annotations


import logging
import re
from datetime import date
from typing import Any

from sqlalchemy import Float, String, and_, case, cast, func, literal, or_, select, text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Asset, AssetThumbnail, PageTag, SvsPage, Tag
from app.schemas.page import (
    MediaType,
    SearchFacets,
    SearchResponse,
    SearchResult,
    SortOption,
)

logger = logging.getLogger(__name__)


class SearchService:
    """Service for searching SVS pages using PostgreSQL full-text search."""

    def __init__(self, session: AsyncSession):
        self.session = session

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
        """
        Search SVS pages with full-text search and filters.

        Uses PostgreSQL tsvector for efficient text search with ranking.
        """
        # Check if query is a numeric SVS ID
        if query.strip().isdigit():
            return await self._search_by_id(int(query.strip()), limit, offset)

        # Build the search query
        search_term = self._prepare_search_term(query)

        # Base query with FTS - only include crawled pages with content
        base_query = (
            select(SvsPage)
            .where(
                SvsPage.status == "active",
                SvsPage.html_crawled_at.isnot(None),  # Only crawled pages
            )
        )

        # Add text search condition
        if search_term:
            # Use websearch_to_tsquery for boolean search support
            # Supports: word1 word2 (AND), word1 OR word2, -word (NOT), "phrase"
            ts_query = func.websearch_to_tsquery("english", search_term)

            # Build title fallback condition
            # For boolean queries, require all non-excluded terms in title
            if self._is_boolean_query(query):
                search_words = self._extract_search_words(query)
                excluded_words = self._extract_excluded_words(query)

                conditions = []
                if search_words:
                    # Require all non-excluded words in title
                    for word in search_words:
                        conditions.append(SvsPage.title.ilike(f"%{word}%"))

                # For title fallback, we can't easily exclude terms since ILIKE
                # only checks the title. Rely on FTS for proper exclusion.
                title_fallback = and_(*conditions) if conditions else SvsPage.title.ilike(f"%{query}%")
            else:
                title_fallback = SvsPage.title.ilike(f"%{query}%")

            # Apply exclusions to both FTS and title matches
            excluded_words = self._extract_excluded_words(query) if self._is_boolean_query(query) else []
            exclusion_conditions = []
            for word in excluded_words:
                # Exclude from title AND description to ensure excluded terms are truly excluded
                exclusion_conditions.append(~SvsPage.title.ilike(f"%{word}%"))
                exclusion_conditions.append(~SvsPage.description.ilike(f"%{word}%"))

            # Search in search_vector if populated, with ILIKE fallback for title only
            text_condition = or_(
                SvsPage.search_vector.op("@@")(ts_query),
                title_fallback,
            )
            base_query = base_query.where(text_condition)

            # Apply exclusion conditions (for NOT operator)
            if exclusion_conditions:
                base_query = base_query.where(and_(*exclusion_conditions))

            # Apply minimum relevance threshold for relevance-sorted searches
            # This filters out results where the search term is only mentioned tangentially
            # Score of 0.065 excludes the lowest-ranked matches (typically single mentions)
            # Title matches (rank=0) are preserved since they're high-signal
            if sort == SortOption.RELEVANCE:
                rank = func.ts_rank(SvsPage.search_vector, ts_query)
                min_relevance_filter = or_(
                    rank >= 0.065,  # FTS results with meaningful relevance
                    title_fallback,  # Title matches are always relevant
                )
                base_query = base_query.where(min_relevance_filter)

        # Apply filters
        base_query = self._apply_filters(
            base_query, media_types, domain, mission, date_from, date_to
        )

        # Get total count before pagination
        count_query = select(func.count()).select_from(base_query.subquery())
        count_result = await self.session.execute(count_query)
        total_count = count_result.scalar() or 0

        # Apply sorting
        base_query = self._apply_sorting(base_query, sort, search_term)

        # Apply pagination
        base_query = base_query.offset(offset).limit(limit)

        # Load relationships for results
        base_query = base_query.options(
            selectinload(SvsPage.assets).selectinload(Asset.thumbnails),
            selectinload(SvsPage.tags).selectinload(PageTag.tag),
        )

        # Execute query
        result = await self.session.execute(base_query)
        pages = result.scalars().all()

        # Format results
        results = self._format_results(pages, query)

        # Get facets
        facets = await self._get_facets(query, date_from, date_to)

        # Build pagination URLs
        next_url, prev_url = self._build_pagination_urls(
            query, media_types, domain, mission, date_from, date_to,
            sort, limit, offset, total_count
        )

        return SearchResponse(
            count=total_count,
            results=results,
            facets=facets,
            next=next_url,
            previous=prev_url,
        )

    async def _search_by_id(
        self, svs_id: int, limit: int, offset: int
    ) -> SearchResponse:
        """Search for a specific SVS ID."""
        query = (
            select(SvsPage)
            .where(SvsPage.svs_id == svs_id, SvsPage.status == "active")
            .options(
                selectinload(SvsPage.assets).selectinload(Asset.thumbnails),
                selectinload(SvsPage.tags).selectinload(PageTag.tag),
            )
        )
        result = await self.session.execute(query)
        page = result.scalar_one_or_none()

        if page:
            results = self._format_results([page], str(svs_id))
            return SearchResponse(
                count=1,
                results=results,
                facets=SearchFacets(),
                next=None,
                previous=None,
            )

        return SearchResponse(
            count=0,
            results=[],
            facets=SearchFacets(),
            next=None,
            previous=None,
        )

    def _prepare_search_term(self, query: str) -> str:
        """
        Prepare search term for PostgreSQL FTS.

        Supports websearch syntax:
        - word1 word2     : both words required (AND)
        - word1 OR word2  : either word (OR)
        - -word           : exclude word (NOT)
        - "exact phrase"  : phrase match
        """
        # Clean and normalize the query
        term = query.strip()

        # Preserve boolean operators and quotes for websearch_to_tsquery
        # Only remove characters that could break the query
        for char in ["'", ":", "&", "|", "!", "(", ")", "<", ">"]:
            # Don't remove if it's part of boolean syntax
            if char not in ["-"]:  # Keep minus for exclusion
                term = term.replace(char, " ")

        # Collapse multiple spaces (but preserve quoted strings)
        # Split on quotes to preserve quoted phrases
        parts = re.split(r'(".*?")', term)
        cleaned_parts = []
        for part in parts:
            if part.startswith('"') and part.endswith('"'):
                cleaned_parts.append(part)
            else:
                cleaned_parts.append(" ".join(part.split()))
        term = "".join(cleaned_parts)

        return term

    def _is_boolean_query(self, query: str) -> bool:
        """Check if query contains boolean operators."""
        # Check for OR, quotes, or minus prefix
        return bool(
            re.search(r'\bOR\b', query, re.IGNORECASE) or
            '"' in query or
            re.search(r'(^|\s)-\w', query)
        )

    def _extract_search_words(self, query: str) -> list[str]:
        """Extract individual search words (non-excluded) from a boolean query."""
        # Remove boolean operators and extract words
        cleaned = re.sub(r'\bOR\b', ' ', query, flags=re.IGNORECASE)
        cleaned = re.sub(r'-\w+', '', cleaned)  # Remove excluded terms
        # Extract words and quoted phrases
        words = re.findall(r'"([^"]+)"|(\w+)', cleaned)
        return [w[0] or w[1] for w in words if w[0] or w[1]]

    def _extract_excluded_words(self, query: str) -> list[str]:
        """Extract words that should be excluded (prefixed with -)."""
        matches = re.findall(r'(?:^|\s)-(\w+)', query)
        return matches

    def _apply_filters(
        self,
        query,
        media_types: list[MediaType] | None,
        domain: str | None,
        mission: str | None,
        date_from: date | None,
        date_to: date | None,
    ):
        """Apply search filters to query."""
        # Date filters
        if date_from:
            query = query.where(SvsPage.published_date >= date_from)
        if date_to:
            query = query.where(SvsPage.published_date <= date_to)

        # Media type filter
        if media_types:
            media_type_values = [mt.value for mt in media_types]
            subq = (
                select(Asset.svs_id)
                .where(Asset.media_type.in_(media_type_values))
                .distinct()
            )
            query = query.where(SvsPage.svs_id.in_(subq))

        # Domain filter
        if domain:
            subq = (
                select(PageTag.svs_id)
                .join(Tag)
                .where(
                    Tag.tag_type == "domain",
                    func.lower(Tag.normalized_value) == domain.lower(),
                )
            )
            query = query.where(SvsPage.svs_id.in_(subq))

        # Mission filter
        if mission:
            subq = (
                select(PageTag.svs_id)
                .join(Tag)
                .where(
                    Tag.tag_type == "mission",
                    func.lower(Tag.normalized_value) == mission.lower(),
                )
            )
            query = query.where(SvsPage.svs_id.in_(subq))

        return query

    def _apply_sorting(self, query, sort: SortOption, search_term: str | None):
        """Apply sorting to query."""
        # Boost for crawled pages with thumbnails (prioritize complete pages)
        has_thumbnail = case(
            (SvsPage.thumbnail_url.isnot(None), 1),
            else_=0
        )

        if sort == SortOption.DATE_DESC:
            return query.order_by(
                has_thumbnail.desc(),
                SvsPage.published_date.desc().nulls_last()
            )
        elif sort == SortOption.DATE_ASC:
            return query.order_by(
                has_thumbnail.desc(),
                SvsPage.published_date.asc().nulls_last()
            )
        else:
            # Relevance sorting - use ts_rank if we have a search term
            if search_term:
                ts_query = func.websearch_to_tsquery("english", search_term)
                rank = func.ts_rank(SvsPage.search_vector, ts_query)

                # Calculate a combined relevance score that also considers ILIKE matches
                # Pages matching in title get a boost even without tsvector match
                title_match_boost = case(
                    (SvsPage.title.ilike(f"%{search_term}%"), 0.1),
                    else_=0.0
                )
                combined_rank = rank + title_match_boost

                return query.order_by(has_thumbnail.desc(), combined_rank.desc(), SvsPage.svs_id.desc())
            else:
                return query.order_by(has_thumbnail.desc(), SvsPage.svs_id.desc())

    def _format_results(
        self, pages: list[SvsPage], query: str
    ) -> list[SearchResult]:
        """Format page results for API response."""
        results = []

        for page in pages:
            # Use local cached thumbnail if available, else external URL
            if page.thumbnail_storage_uri:
                thumbnail_url = f"/api/v1/thumbnails/pages/{page.svs_id}"
            else:
                thumbnail_url = page.thumbnail_url
            media_types = []
            for asset in page.assets:
                if asset.media_type not in media_types:
                    media_types.append(asset.media_type)
                if not thumbnail_url and asset.thumbnails:
                    thumbnail_url = asset.thumbnails[0].url

            # Get tags (limit to 5)
            tags = [pt.tag.value for pt in page.tags[:5]]

            # Create snippet with highlighting
            snippet = self._create_snippet(page.description or page.summary or "", query)

            # Calculate relevance score (simplified)
            score = self._calculate_score(page, query)

            results.append(SearchResult(
                svs_id=page.svs_id,
                title=page.title,
                snippet=snippet,
                published_date=page.published_date,
                canonical_url=page.canonical_url,
                thumbnail_url=thumbnail_url,
                media_types=media_types,
                tags=tags,
                score=score,
            ))

        return results

    def _create_snippet(self, text: str, query: str, max_length: int = 200) -> str:
        """Create a snippet from text, highlighting query terms."""
        if not text:
            return ""

        text = text.strip()

        # Try to find the query in the text
        query_lower = query.lower()
        text_lower = text.lower()

        pos = text_lower.find(query_lower)
        if pos >= 0:
            # Center the snippet around the query
            start = max(0, pos - 50)
            end = min(len(text), pos + len(query) + 150)

            snippet = text[start:end]
            if start > 0:
                snippet = "..." + snippet
            if end < len(text):
                snippet = snippet + "..."
        else:
            # Just return the beginning
            if len(text) > max_length:
                snippet = text[:max_length] + "..."
            else:
                snippet = text

        return snippet

    def _calculate_score(self, page: SvsPage, query: str) -> float:
        """Calculate a relevance score for a result."""
        score = 0.5  # Base score

        query_lower = query.lower()

        # Title match is highest weight
        if query_lower in page.title.lower():
            score += 0.3
            if page.title.lower().startswith(query_lower):
                score += 0.1

        # Description match
        if page.description and query_lower in page.description.lower():
            score += 0.1

        return min(score, 1.0)

    async def _get_facets(
        self,
        query: str,
        date_from: date | None,
        date_to: date | None,
    ) -> SearchFacets:
        """Get facet counts for search filters."""
        search_term = self._prepare_search_term(query)

        # Build base filter for the search
        base_filter = [SvsPage.status == "active"]

        if search_term:
            ts_query = func.websearch_to_tsquery("english", search_term)
            # Match search query condition - FTS or title match only
            base_filter.append(
                or_(
                    SvsPage.search_vector.op("@@")(ts_query),
                    SvsPage.title.ilike(f"%{search_term}%"),
                )
            )

        if date_from:
            base_filter.append(SvsPage.published_date >= date_from)
        if date_to:
            base_filter.append(SvsPage.published_date <= date_to)

        # Media type facets
        media_type_query = (
            select(Asset.media_type, func.count(func.distinct(Asset.svs_id)))
            .join(SvsPage, SvsPage.svs_id == Asset.svs_id)
            .where(*base_filter)
            .group_by(Asset.media_type)
        )
        media_result = await self.session.execute(media_type_query)
        media_facets = {row[0]: row[1] for row in media_result.all()}

        # Domain facets
        domain_query = (
            select(Tag.value, func.count(func.distinct(PageTag.svs_id)))
            .join(PageTag, PageTag.tag_id == Tag.tag_id)
            .join(SvsPage, SvsPage.svs_id == PageTag.svs_id)
            .where(*base_filter, Tag.tag_type == "domain")
            .group_by(Tag.value)
            .order_by(func.count(func.distinct(PageTag.svs_id)).desc())
            .limit(20)
        )
        domain_result = await self.session.execute(domain_query)
        domain_facets = {row[0]: row[1] for row in domain_result.all()}

        # Mission facets
        mission_query = (
            select(Tag.value, func.count(func.distinct(PageTag.svs_id)))
            .join(PageTag, PageTag.tag_id == Tag.tag_id)
            .join(SvsPage, SvsPage.svs_id == PageTag.svs_id)
            .where(*base_filter, Tag.tag_type == "mission")
            .group_by(Tag.value)
            .order_by(func.count(func.distinct(PageTag.svs_id)).desc())
            .limit(20)
        )
        mission_result = await self.session.execute(mission_query)
        mission_facets = {row[0]: row[1] for row in mission_result.all()}

        return SearchFacets(
            media_type=media_facets,
            domain=domain_facets,
            mission=mission_facets,
        )

    def _build_pagination_urls(
        self,
        query: str,
        media_types: list[MediaType] | None,
        domain: str | None,
        mission: str | None,
        date_from: date | None,
        date_to: date | None,
        sort: SortOption,
        limit: int,
        offset: int,
        total_count: int,
    ) -> tuple[str | None, str | None]:
        """Build pagination URLs."""
        base = f"/api/v1/search?q={query}"

        if media_types:
            for mt in media_types:
                base += f"&media_type={mt.value}"
        if domain:
            base += f"&domain={domain}"
        if mission:
            base += f"&mission={mission}"
        if date_from:
            base += f"&date_from={date_from}"
        if date_to:
            base += f"&date_to={date_to}"
        if sort != SortOption.RELEVANCE:
            base += f"&sort={sort.value}"

        base += f"&limit={limit}"

        next_url = None
        prev_url = None

        if offset + limit < total_count:
            next_url = f"{base}&offset={offset + limit}"
        if offset > 0:
            prev_url = f"{base}&offset={max(0, offset - limit)}"

        return next_url, prev_url


async def update_search_vectors(session: AsyncSession, svs_ids: list[int] | None = None) -> int:
    """
    Update search vectors for pages.

    This should be run after ingestion to populate the tsvector column.
    """
    # Build the tsvector from title and description
    update_sql = """
        UPDATE svs_page
        SET search_vector =
            setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
            setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
            setweight(to_tsvector('english', coalesce(description, '')), 'C')
    """

    if svs_ids:
        update_sql += f" WHERE svs_id IN ({','.join(str(id) for id in svs_ids)})"

    result = await session.execute(text(update_sql))
    await session.commit()

    return result.rowcount
