"""Hybrid retrieval service combining keyword and vector search for RAG."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import and_, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chunk import PageTextChunk
from app.models.embedding import Embedding
from app.models.page import SvsPage
from app.services.embedding import get_embedding_service

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)


@dataclass
class RetrievedChunk:
    """A retrieved text chunk with relevance scoring."""

    chunk_id: UUID
    svs_id: int
    page_title: str
    section: str
    content: str
    keyword_score: float
    vector_score: float
    combined_score: float


class RetrievalService:
    """Hybrid retrieval service combining keyword search and vector similarity."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.embedding_service = get_embedding_service()

    async def retrieve(
        self,
        query: str,
        top_k: int = 10,
        keyword_weight: float = 0.3,
        vector_weight: float = 0.7,
        min_score: float = 0.1,
    ) -> list[RetrievedChunk]:
        """
        Retrieve relevant text chunks using hybrid search.

        Args:
            query: The search query
            top_k: Number of chunks to return
            keyword_weight: Weight for keyword search score (0-1)
            vector_weight: Weight for vector similarity score (0-1)
            min_score: Minimum combined score to include a result

        Returns:
            List of RetrievedChunk objects sorted by relevance
        """
        # Generate query embedding
        query_embedding = await self.embedding_service.generate_embedding(query)

        # Get keyword search results
        keyword_results = await self._keyword_search(query, top_k=top_k * 2)

        # Get vector search results
        vector_results = await self._vector_search(query_embedding, top_k=top_k * 2)

        # Merge and rank results
        combined = self._merge_results(
            keyword_results,
            vector_results,
            keyword_weight=keyword_weight,
            vector_weight=vector_weight,
        )

        # Filter by minimum score and return top-k
        filtered = [r for r in combined if r.combined_score >= min_score]
        return sorted(filtered, key=lambda x: x.combined_score, reverse=True)[:top_k]

    async def _keyword_search(self, query: str, top_k: int = 20) -> dict[UUID, tuple[float, PageTextChunk, SvsPage]]:
        """
        Search chunks using PostgreSQL full-text search.

        Returns dict mapping chunk_id to (score, chunk, page).
        """
        # Use websearch_to_tsquery for boolean search support
        ts_query = func.websearch_to_tsquery("english", query)

        # Create a text search vector from chunk content
        content_vector = func.to_tsvector("english", PageTextChunk.content)

        # Calculate rank
        rank = func.ts_rank(content_vector, ts_query)

        # Query chunks with FTS match
        stmt = (
            select(PageTextChunk, SvsPage, rank.label("score"))
            .join(SvsPage, SvsPage.svs_id == PageTextChunk.svs_id)
            .where(content_vector.op("@@")(ts_query))
            .order_by(rank.desc())
            .limit(top_k)
        )

        result = await self.session.execute(stmt)
        rows = result.all()

        # Return as dict for merging
        results = {}
        if rows:
            # Normalize scores to 0-1 range
            max_score = max(r.score for r in rows) if rows else 1.0
            for row in rows:
                normalized_score = row.score / max_score if max_score > 0 else 0
                results[row.PageTextChunk.chunk_id] = (
                    normalized_score,
                    row.PageTextChunk,
                    row.SvsPage,
                )

        return results

    async def _vector_search(
        self, query_embedding: list[float], top_k: int = 20
    ) -> dict[UUID, tuple[float, PageTextChunk, SvsPage]]:
        """
        Search chunks using vector similarity.

        Uses cosine distance for similarity ranking.
        Returns dict mapping chunk_id to (score, chunk, page).
        """
        # Cast embedding to vector type for pgvector
        query_vector = text(f"'{query_embedding}'::vector")

        # Cosine distance (1 - similarity), lower is better
        # Convert to similarity score (1 - distance) so higher is better
        distance = Embedding.embedding.cosine_distance(query_vector)
        similarity = (1 - distance).label("similarity")

        stmt = (
            select(
                PageTextChunk,
                SvsPage,
                similarity,
            )
            .join(
                Embedding,
                and_(
                    Embedding.chunk_id == PageTextChunk.chunk_id,
                    Embedding.chunk_type == "page",
                    Embedding.is_current.is_(True),
                    Embedding.model_name == self.embedding_service.model_name,
                ),
            )
            .join(SvsPage, SvsPage.svs_id == PageTextChunk.svs_id)
            .order_by(distance)
            .limit(top_k)
        )

        result = await self.session.execute(stmt)
        rows = result.all()

        # Return as dict for merging
        results = {}
        for row in rows:
            # Similarity is already 0-1 (cosine similarity)
            results[row.PageTextChunk.chunk_id] = (
                float(row.similarity),
                row.PageTextChunk,
                row.SvsPage,
            )

        return results

    def _merge_results(
        self,
        keyword_results: dict[UUID, tuple[float, PageTextChunk, SvsPage]],
        vector_results: dict[UUID, tuple[float, PageTextChunk, SvsPage]],
        keyword_weight: float,
        vector_weight: float,
    ) -> list[RetrievedChunk]:
        """
        Merge keyword and vector search results with weighted scoring.

        Uses Reciprocal Rank Fusion (RRF) style combination.
        """
        # Collect all unique chunk IDs
        all_chunk_ids = set(keyword_results.keys()) | set(vector_results.keys())

        combined = []
        for chunk_id in all_chunk_ids:
            # Get scores and data from each source
            keyword_data = keyword_results.get(chunk_id)
            vector_data = vector_results.get(chunk_id)

            keyword_score = keyword_data[0] if keyword_data else 0.0
            vector_score = vector_data[0] if vector_data else 0.0

            # Get chunk and page data (prefer vector since it's more complete)
            if vector_data:
                _, chunk, page = vector_data
            else:
                _, chunk, page = keyword_data

            # Calculate combined score
            combined_score = (keyword_weight * keyword_score) + (vector_weight * vector_score)

            # Boost if found in both searches (indicates high relevance)
            if keyword_data and vector_data:
                combined_score *= 1.2  # 20% boost for appearing in both

            combined.append(
                RetrievedChunk(
                    chunk_id=chunk_id,
                    svs_id=page.svs_id,
                    page_title=page.title,
                    section=chunk.section,
                    content=chunk.content,
                    keyword_score=keyword_score,
                    vector_score=vector_score,
                    combined_score=min(combined_score, 1.0),  # Cap at 1.0
                )
            )

        return combined

    async def retrieve_for_context(
        self,
        query: str,
        max_tokens: int = 4000,
        top_k: int = 10,
    ) -> tuple[list[RetrievedChunk], str]:
        """
        Retrieve chunks and format them for LLM context.

        Args:
            query: The search query
            max_tokens: Maximum tokens for context (rough estimate)
            top_k: Maximum number of chunks to retrieve

        Returns:
            Tuple of (chunks, formatted_context_string)
        """
        chunks = await self.retrieve(query, top_k=top_k)

        # Format chunks for context, respecting token limit
        # Rough estimate: 4 chars = 1 token
        max_chars = max_tokens * 4
        context_parts = []
        included_chunks = []
        total_chars = 0

        for chunk in chunks:
            # Format chunk with source attribution
            chunk_text = (
                f"[Source: SVS-{chunk.svs_id} - {chunk.page_title}]\nSection: {chunk.section}\n{chunk.content}\n"
            )

            if total_chars + len(chunk_text) > max_chars:
                break

            context_parts.append(chunk_text)
            included_chunks.append(chunk)
            total_chars += len(chunk_text)

        context = "\n---\n".join(context_parts)
        return included_chunks, context


async def get_retrieval_service(session: AsyncSession) -> RetrievalService:
    """Factory function to create a retrieval service."""
    return RetrievalService(session)
