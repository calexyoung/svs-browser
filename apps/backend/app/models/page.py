"""SVS Page models."""
from __future__ import annotations


from datetime import date, datetime
from enum import Enum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, Index, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.asset import Asset
    from app.models.chunk import PageTextChunk
    from app.models.tag import PageTag


class PageStatus(str, Enum):
    """Status of an SVS page."""

    ACTIVE = "active"
    MISSING = "missing"
    ARCHIVED = "archived"


class SvsPage(Base, TimestampMixin):
    """SVS visualization page."""

    __tablename__ = "svs_page"

    svs_id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(500))
    canonical_url: Mapped[str] = mapped_column(String(500))
    published_date: Mapped[date | None] = mapped_column(nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    thumbnail_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    thumbnail_storage_uri: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    credits_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # Rich content with HTML formatting preserved
    # Structure: {"format_version": 1, "sections": [{"type": "description", "paragraphs": [{"html": "...", "text": "..."}]}]}
    content_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[PageStatus] = mapped_column(
        String(20), default=PageStatus.ACTIVE.value
    )
    api_source: Mapped[bool] = mapped_column(default=False)
    html_crawled_at: Mapped[datetime | None] = mapped_column(nullable=True)
    last_checked_at: Mapped[datetime | None] = mapped_column(nullable=True)

    # Full-text search vector
    search_vector: Mapped[str | None] = mapped_column(TSVECTOR, nullable=True)

    # Relationships
    assets: Mapped[list["Asset"]] = relationship(
        "Asset", back_populates="page", cascade="all, delete-orphan"
    )
    tags: Mapped[list["PageTag"]] = relationship(
        "PageTag", back_populates="page", cascade="all, delete-orphan"
    )
    text_chunks: Mapped[list["PageTextChunk"]] = relationship(
        "PageTextChunk", back_populates="page", cascade="all, delete-orphan"
    )

    # Relationships to other pages (as source)
    related_pages_from: Mapped[list["SvsPageRelation"]] = relationship(
        "SvsPageRelation",
        foreign_keys="SvsPageRelation.source_svs_id",
        back_populates="source_page",
        cascade="all, delete-orphan",
    )
    # Relationships to other pages (as target)
    related_pages_to: Mapped[list["SvsPageRelation"]] = relationship(
        "SvsPageRelation",
        foreign_keys="SvsPageRelation.target_svs_id",
        back_populates="target_page",
    )

    __table_args__ = (
        Index("ix_svs_page_search_vector", "search_vector", postgresql_using="gin"),
        Index("ix_svs_page_published_date", "published_date"),
        Index("ix_svs_page_status", "status"),
    )


class RelationType(str, Enum):
    """Type of relationship between SVS pages."""

    RELATED = "related"
    SEQUEL = "sequel"
    PREQUEL = "prequel"
    DERIVED = "derived"
    REFERENCES = "references"


class SvsPageRelation(Base, TimestampMixin):
    """Relationship between two SVS pages."""

    __tablename__ = "svs_page_relation"

    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    source_svs_id: Mapped[int] = mapped_column(
        ForeignKey("svs_page.svs_id", ondelete="CASCADE")
    )
    target_svs_id: Mapped[int] = mapped_column(
        ForeignKey("svs_page.svs_id", ondelete="CASCADE")
    )
    relation_type: Mapped[str] = mapped_column(
        String(50), default=RelationType.RELATED.value
    )

    # Relationships
    source_page: Mapped["SvsPage"] = relationship(
        "SvsPage", foreign_keys=[source_svs_id], back_populates="related_pages_from"
    )
    target_page: Mapped["SvsPage"] = relationship(
        "SvsPage", foreign_keys=[target_svs_id], back_populates="related_pages_to"
    )

    __table_args__ = (
        Index("ix_svs_page_relation_source", "source_svs_id"),
        Index("ix_svs_page_relation_target", "target_svs_id"),
    )
