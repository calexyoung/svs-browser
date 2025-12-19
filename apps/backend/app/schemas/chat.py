"""Schemas for chat/RAG endpoints."""
from __future__ import annotations


from uuid import UUID

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    """Chat query request."""

    query: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="User question",
    )
    conversation_id: str | None = Field(
        None,
        description="Optional conversation ID for context",
    )
    context_svs_id: int | None = Field(
        None,
        description="Optional SVS page ID for focused Q&A",
    )
    settings: dict | None = Field(
        None,
        description="Optional LLM settings",
    )


class Citation(BaseModel):
    """Citation from RAG response."""

    svs_id: int = Field(..., description="Source SVS page ID")
    title: str = Field(..., description="Source page title")
    chunk_id: UUID = Field(..., description="Source chunk ID")
    section: str = Field(..., description="Section type (description, caption, etc.)")
    anchor: str = Field(..., description="Anchor for highlighting")
    excerpt: str = Field(..., description="Preview excerpt (2-3 lines)")


class ChatResponse(BaseModel):
    """Chat response (for non-streaming)."""

    content: str = Field(..., description="Response text")
    conversation_id: str = Field(..., description="Conversation ID")
    citations: list[Citation] = Field(default_factory=list, description="Source citations")
    token_count: int = Field(..., description="Tokens used")


class ChatStreamToken(BaseModel):
    """Streaming token event."""

    content: str = Field(..., description="Token content")


class ChatStreamCitation(BaseModel):
    """Streaming citation event."""

    citation: Citation = Field(..., description="Citation data")


class ChatStreamDone(BaseModel):
    """Streaming completion event."""

    conversation_id: str = Field(..., description="Conversation ID")
    token_count: int = Field(..., description="Total tokens used")
