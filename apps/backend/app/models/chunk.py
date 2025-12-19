"""Text chunk models for RAG."""

from __future__ import annotations

from enum import Enum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, Index, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.asset import Asset
    from app.models.embedding import Embedding
    from app.models.page import SvsPage


class PageChunkSection(str, Enum):
    """Section type for page text chunks."""

    DESCRIPTION = "description"
    CREDITS = "credits"
    DOWNLOAD_NOTES = "download_notes"
    OTHER = "other"


class AssetChunkSection(str, Enum):
    """Section type for asset text chunks."""

    CAPTION = "caption"
    TRANSCRIPT = "transcript"
    README = "readme"
    OTHER = "other"


class PageTextChunk(Base, TimestampMixin):
    """Text chunk from an SVS page for embedding."""

    __tablename__ = "page_text_chunk"

    chunk_id: Mapped[UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    svs_id: Mapped[int] = mapped_column(ForeignKey("svs_page.svs_id", ondelete="CASCADE"))
    section: Mapped[str] = mapped_column(String(50))
    chunk_index: Mapped[int] = mapped_column()
    content: Mapped[str] = mapped_column(Text)
    token_count: Mapped[int] = mapped_column()
    content_hash: Mapped[str] = mapped_column(String(64))  # SHA-256 hash

    # Relationships
    page: Mapped[SvsPage] = relationship("SvsPage", back_populates="text_chunks")
    embeddings: Mapped[list[Embedding]] = relationship(
        "Embedding",
        primaryjoin="and_(PageTextChunk.chunk_id == foreign(Embedding.chunk_id), Embedding.chunk_type == 'page')",
        viewonly=True,
    )

    __table_args__ = (
        Index("ix_page_text_chunk_svs_id", "svs_id"),
        Index("ix_page_text_chunk_section", "section"),
        Index("ix_page_text_chunk_hash", "content_hash"),
    )


class AssetTextChunk(Base, TimestampMixin):
    """Text chunk from an asset (caption, transcript, etc.)."""

    __tablename__ = "asset_text_chunk"

    chunk_id: Mapped[UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    asset_id: Mapped[UUID] = mapped_column(ForeignKey("asset.asset_id", ondelete="CASCADE"))
    section: Mapped[str] = mapped_column(String(50))
    chunk_index: Mapped[int] = mapped_column()
    content: Mapped[str] = mapped_column(Text)
    token_count: Mapped[int] = mapped_column()
    content_hash: Mapped[str] = mapped_column(String(64))

    # Relationships
    asset: Mapped[Asset] = relationship("Asset", back_populates="text_chunks")
    embeddings: Mapped[list[Embedding]] = relationship(
        "Embedding",
        primaryjoin="and_(AssetTextChunk.chunk_id == foreign(Embedding.chunk_id), Embedding.chunk_type == 'asset')",
        viewonly=True,
    )

    __table_args__ = (
        Index("ix_asset_text_chunk_asset_id", "asset_id"),
        Index("ix_asset_text_chunk_section", "section"),
        Index("ix_asset_text_chunk_hash", "content_hash"),
    )
