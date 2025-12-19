"""Tag models."""
from __future__ import annotations


from enum import Enum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, Index, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.page import SvsPage


class TagType(str, Enum):
    """Type of tag."""

    KEYWORD = "keyword"
    MISSION = "mission"
    INSTRUMENT = "instrument"
    TARGET = "target"
    DOMAIN = "domain"
    CONCEPT = "concept"
    EVENT = "event"
    PERSON = "person"
    ORGANIZATION = "organization"


class Tag(Base, TimestampMixin):
    """Tag/keyword that can be associated with pages."""

    __tablename__ = "tag"

    tag_id: Mapped[UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    tag_type: Mapped[str] = mapped_column(String(50))
    value: Mapped[str] = mapped_column(String(200))
    normalized_value: Mapped[str] = mapped_column(String(200))
    display_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    # Relationships
    page_tags: Mapped[list["PageTag"]] = relationship(
        "PageTag", back_populates="tag", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("tag_type", "normalized_value", name="uq_tag_type_value"),
        Index("ix_tag_type", "tag_type"),
        Index("ix_tag_normalized_value", "normalized_value"),
    )


class PageTag(Base, TimestampMixin):
    """Association between a page and a tag."""

    __tablename__ = "page_tag"

    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    svs_id: Mapped[int] = mapped_column(
        ForeignKey("svs_page.svs_id", ondelete="CASCADE")
    )
    tag_id: Mapped[UUID] = mapped_column(ForeignKey("tag.tag_id", ondelete="CASCADE"))

    # Relationships
    page: Mapped["SvsPage"] = relationship("SvsPage", back_populates="tags")
    tag: Mapped["Tag"] = relationship("Tag", back_populates="page_tags")

    __table_args__ = (
        UniqueConstraint("svs_id", "tag_id", name="uq_page_tag"),
        Index("ix_page_tag_svs_id", "svs_id"),
        Index("ix_page_tag_tag_id", "tag_id"),
    )
