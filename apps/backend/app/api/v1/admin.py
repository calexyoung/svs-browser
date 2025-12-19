"""Admin API endpoints."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.ingestion.pipeline import IngestionPipeline
from app.models import IngestRun

router = APIRouter()
settings = get_settings()


async def verify_api_key(x_api_key: str = Header(..., description="Admin API key")) -> str:
    """Verify admin API key."""
    if not settings.admin_api_key:
        raise HTTPException(status_code=503, detail="Admin API not configured")
    if x_api_key != settings.admin_api_key:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return x_api_key


class IngestRequest(BaseModel):
    """Ingestion request model."""

    mode: str = Field("incremental", description="Ingestion mode: full or incremental")
    svs_ids: list[int] | None = Field(None, description="Specific SVS IDs to ingest")
    skip_existing: bool = Field(True, description="Skip already ingested pages")
    max_pages: int | None = Field(None, description="Maximum pages to process")


class ContentUpdateRequest(BaseModel):
    """Content update/reformatting request model."""

    batch_size: int = Field(100, description="Number of pages per batch commit")
    priority_first: bool = Field(True, description="Process newest pages first")


class IngestResponse(BaseModel):
    """Ingestion response model."""

    run_id: str
    status: str
    message: str


class IngestStatusResponse(BaseModel):
    """Ingestion status response model."""

    run_id: str
    status: str
    mode: str | None
    total_items: int
    processed_items: int
    success_count: int
    error_count: int
    skipped_count: int
    started_at: str | None
    completed_at: str | None
    error_summary: str | None


async def run_ingestion_task(
    run_id: UUID,
    mode: str,
    svs_ids: list[int] | None,
    skip_existing: bool,
    max_pages: int | None,
) -> None:
    """Background task to run ingestion."""
    from app.database import async_session_maker

    async with async_session_maker() as session:
        pipeline = IngestionPipeline(session)
        try:
            if mode == "discovery":
                await pipeline.run_discovery(run_id)
            else:
                await pipeline.run_html_crawl(
                    run_id,
                    svs_ids=svs_ids,
                    skip_existing=skip_existing,
                    max_pages=max_pages,
                )
        except Exception as e:
            await pipeline.update_run_status(
                run_id,
                "failed",
                error_summary=str(e),
            )


@router.post("/ingest/run", response_model=IngestResponse)
async def start_ingestion(
    request: IngestRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    _api_key: str = Depends(verify_api_key),
) -> IngestResponse:
    """
    Start an ingestion run.

    Runs asynchronously in the background. Use /ingest/status/{run_id}
    to check progress.

    Requires admin API key authentication.
    """
    pipeline = IngestionPipeline(db)

    # Create run record
    run = await pipeline.create_run(
        mode=request.mode,
        config={
            "svs_ids": request.svs_ids,
            "skip_existing": request.skip_existing,
            "max_pages": request.max_pages,
        },
    )

    # Start background task
    background_tasks.add_task(
        run_ingestion_task,
        run.run_id,
        request.mode,
        request.svs_ids,
        request.skip_existing,
        request.max_pages,
    )

    return IngestResponse(
        run_id=str(run.run_id),
        status="pending",
        message="Ingestion started. Use /ingest/status/{run_id} to check progress.",
    )


@router.get("/ingest/status/{run_id}", response_model=IngestStatusResponse)
async def get_ingestion_status(
    run_id: str,
    db: AsyncSession = Depends(get_db),
    _api_key: str = Depends(verify_api_key),
) -> IngestStatusResponse:
    """
    Get status of an ingestion run.

    Requires admin API key authentication.
    """
    try:
        run_uuid = UUID(run_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid run_id format")

    result = await db.execute(select(IngestRun).where(IngestRun.run_id == run_uuid))
    run = result.scalar_one_or_none()

    if not run:
        raise HTTPException(status_code=404, detail="Ingestion run not found")

    return IngestStatusResponse(
        run_id=str(run.run_id),
        status=run.status,
        mode=run.mode,
        total_items=run.total_items,
        processed_items=run.processed_items,
        success_count=run.success_count,
        error_count=run.error_count,
        skipped_count=run.skipped_count,
        started_at=run.started_at.isoformat() if run.started_at else None,
        completed_at=run.completed_at.isoformat() if run.completed_at else None,
        error_summary=run.error_summary,
    )


@router.get("/ingest/runs")
async def list_ingestion_runs(
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    _api_key: str = Depends(verify_api_key),
) -> list[IngestStatusResponse]:
    """
    List recent ingestion runs.

    Requires admin API key authentication.
    """
    result = await db.execute(select(IngestRun).order_by(IngestRun.created_at.desc()).limit(limit))
    runs = result.scalars().all()

    return [
        IngestStatusResponse(
            run_id=str(run.run_id),
            status=run.status,
            mode=run.mode,
            total_items=run.total_items,
            processed_items=run.processed_items,
            success_count=run.success_count,
            error_count=run.error_count,
            skipped_count=run.skipped_count,
            started_at=run.started_at.isoformat() if run.started_at else None,
            completed_at=run.completed_at.isoformat() if run.completed_at else None,
            error_summary=run.error_summary,
        )
        for run in runs
    ]


class ContentUpdateResponse(BaseModel):
    """Content update response model."""

    status: str
    message: str
    processed: int = 0
    success: int = 0
    errors: int = 0


# Track content update status (simple in-memory for now)
_content_update_status: dict[str, ContentUpdateResponse] = {}


async def run_content_update_task(
    task_id: str,
    batch_size: int,
    priority_first: bool,
) -> None:
    """Background task to run content update."""
    from app.database import async_session_maker

    _content_update_status[task_id] = ContentUpdateResponse(
        status="running",
        message="Content update in progress...",
    )

    async with async_session_maker() as session:
        pipeline = IngestionPipeline(session)
        try:
            processed, success, errors = await pipeline.run_content_update(
                batch_size=batch_size,
                priority_first=priority_first,
            )
            _content_update_status[task_id] = ContentUpdateResponse(
                status="completed",
                message=f"Content update complete: {processed} processed, {success} success, {errors} errors",
                processed=processed,
                success=success,
                errors=errors,
            )
        except Exception as e:
            _content_update_status[task_id] = ContentUpdateResponse(
                status="failed",
                message=f"Content update failed: {e!s}",
            )


@router.post("/ingest/content-update", response_model=ContentUpdateResponse)
async def start_content_update(
    request: ContentUpdateRequest,
    background_tasks: BackgroundTasks,
    _api_key: str = Depends(verify_api_key),
) -> ContentUpdateResponse:
    """
    Start a content update/reformatting task.

    This re-processes pages that are missing content_json (rich HTML content).
    Useful for backfilling pages that were crawled before the rich content
    extraction was implemented.

    Runs asynchronously in the background.

    Requires admin API key authentication.
    """
    import uuid

    task_id = str(uuid.uuid4())

    # Start background task
    background_tasks.add_task(
        run_content_update_task,
        task_id,
        request.batch_size,
        request.priority_first,
    )

    return ContentUpdateResponse(
        status="started",
        message=f"Content update started. Task ID: {task_id}",
    )
