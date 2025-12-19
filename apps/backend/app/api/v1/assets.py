"""Assets API endpoints."""
from __future__ import annotations


from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Asset
from app.schemas.asset import (
    AssetDetailResponse,
    AssetFileDetail,
    DimensionsResponse,
    ThumbnailResponse,
)

router = APIRouter()


@router.get("/assets/{asset_id}", response_model=AssetDetailResponse)
async def get_asset(
    asset_id: UUID = Path(..., description="Asset UUID"),
    db: AsyncSession = Depends(get_db),
) -> AssetDetailResponse:
    """
    Get detailed information about an asset.

    Returns:
    - Asset metadata (title, description, dimensions, duration)
    - All file variants with download URLs
    - Available thumbnails
    """
    query = (
        select(Asset)
        .options(
            selectinload(Asset.files),
            selectinload(Asset.thumbnails),
        )
        .where(Asset.asset_id == asset_id)
    )
    result = await db.execute(query)
    asset = result.scalar_one_or_none()

    if not asset:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "ASSET_NOT_FOUND",
                "message": f"Asset {asset_id} not found",
            },
        )

    # Format files
    files = [
        AssetFileDetail(
            file_id=f.file_id,
            variant=f.variant,
            url=f.file_url,
            storage_uri=f.storage_uri,
            mime_type=f.mime_type,
            size_bytes=f.size_bytes,
            filename=f.filename,
        )
        for f in asset.files
    ]

    # Format thumbnails
    thumbnails = [
        ThumbnailResponse(
            url=t.url,
            width=t.width,
            height=t.height,
        )
        for t in asset.thumbnails
    ]

    # Dimensions
    dimensions = None
    if asset.width or asset.height:
        dimensions = DimensionsResponse(
            width=asset.width,
            height=asset.height,
        )

    return AssetDetailResponse(
        asset_id=asset.asset_id,
        svs_id=asset.svs_id,
        title=asset.title,
        description=asset.description,
        type=asset.media_type,
        dimensions=dimensions,
        duration_seconds=asset.duration_seconds,
        files=files,
        thumbnails=thumbnails,
    )
