"""Command-line interface for ingestion operations."""

import argparse
import asyncio
import logging
import sys
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings
from app.ingestion.api_client import SvsApiClient
from app.ingestion.pipeline import IngestionPipeline, run_full_ingestion
from app.models import Base

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


async def get_session() -> AsyncSession:
    """Create database session."""
    settings = get_settings()
    engine = create_async_engine(settings.database_url, echo=False)
    async_session_maker = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    return async_session_maker()


async def cmd_discover(args: argparse.Namespace) -> int:
    """Run discovery phase only."""
    logger.info("Starting SVS page discovery...")

    def progress(current: int, total: int) -> None:
        pct = (current / total * 100) if total > 0 else 0
        print(f"\rDiscovering pages: {current}/{total} ({pct:.1f}%)", end="", flush=True)

    async with await get_session() as session:
        pipeline = IngestionPipeline(session)
        run = await pipeline.create_run(mode="discovery")

        try:
            count = await pipeline.run_discovery(run.run_id, progress_callback=progress)
            print()  # Newline after progress
            logger.info(f"Discovery complete: {count} pages found")
            return 0
        except Exception as e:
            logger.error(f"Discovery failed: {e}")
            return 1


async def cmd_crawl(args: argparse.Namespace) -> int:
    """Run HTML crawling phase."""
    logger.info(f"Starting HTML crawl (max_pages={args.max_pages}, skip_existing={args.skip_existing})")

    def progress(processed: int, success: int, errors: int) -> None:
        print(f"\rCrawling: {processed} processed, {success} success, {errors} errors", end="", flush=True)

    async with await get_session() as session:
        pipeline = IngestionPipeline(session)
        run = await pipeline.create_run(mode="crawl")

        try:
            # Parse SVS IDs if provided
            svs_ids = None
            if args.svs_ids:
                svs_ids = [int(x.strip()) for x in args.svs_ids.split(",")]

            processed, success, errors = await pipeline.run_html_crawl(
                run.run_id,
                svs_ids=svs_ids,
                skip_existing=args.skip_existing,
                max_pages=args.max_pages,
                progress_callback=progress,
            )
            print()  # Newline after progress
            logger.info(f"Crawl complete: {processed} processed, {success} success, {errors} errors")
            return 0 if errors == 0 else 1
        except Exception as e:
            logger.error(f"Crawl failed: {e}")
            return 1


async def cmd_ingest(args: argparse.Namespace) -> int:
    """Run full ingestion pipeline."""
    logger.info(f"Starting full ingestion (max_pages={args.max_pages})")

    async with await get_session() as session:
        try:
            result = await run_full_ingestion(
                session,
                max_pages=args.max_pages,
                skip_existing=args.skip_existing,
            )
            logger.info(f"Ingestion complete: {result}")
            return 0 if result["errors"] == 0 else 1
        except Exception as e:
            logger.error(f"Ingestion failed: {e}")
            return 1


async def cmd_test_api(args: argparse.Namespace) -> int:
    """Test SVS API connection."""
    logger.info("Testing SVS API connection...")

    async with SvsApiClient() as client:
        try:
            # Test search
            result = await client.search(limit=5)
            logger.info(f"API connection successful. Found {result.count} total pages.")
            logger.info("Sample pages:")
            for page in result.results[:5]:
                logger.info(f"  - [{page.id}] {page.title}")
            return 0
        except Exception as e:
            logger.error(f"API test failed: {e}")
            return 1


async def cmd_cache_thumbnails(args: argparse.Namespace) -> int:
    """Cache thumbnails for existing pages in MinIO."""
    import httpx
    from sqlalchemy import select

    from app.models.page import SvsPage
    from app.services.storage import MinioStorageService
    from app.services.thumbnail import ThumbnailService

    logger.info(f"Starting thumbnail caching (max_pages={args.max_pages})")

    settings = get_settings()
    storage = MinioStorageService(settings)

    try:
        storage.ensure_bucket_exists()
    except Exception as e:
        logger.error(f"Failed to initialize MinIO: {e}")
        return 1

    async with await get_session() as session:
        # Query pages with thumbnail_url but no storage_uri
        query = (
            select(SvsPage)
            .where(
                SvsPage.thumbnail_url.isnot(None),
                SvsPage.thumbnail_storage_uri.is_(None),
            )
            .order_by(SvsPage.published_date.desc().nulls_last())
        )

        if args.max_pages:
            query = query.limit(args.max_pages)

        result = await session.execute(query)
        pages = result.scalars().all()

        total = len(pages)
        if total == 0:
            logger.info("No pages need thumbnail caching")
            return 0

        logger.info(f"Found {total} pages to cache thumbnails for")

        success = 0
        errors = 0
        batch_size = args.batch_size

        async with httpx.AsyncClient(
            timeout=30.0,
            follow_redirects=True,
            headers={"User-Agent": "SVS-Browser/1.0 (thumbnail cache)"},
        ) as http_client:
            thumbnail_service = ThumbnailService(storage, http_client)

            for i, page in enumerate(pages):
                try:
                    storage_uri = await thumbnail_service.cache_page_thumbnail(
                        page.svs_id,
                        page.thumbnail_url,
                    )
                    if storage_uri:
                        page.thumbnail_storage_uri = storage_uri
                        success += 1
                    else:
                        errors += 1
                except Exception as e:
                    logger.debug(f"Failed to cache thumbnail for {page.svs_id}: {e}")
                    errors += 1

                # Progress and periodic commit
                if (i + 1) % batch_size == 0:
                    await session.commit()
                    pct = ((i + 1) / total) * 100
                    print(f"\rProgress: {i + 1}/{total} ({pct:.1f}%) - {success} cached, {errors} failed", end="", flush=True)

            # Final commit
            await session.commit()
            print()  # Newline after progress

        logger.info(f"Thumbnail caching complete: {success} cached, {errors} failed")
        return 0 if errors < total else 1


async def cmd_test_parse(args: argparse.Namespace) -> int:
    """Test HTML parsing for a specific page."""
    from app.ingestion.html_parser import SvsHtmlParser

    logger.info(f"Testing HTML parsing for SVS page {args.svs_id}...")

    async with SvsApiClient() as client:
        try:
            html = await client.fetch_page_html(args.svs_id)
            parser = SvsHtmlParser()
            parsed = parser.parse(html, args.svs_id)

            logger.info(f"Title: {parsed.title}")
            logger.info(f"Published: {parsed.published_date}")
            logger.info(f"Description: {parsed.description[:200] if parsed.description else 'N/A'}...")
            logger.info(f"Credits: {len(parsed.credits)}")
            logger.info(f"Keywords: {parsed.keywords}")
            logger.info(f"Missions: {parsed.missions}")
            logger.info(f"Assets: {len(parsed.assets)}")
            logger.info(f"Related pages: {len(parsed.related_pages)}")

            return 0
        except Exception as e:
            logger.error(f"Parse test failed: {e}")
            return 1


def main() -> int:
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description="SVS Browser Ingestion CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Enable verbose logging",
    )

    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # discover command
    discover_parser = subparsers.add_parser(
        "discover",
        help="Discover SVS pages from API",
    )

    # crawl command
    crawl_parser = subparsers.add_parser(
        "crawl",
        help="Crawl HTML pages and extract content",
    )
    crawl_parser.add_argument(
        "--max-pages",
        type=int,
        default=None,
        help="Maximum pages to crawl",
    )
    crawl_parser.add_argument(
        "--svs-ids",
        type=str,
        default=None,
        help="Comma-separated SVS IDs to crawl",
    )
    crawl_parser.add_argument(
        "--no-skip-existing",
        dest="skip_existing",
        action="store_false",
        help="Re-crawl already crawled pages",
    )

    # ingest command
    ingest_parser = subparsers.add_parser(
        "ingest",
        help="Run full ingestion pipeline",
    )
    ingest_parser.add_argument(
        "--max-pages",
        type=int,
        default=None,
        help="Maximum pages to ingest",
    )
    ingest_parser.add_argument(
        "--no-skip-existing",
        dest="skip_existing",
        action="store_false",
        help="Re-ingest already processed pages",
    )

    # test-api command
    test_api_parser = subparsers.add_parser(
        "test-api",
        help="Test SVS API connection",
    )

    # test-parse command
    test_parse_parser = subparsers.add_parser(
        "test-parse",
        help="Test HTML parsing for a page",
    )
    test_parse_parser.add_argument(
        "svs_id",
        type=int,
        help="SVS page ID to parse",
    )

    # cache-thumbnails command
    cache_thumbnails_parser = subparsers.add_parser(
        "cache-thumbnails",
        help="Cache page thumbnails in MinIO",
    )
    cache_thumbnails_parser.add_argument(
        "--max-pages",
        type=int,
        default=None,
        help="Maximum pages to process",
    )
    cache_thumbnails_parser.add_argument(
        "--batch-size",
        type=int,
        default=50,
        help="Commit after this many pages",
    )

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    if not args.command:
        parser.print_help()
        return 1

    # Run the appropriate command
    commands = {
        "discover": cmd_discover,
        "crawl": cmd_crawl,
        "ingest": cmd_ingest,
        "test-api": cmd_test_api,
        "test-parse": cmd_test_parse,
        "cache-thumbnails": cmd_cache_thumbnails,
    }

    return asyncio.run(commands[args.command](args))


if __name__ == "__main__":
    sys.exit(main())
