"""Ingestion tracking models."""
from __future__ import annotations


from datetime import datetime
from enum import Enum
from uuid import UUID

from sqlalchemy import ForeignKey, Index, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class IngestRunStatus(str, Enum):
    """Status of an ingestion run."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class IngestRunMode(str, Enum):
    """Mode of ingestion run."""

    FULL = "full"
    INCREMENTAL = "incremental"
    SELECTIVE = "selective"


class IngestRun(Base, TimestampMixin):
    """Record of an ingestion run."""

    __tablename__ = "ingest_run"

    run_id: Mapped[UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    mode: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(
        String(20), default=IngestRunStatus.PENDING.value
    )
    started_at: Mapped[datetime | None] = mapped_column(nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(nullable=True)

    # Progress tracking
    total_items: Mapped[int] = mapped_column(default=0)
    processed_items: Mapped[int] = mapped_column(default=0)
    success_count: Mapped[int] = mapped_column(default=0)
    error_count: Mapped[int] = mapped_column(default=0)
    skipped_count: Mapped[int] = mapped_column(default=0)

    # Configuration used
    config_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Error summary
    error_summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    items: Mapped[list["IngestItem"]] = relationship(
        "IngestItem", back_populates="run", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_ingest_run_status", "status"),
        Index("ix_ingest_run_started_at", "started_at"),
    )


class IngestItemStatus(str, Enum):
    """Status of an individual ingest item."""

    PENDING = "pending"
    PROCESSING = "processing"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"


class IngestItemPhase(str, Enum):
    """Processing phase for an ingest item."""

    API_DISCOVERY = "api_discovery"
    HTML_CRAWL = "html_crawl"
    ASSET_EXTRACT = "asset_extract"
    CHUNKING = "chunking"
    EMBEDDING = "embedding"


class IngestItem(Base, TimestampMixin):
    """Individual item being ingested."""

    __tablename__ = "ingest_item"

    item_id: Mapped[UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    run_id: Mapped[UUID] = mapped_column(
        ForeignKey("ingest_run.run_id", ondelete="CASCADE")
    )
    svs_id: Mapped[int] = mapped_column()
    status: Mapped[str] = mapped_column(
        String(20), default=IngestItemStatus.PENDING.value
    )
    phase: Mapped[str | None] = mapped_column(String(30), nullable=True)

    # Timing
    started_at: Mapped[datetime | None] = mapped_column(nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(nullable=True)

    # Error tracking
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    retry_count: Mapped[int] = mapped_column(default=0)

    # Relationships
    run: Mapped["IngestRun"] = relationship("IngestRun", back_populates="items")

    __table_args__ = (
        Index("ix_ingest_item_run_id", "run_id"),
        Index("ix_ingest_item_svs_id", "svs_id"),
        Index("ix_ingest_item_status", "status"),
    )
