"""Pydantic schemas for API request/response models."""

from app.schemas.asset import (
    AssetDetailResponse,
    AssetFileDetail,
    ThumbnailResponse,
)
from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    Citation,
)
from app.schemas.common import (
    ErrorDetail,
    ErrorResponse,
    HealthResponse,
    PaginatedResponse,
    PaginationParams,
)
from app.schemas.page import (
    AssetBrief,
    AssetFileResponse,
    CreditInfo,
    PageDetailResponse,
    PageListResponse,
    RelatedPage,
    SearchFacets,
    SearchParams,
    SearchResponse,
    SearchResult,
    TagInfo,
)

__all__ = [
    # Common
    "ErrorDetail",
    "ErrorResponse",
    "HealthResponse",
    "PaginatedResponse",
    "PaginationParams",
    # Page
    "SearchParams",
    "SearchResult",
    "SearchFacets",
    "SearchResponse",
    "PageDetailResponse",
    "PageListResponse",
    "AssetBrief",
    "AssetFileResponse",
    "CreditInfo",
    "TagInfo",
    "RelatedPage",
    # Asset
    "AssetDetailResponse",
    "AssetFileDetail",
    "ThumbnailResponse",
    # Chat
    "ChatRequest",
    "ChatResponse",
    "Citation",
]
