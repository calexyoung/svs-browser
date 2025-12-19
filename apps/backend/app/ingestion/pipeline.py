"""Ingestion pipeline orchestrator."""

from __future__ import annotations

import logging
from collections.abc import Callable
from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ingestion.api_client import SvsApiClient, SvsSearchResult
from app.ingestion.chunker import TextChunker, chunk_page_content
from app.ingestion.html_parser import ParsedSvsPage, SvsHtmlParser
from app.models import (
    Asset,
    AssetFile,
    AssetThumbnail,
    IngestRun,
    PageTag,
    PageTextChunk,
    SvsPage,
    SvsPageRelation,
    Tag,
)

logger = logging.getLogger(__name__)


class IngestionPipeline:
    """
    Orchestrates the ingestion of SVS content.

    Phases:
    1. API Discovery - Fetch page list from SVS API
    2. HTML Crawl - Download and parse HTML pages
    3. Asset Extract - Extract and catalog assets
    4. Chunking - Create text chunks for embeddings
    5. Embedding - Generate vector embeddings (separate process)
    """

    def __init__(
        self,
        session: AsyncSession,
        api_client: SvsApiClient | None = None,
        html_parser: SvsHtmlParser | None = None,
        text_chunker: TextChunker | None = None,
    ):
        self.session = session
        self.api_client = api_client or SvsApiClient()
        self.html_parser = html_parser or SvsHtmlParser()
        self.text_chunker = text_chunker or TextChunker()

    async def run_discovery(
        self,
        run_id: UUID,
        progress_callback: Callable[[int, int], None] | None = None,
    ) -> int:
        """
        Phase 1: Discover all SVS pages from the API.

        Returns:
            Number of pages discovered
        """
        logger.info(f"Starting discovery phase for run {run_id}")

        async with self.api_client:
            results = await self.api_client.discover_all_pages(
                batch_size=500,
                progress_callback=progress_callback,
            )

        # Store discovered pages
        count = 0
        for result in results:
            await self._upsert_page_from_api(result)
            count += 1

        await self.session.commit()
        logger.info(f"Discovery complete: {count} pages found")
        return count

    async def run_html_crawl(
        self,
        run_id: UUID,
        svs_ids: list[int] | None = None,
        skip_existing: bool = True,
        max_pages: int | None = None,
        progress_callback: Callable[[int, int, int], None] | None = None,
    ) -> tuple[int, int, int]:
        """
        Phase 2: Crawl HTML pages and extract content.

        Args:
            run_id: Ingestion run ID
            svs_ids: Specific page IDs to crawl (None = all)
            skip_existing: Skip pages already crawled
            max_pages: Maximum pages to process
            progress_callback: Callback(processed, success, errors)

        Returns:
            Tuple of (processed, success, errors)
        """
        logger.info(f"Starting HTML crawl phase for run {run_id}")

        # Get pages to crawl
        query = select(SvsPage)
        if svs_ids:
            query = query.where(SvsPage.svs_id.in_(svs_ids))
        if skip_existing:
            query = query.where(SvsPage.html_crawled_at.is_(None))

        query = query.order_by(SvsPage.svs_id)
        if max_pages:
            query = query.limit(max_pages)

        result = await self.session.execute(query)
        pages = result.scalars().all()

        processed = 0
        success = 0
        errors = 0

        async with self.api_client:
            for page in pages:
                try:
                    await self._crawl_page(page)
                    success += 1
                except Exception as e:
                    logger.error(f"Error crawling page {page.svs_id}: {e}")
                    errors += 1

                processed += 1
                if progress_callback:
                    progress_callback(processed, success, errors)

                # Commit periodically
                if processed % 10 == 0:
                    await self.session.commit()

        await self.session.commit()
        logger.info(f"HTML crawl complete: {success} success, {errors} errors")
        return processed, success, errors

    async def create_run(
        self,
        mode: str = "incremental",
        config: dict | None = None,
    ) -> IngestRun:
        """Create a new ingestion run record."""
        run = IngestRun(
            mode=mode,
            status="pending",
            config_json=config or {},
        )
        self.session.add(run)
        await self.session.commit()
        await self.session.refresh(run)
        return run

    async def update_run_status(
        self,
        run_id: UUID,
        status: str,
        **kwargs,
    ) -> None:
        """Update run status and metrics."""
        result = await self.session.execute(select(IngestRun).where(IngestRun.run_id == run_id))
        run = result.scalar_one_or_none()
        if run:
            run.status = status
            for key, value in kwargs.items():
                if hasattr(run, key):
                    setattr(run, key, value)
            await self.session.commit()

    async def _upsert_page_from_api(self, result: SvsSearchResult) -> SvsPage:
        """Create or update page from API result."""
        existing = await self.session.execute(select(SvsPage).where(SvsPage.svs_id == result.id))
        page = existing.scalar_one_or_none()

        if page:
            # Update existing
            page.title = result.title
            page.canonical_url = result.url
            if result.release_date:
                page.published_date = self._parse_date(result.release_date)
            page.api_source = True
        else:
            # Create new
            page = SvsPage(
                svs_id=result.id,
                title=result.title,
                canonical_url=result.url,
                published_date=self._parse_date(result.release_date) if result.release_date else None,
                summary=result.description,
                api_source=True,
            )
            self.session.add(page)

        return page

    async def _crawl_page(self, page: SvsPage) -> None:
        """Crawl and parse a single page."""
        logger.debug(f"Crawling page {page.svs_id}")

        # Fetch HTML
        html = await self.api_client.fetch_page_html(page.svs_id)

        # Parse content
        parsed = self.html_parser.parse(html, page.svs_id)

        # Update page fields
        page.title = parsed.title
        page.description = parsed.description
        page.summary = parsed.summary
        page.content_json = parsed.content_json  # Rich HTML content
        page.published_date = parsed.published_date
        page.thumbnail_url = parsed.thumbnail_url
        page.credits_json = [{"role": c.role, "name": c.name, "organization": c.organization} for c in parsed.credits]
        page.html_crawled_at = datetime.utcnow()
        page.last_checked_at = datetime.utcnow()

        # Process tags
        await self._process_tags(page, parsed)

        # Process assets
        await self._process_assets(page, parsed)

        # Process related pages
        await self._process_related_pages(page, parsed)

        # Create text chunks
        await self._create_text_chunks(page, parsed)

    async def _process_tags(self, page: SvsPage, parsed: ParsedSvsPage) -> None:
        """Process and link tags for a page."""
        # Collect all tags by type
        tag_data = [
            ("keyword", parsed.keywords),
            ("mission", parsed.missions),
            ("target", parsed.targets),
            ("domain", parsed.domains),
        ]

        for tag_type, values in tag_data:
            for value in values:
                tag = await self._get_or_create_tag(tag_type, value)
                await self._link_page_tag(page.svs_id, tag.tag_id)

    async def _get_or_create_tag(self, tag_type: str, value: str) -> Tag:
        """Get existing tag or create new one."""
        normalized = value.lower().strip()

        result = await self.session.execute(
            select(Tag).where(
                Tag.tag_type == tag_type,
                Tag.normalized_value == normalized,
            )
        )
        tag = result.scalar_one_or_none()

        if not tag:
            tag = Tag(
                tag_type=tag_type,
                value=value,
                normalized_value=normalized,
                display_name=value,
            )
            self.session.add(tag)
            await self.session.flush()

        return tag

    async def _link_page_tag(self, svs_id: int, tag_id: UUID) -> None:
        """Link a tag to a page (if not already linked)."""
        result = await self.session.execute(
            select(PageTag).where(
                PageTag.svs_id == svs_id,
                PageTag.tag_id == tag_id,
            )
        )
        if not result.scalar_one_or_none():
            page_tag = PageTag(svs_id=svs_id, tag_id=tag_id)
            self.session.add(page_tag)

    async def _process_assets(self, page: SvsPage, parsed: ParsedSvsPage) -> None:
        """Process and store assets for a page."""
        for position, parsed_asset in enumerate(parsed.assets):
            asset = Asset(
                svs_id=page.svs_id,
                title=parsed_asset.title,
                description=parsed_asset.description,
                caption_html=parsed_asset.caption_html,
                caption_text=parsed_asset.caption_text,
                media_type=parsed_asset.media_type,
                position=position,
                width=parsed_asset.width,
                height=parsed_asset.height,
                duration_seconds=parsed_asset.duration_seconds,
            )
            self.session.add(asset)
            await self.session.flush()

            # Add files
            for parsed_file in parsed_asset.files:
                file = AssetFile(
                    asset_id=asset.asset_id,
                    variant=parsed_file.variant,
                    file_url=parsed_file.url,
                    mime_type=parsed_file.mime_type,
                    size_bytes=parsed_file.size_bytes,
                    filename=parsed_file.filename,
                )
                self.session.add(file)

            # Add thumbnail
            if parsed_asset.thumbnail_url:
                thumbnail = AssetThumbnail(
                    asset_id=asset.asset_id,
                    url=parsed_asset.thumbnail_url,
                    width=320,  # Default thumbnail size
                    height=180,
                )
                self.session.add(thumbnail)

    async def _process_related_pages(
        self,
        page: SvsPage,
        parsed: ParsedSvsPage,
    ) -> None:
        """Process related page links."""
        for related in parsed.related_pages:
            # Check if target page exists
            result = await self.session.execute(select(SvsPage).where(SvsPage.svs_id == related.svs_id))
            target = result.scalar_one_or_none()

            if not target:
                # Create stub for target page
                target = SvsPage(
                    svs_id=related.svs_id,
                    title=related.title,
                    canonical_url=f"https://svs.gsfc.nasa.gov/{related.svs_id}",
                )
                self.session.add(target)
                await self.session.flush()

            # Create relation if not exists
            result = await self.session.execute(
                select(SvsPageRelation).where(
                    SvsPageRelation.source_svs_id == page.svs_id,
                    SvsPageRelation.target_svs_id == related.svs_id,
                )
            )
            if not result.scalar_one_or_none():
                relation = SvsPageRelation(
                    source_svs_id=page.svs_id,
                    target_svs_id=related.svs_id,
                    relation_type=related.relation_type,
                )
                self.session.add(relation)

    async def _create_text_chunks(
        self,
        page: SvsPage,
        parsed: ParsedSvsPage,
    ) -> None:
        """Create text chunks for the page."""
        # Build credits text
        credits_text = ""
        for credit in parsed.credits:
            line = f"{credit.role}: {credit.name}"
            if credit.organization:
                line += f" ({credit.organization})"
            credits_text += line + "\n"

        # Chunk the content
        chunks = chunk_page_content(
            description=parsed.description,
            credits_text=credits_text.strip() or None,
            download_notes=parsed.download_notes,
        )

        # Store chunks
        for chunk in chunks:
            page_chunk = PageTextChunk(
                svs_id=page.svs_id,
                section=chunk.section,
                chunk_index=chunk.chunk_index,
                content=chunk.content,
                token_count=chunk.token_count,
                content_hash=chunk.content_hash,
            )
            self.session.add(page_chunk)

    def _parse_date(self, date_str: str) -> datetime | None:
        """Parse date string to date object."""
        if not date_str:
            return None

        formats = [
            "%Y-%m-%d",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%SZ",
        ]

        for fmt in formats:
            try:
                return datetime.strptime(date_str[:19], fmt).date()
            except ValueError:
                continue

        return None

    async def run_content_update(
        self,
        batch_size: int = 100,
        priority_first: bool = True,
        progress_callback: Callable[[int, int, int], None] | None = None,
    ) -> tuple[int, int, int]:
        """
        Re-crawl pages to extract rich content for pages missing content_json.

        This updates existing pages with:
        - content_json: Structured HTML content with paragraph preservation
        - credits_json: Re-extracted credits (fixes empty extraction)

        Args:
            batch_size: Number of pages to process per batch
            priority_first: If True, start with recently published pages
            progress_callback: Callback(processed, success, errors)

        Returns:
            Tuple of (processed, success, errors)
        """
        logger.info("Starting content update crawl for pages missing content_json")

        # Query pages that need content update
        query = select(SvsPage).where(
            SvsPage.html_crawled_at.isnot(None),  # Only already crawled pages
            SvsPage.content_json.is_(None),  # Missing rich content
        )

        if priority_first:
            query = query.order_by(SvsPage.published_date.desc().nulls_last())
        else:
            query = query.order_by(SvsPage.svs_id)

        result = await self.session.execute(query)
        pages = result.scalars().all()

        total = len(pages)
        processed = 0
        success = 0
        errors = 0

        logger.info(f"Found {total} pages needing content update")

        async with self.api_client:
            for i in range(0, total, batch_size):
                batch = pages[i : i + batch_size]

                for page in batch:
                    try:
                        await self._update_page_content(page)
                        success += 1
                    except Exception as e:
                        logger.error(f"Error updating content for page {page.svs_id}: {e}")
                        errors += 1

                    processed += 1
                    if progress_callback:
                        progress_callback(processed, success, errors)

                # Commit after each batch
                await self.session.commit()
                logger.info(f"Batch complete: {processed}/{total} processed, {success} success, {errors} errors")

        logger.info(f"Content update complete: {success} success, {errors} errors out of {processed} processed")
        return processed, success, errors

    async def _update_page_content(self, page: SvsPage) -> None:
        """Re-fetch and parse a page to update rich content fields."""
        logger.debug(f"Updating content for page {page.svs_id}")

        # Fetch HTML
        html = await self.api_client.fetch_page_html(page.svs_id)

        # Parse content
        parsed = self.html_parser.parse(html, page.svs_id)

        # Update content_json
        page.content_json = parsed.content_json

        # Update credits if currently empty or missing
        if not page.credits_json and parsed.credits:
            page.credits_json = [
                {"role": c.role, "name": c.name, "organization": c.organization} for c in parsed.credits
            ]

        page.last_checked_at = datetime.utcnow()


async def run_full_ingestion(
    session: AsyncSession,
    max_pages: int | None = None,
    skip_existing: bool = True,
) -> dict:
    """
    Run a full ingestion pipeline.

    Returns:
        Dict with run statistics
    """
    pipeline = IngestionPipeline(session)

    # Create run record
    run = await pipeline.create_run(
        mode="full" if not skip_existing else "incremental",
        config={"max_pages": max_pages, "skip_existing": skip_existing},
    )

    try:
        # Update status to running
        await pipeline.update_run_status(
            run.run_id,
            "running",
            started_at=datetime.utcnow(),
        )

        # Phase 1: Discovery
        total_pages = await pipeline.run_discovery(run.run_id)

        # Phase 2: HTML Crawl
        processed, success, errors = await pipeline.run_html_crawl(
            run.run_id,
            skip_existing=skip_existing,
            max_pages=max_pages,
        )

        # Update status to completed
        await pipeline.update_run_status(
            run.run_id,
            "completed",
            completed_at=datetime.utcnow(),
            total_items=total_pages,
            processed_items=processed,
            success_count=success,
            error_count=errors,
        )

        return {
            "run_id": str(run.run_id),
            "status": "completed",
            "total_pages": total_pages,
            "processed": processed,
            "success": success,
            "errors": errors,
        }

    except Exception as e:
        logger.exception(f"Ingestion failed: {e}")
        await pipeline.update_run_status(
            run.run_id,
            "failed",
            completed_at=datetime.utcnow(),
            error_summary=str(e),
        )
        raise
