"""Schemas for asset endpoints."""
from __future__ import annotations


from uuid import UUID

from pydantic import BaseModel, Field


class AssetFileDetail(BaseModel):
    """Detailed asset file information."""

    file_id: UUID = Field(..., description="File UUID")
    variant: str = Field(..., description="File variant")
    url: str = Field(..., description="Download URL")
    storage_uri: str | None = Field(None, description="Local storage URI")
    mime_type: str | None = Field(None, description="MIME type")
    size_bytes: int | None = Field(None, description="File size")
    filename: str | None = Field(None, description="Original filename")


class ThumbnailResponse(BaseModel):
    """Thumbnail information."""

    url: str = Field(..., description="Thumbnail URL")
    width: int = Field(..., description="Width in pixels")
    height: int = Field(..., description="Height in pixels")


class DimensionsResponse(BaseModel):
    """Media dimensions."""

    width: int | None = Field(None, description="Width in pixels")
    height: int | None = Field(None, description="Height in pixels")


class AssetDetailResponse(BaseModel):
    """Full asset details."""

    asset_id: UUID = Field(..., description="Asset UUID")
    svs_id: int = Field(..., description="Parent SVS page ID")
    title: str | None = Field(None, description="Asset title")
    description: str | None = Field(None, description="Asset description")
    type: str = Field(..., description="Media type")
    dimensions: DimensionsResponse | None = Field(None, description="Media dimensions")
    duration_seconds: float | None = Field(None, description="Duration for video/audio")
    files: list[AssetFileDetail] = Field(default_factory=list, description="Available files")
    thumbnails: list[ThumbnailResponse] = Field(default_factory=list, description="Thumbnails")
