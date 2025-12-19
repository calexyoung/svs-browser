"""Asset models."""

from __future__ import annotations

from enum import Enum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import BigInteger, ForeignKey, Index, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.chunk import AssetTextChunk
    from app.models.page import SvsPage


class MediaType(str, Enum):
    """Type of media asset."""

    VIDEO = "video"
    IMAGE = "image"
    DATA = "data"
    DOCUMENT = "document"
    OTHER = "other"


class Asset(Base, TimestampMixin):
    """Media asset associated with an SVS page."""

    __tablename__ = "asset"

    asset_id: Mapped[UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    svs_id: Mapped[int] = mapped_column(ForeignKey("svs_page.svs_id", ondelete="CASCADE"))
    title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Rich caption with HTML formatting preserved
    caption_html: Mapped[str | None] = mapped_column(Text, nullable=True)
    caption_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    media_type: Mapped[str] = mapped_column(String(20))
    position: Mapped[int] = mapped_column(default=0)

    # Dimensions (for images/video)
    width: Mapped[int | None] = mapped_column(nullable=True)
    height: Mapped[int | None] = mapped_column(nullable=True)

    # Duration (for video/audio)
    duration_seconds: Mapped[float | None] = mapped_column(nullable=True)

    # Extra metadata
    metadata_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Relationships
    page: Mapped[SvsPage] = relationship("SvsPage", back_populates="assets")
    files: Mapped[list[AssetFile]] = relationship("AssetFile", back_populates="asset", cascade="all, delete-orphan")
    thumbnails: Mapped[list[AssetThumbnail]] = relationship(
        "AssetThumbnail", back_populates="asset", cascade="all, delete-orphan"
    )
    text_chunks: Mapped[list[AssetTextChunk]] = relationship(
        "AssetTextChunk", back_populates="asset", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_asset_svs_id", "svs_id"),
        Index("ix_asset_media_type", "media_type"),
    )


class FileVariant(str, Enum):
    """Variant type for asset files."""

    ORIGINAL = "original"
    HIRES = "hires"
    LORES = "lores"
    PREVIEW = "preview"
    CAPTION = "caption"
    TRANSCRIPT = "transcript"
    README = "readme"


class AssetFile(Base, TimestampMixin):
    """File variant for an asset."""

    __tablename__ = "asset_file"

    file_id: Mapped[UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    asset_id: Mapped[UUID] = mapped_column(ForeignKey("asset.asset_id", ondelete="CASCADE"))
    variant: Mapped[str] = mapped_column(String(50))
    file_url: Mapped[str] = mapped_column(String(1000))
    storage_uri: Mapped[str | None] = mapped_column(String(1000), nullable=True)  # For future local storage
    mime_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    filename: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Relationships
    asset: Mapped[Asset] = relationship("Asset", back_populates="files")

    __table_args__ = (
        Index("ix_asset_file_asset_id", "asset_id"),
        Index("ix_asset_file_variant", "variant"),
    )


class AssetThumbnail(Base, TimestampMixin):
    """Thumbnail image for an asset."""

    __tablename__ = "asset_thumbnail"

    thumbnail_id: Mapped[UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    asset_id: Mapped[UUID] = mapped_column(ForeignKey("asset.asset_id", ondelete="CASCADE"))
    url: Mapped[str] = mapped_column(String(1000))
    storage_uri: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    width: Mapped[int] = mapped_column()
    height: Mapped[int] = mapped_column()

    # Relationships
    asset: Mapped[Asset] = relationship("Asset", back_populates="thumbnails")

    __table_args__ = (Index("ix_asset_thumbnail_asset_id", "asset_id"),)
