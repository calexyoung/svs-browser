"""Schemas for SVS page endpoints."""

from __future__ import annotations

from datetime import date
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, Field


class MediaType(str, Enum):
    """Media type filter options."""

    VIDEO = "video"
    IMAGE = "image"
    DATA = "data"


class SortOption(str, Enum):
    """Sort options for search results."""

    RELEVANCE = "relevance"
    DATE_DESC = "date_desc"
    DATE_ASC = "date_asc"


class SearchParams(BaseModel):
    """Search query parameters."""

    q: str = Field(..., min_length=1, max_length=500, description="Search query")
    media_type: list[MediaType] | None = Field(None, description="Filter by media types")
    domain: str | None = Field(None, max_length=100, description="Filter by domain")
    mission: str | None = Field(None, max_length=100, description="Filter by mission")
    date_from: date | None = Field(None, description="Published after date")
    date_to: date | None = Field(None, description="Published before date")
    sort: SortOption = Field(SortOption.RELEVANCE, description="Sort order")
    limit: int = Field(20, ge=1, le=100, description="Results per page")
    offset: int = Field(0, ge=0, description="Pagination offset")


class SearchResult(BaseModel):
    """Individual search result."""

    svs_id: int = Field(..., description="SVS page ID")
    title: str = Field(..., description="Page title")
    snippet: str = Field(..., description="Text snippet with highlights")
    published_date: date | None = Field(None, description="Publication date")
    canonical_url: str = Field(..., description="Original SVS URL")
    thumbnail_url: str | None = Field(None, description="Thumbnail image URL")
    media_types: list[str] = Field(default_factory=list, description="Available media types")
    tags: list[str] = Field(default_factory=list, description="Associated tags")
    score: float = Field(..., ge=0, le=1, description="Relevance score")


class SearchFacets(BaseModel):
    """Aggregated facet counts for filtering."""

    media_type: dict[str, int] = Field(default_factory=dict)
    domain: dict[str, int] = Field(default_factory=dict)
    mission: dict[str, int] = Field(default_factory=dict)


class SearchResponse(BaseModel):
    """Search results response."""

    count: int = Field(..., description="Total matching results")
    results: list[SearchResult] = Field(..., description="Page of results")
    facets: SearchFacets = Field(..., description="Facet counts for filtering")
    next: str | None = Field(None, description="URL for next page")
    previous: str | None = Field(None, description="URL for previous page")


class ContentParagraph(BaseModel):
    """A paragraph with both HTML and plain text."""

    html: str = Field(..., description="Sanitized HTML content")
    text: str = Field(..., description="Plain text for accessibility")


class ContentSection(BaseModel):
    """A content section (description, caption, etc.)."""

    type: str = Field(..., description="Section type: description, story, caption")
    paragraphs: list[ContentParagraph] = Field(default_factory=list)


class RichContent(BaseModel):
    """Structured rich content with HTML formatting preserved."""

    format_version: int = Field(1, description="Content format version")
    sections: list[ContentSection] = Field(default_factory=list)


class CreditInfo(BaseModel):
    """Credit/attribution information."""

    role: str = Field(..., description="Role (e.g., Lead Animator)")
    name: str = Field(..., description="Person's name")
    organization: str | None = Field(None, description="Organization")


class TagInfo(BaseModel):
    """Tag information."""

    type: str = Field(..., description="Tag type (keyword, mission, etc.)")
    value: str = Field(..., description="Tag value")


class AssetFileResponse(BaseModel):
    """Asset file variant information."""

    variant: str = Field(..., description="File variant (original, hires, lores)")
    url: str = Field(..., description="Download URL")
    mime_type: str | None = Field(None, description="MIME type")
    size_bytes: int | None = Field(None, description="File size in bytes")


class AssetBrief(BaseModel):
    """Brief asset information for page detail."""

    asset_id: UUID = Field(..., description="Asset UUID")
    title: str | None = Field(None, description="Asset title")
    type: str = Field(..., description="Media type")
    caption_html: str | None = Field(None, description="Rich HTML caption")
    caption_text: str | None = Field(None, description="Plain text caption")
    files: list[AssetFileResponse] = Field(default_factory=list)
    thumbnail_url: str | None = Field(None, description="Thumbnail URL")


class RelatedPage(BaseModel):
    """Related SVS page reference."""

    svs_id: int = Field(..., description="Related page SVS ID")
    title: str = Field(..., description="Related page title")
    rel_type: str = Field(..., description="Relationship type")


class PageDetailResponse(BaseModel):
    """Full SVS page details."""

    svs_id: int = Field(..., description="SVS page ID")
    title: str = Field(..., description="Page title")
    canonical_url: str = Field(..., description="Original SVS URL")
    published_date: date | None = Field(None, description="Publication date")
    content: RichContent | None = Field(None, description="Structured rich content with HTML")
    summary: str | None = Field(None, description="Plain text summary (deprecated, use content)")
    credits: list[CreditInfo] = Field(default_factory=list, description="Credits")
    tags: list[TagInfo] = Field(default_factory=list, description="Associated tags")
    assets: list[AssetBrief] = Field(default_factory=list, description="Associated assets")
    related_pages: list[RelatedPage] = Field(default_factory=list, description="Related pages")


class PageListResponse(BaseModel):
    """List of SVS pages (for admin/bulk operations)."""

    count: int = Field(..., description="Total pages")
    results: list[PageDetailResponse] = Field(..., description="Page list")
    next: str | None = None
    previous: str | None = None
