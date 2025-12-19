"""Embedding models for vector storage."""
from __future__ import annotations


from uuid import UUID

from pgvector.sqlalchemy import Vector
from sqlalchemy import CheckConstraint, Index, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class Embedding(Base, TimestampMixin):
    """Vector embedding for a text chunk."""

    __tablename__ = "embedding"

    embedding_id: Mapped[UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    chunk_id: Mapped[UUID] = mapped_column()
    chunk_type: Mapped[str] = mapped_column(String(10))  # 'page' or 'asset'
    model_name: Mapped[str] = mapped_column(String(100))
    model_version: Mapped[str] = mapped_column(String(50))
    dims: Mapped[int] = mapped_column()
    embedding: Mapped[list[float]] = mapped_column(Vector(1024))  # BGE-large-en-v1.5
    is_current: Mapped[bool] = mapped_column(default=True)

    __table_args__ = (
        CheckConstraint(
            "chunk_type IN ('page', 'asset')", name="valid_chunk_type"
        ),
        Index(
            "ix_embedding_hnsw",
            "embedding",
            postgresql_using="hnsw",
            postgresql_with={"m": 16, "ef_construction": 64},
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
        Index("ix_embedding_chunk", "chunk_id", "chunk_type"),
        Index("ix_embedding_model", "model_name", "model_version"),
        Index(
            "ix_embedding_current",
            "is_current",
            postgresql_where=text("is_current = TRUE"),
        ),
    )
