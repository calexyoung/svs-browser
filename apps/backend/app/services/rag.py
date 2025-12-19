"""RAG service for retrieval-augmented generation."""

from __future__ import annotations

import logging
import re
import uuid
from collections.abc import AsyncIterator
from dataclasses import dataclass

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.page import SvsPage
from app.schemas.chat import Citation
from app.services.embedding import get_embedding_service
from app.services.retrieval import RetrievalService

logger = logging.getLogger(__name__)


@dataclass
class ChunkWithScore:
    """A text chunk with similarity score."""

    chunk_id: uuid.UUID
    svs_id: int
    title: str
    section: str
    content: str
    score: float


RAG_SYSTEM_PROMPT = """You are an assistant helping users learn about NASA's Scientific Visualization Studio (SVS) content.

IMPORTANT RULES:
1. Answer based ONLY on the provided context below. Do not use any external knowledge.
2. If the answer isn't in the context, say "I couldn't find information about that in the SVS archive."
3. ALWAYS cite your sources using [SVS-ID] format inline after each fact, where ID is the numeric SVS page ID shown in the context.
4. Be concise but informative.
5. If multiple sources support a fact, cite all of them.

Context from SVS Archive:
{context}"""


def get_llm_client():
    """Get the appropriate LLM client based on configuration."""
    settings = get_settings()
    backend = settings.llm_backend.lower()

    if backend == "openai":
        from openai import AsyncOpenAI

        return AsyncOpenAI(api_key=settings.openai_api_key), "openai"
    elif backend == "anthropic":
        from anthropic import AsyncAnthropic

        return AsyncAnthropic(api_key=settings.anthropic_api_key), "anthropic"
    elif backend == "ollama":
        # Use OpenAI client with Ollama endpoint
        from openai import AsyncOpenAI

        return AsyncOpenAI(
            api_key="ollama",
            base_url=f"{settings.ollama_base_url}/v1",
        ), "openai"  # Ollama uses OpenAI-compatible API
    else:
        raise ValueError(f"Unknown LLM backend: {backend}")


class RAGService:
    """Service for RAG-based question answering."""

    def __init__(self, session: AsyncSession):
        self.session = session
        settings = get_settings()
        self.client, self.client_type = get_llm_client()
        self.model = settings.llm_model
        self.embedding_service = get_embedding_service()
        self.retrieval_service = RetrievalService(session)

    async def retrieve_context(
        self, query: str, limit: int = 5, context_svs_id: int | None = None
    ) -> list[ChunkWithScore]:
        """Retrieve relevant context chunks using hybrid search (keyword + vector).

        Uses the RetrievalService for global search, or focused vector search for specific pages.
        """
        if context_svs_id:
            # Focused Q&A on specific page - use pure vector search
            query_embedding = await self.embedding_service.generate_embedding(query)
            embedding_str = "[" + ",".join(str(x) for x in query_embedding) + "]"

            sql = text("""
                SELECT
                    ptc.chunk_id,
                    ptc.svs_id,
                    sp.title,
                    ptc.section,
                    ptc.content,
                    1 - (e.embedding <=> :embedding::vector) as score
                FROM page_text_chunk ptc
                JOIN embedding e ON e.chunk_id = ptc.chunk_id AND e.chunk_type = 'page'
                JOIN svs_page sp ON sp.svs_id = ptc.svs_id
                WHERE ptc.svs_id = :svs_id
                    AND e.is_current = true
                ORDER BY e.embedding <=> :embedding::vector
                LIMIT :limit
            """)
            result = await self.session.execute(
                sql, {"embedding": embedding_str, "svs_id": context_svs_id, "limit": limit}
            )
            rows = result.fetchall()
            chunks = []
            for row in rows:
                chunks.append(
                    ChunkWithScore(
                        chunk_id=row.chunk_id,
                        svs_id=row.svs_id,
                        title=row.title,
                        section=row.section,
                        content=row.content,
                        score=float(row.score),
                    )
                )
            return chunks
        else:
            # Global search - use hybrid retrieval (keyword + vector)
            retrieved = await self.retrieval_service.retrieve(query, top_k=limit)
            chunks = []
            for r in retrieved:
                chunks.append(
                    ChunkWithScore(
                        chunk_id=r.chunk_id,
                        svs_id=r.svs_id,
                        title=r.page_title,
                        section=r.section,
                        content=r.content,
                        score=r.combined_score,
                    )
                )
            return chunks

    async def retrieve_context_fallback(
        self, query: str, limit: int = 5, context_svs_id: int | None = None
    ) -> list[ChunkWithScore]:
        """Fallback retrieval using full-text search when no embeddings exist."""
        # Use PostgreSQL full-text search on svs_page
        base_query = select(SvsPage).where(
            SvsPage.status == "active",
            SvsPage.search_vector.isnot(None),
        )

        if context_svs_id:
            base_query = base_query.where(SvsPage.svs_id == context_svs_id)
        else:
            # Full-text search
            from sqlalchemy import func

            ts_query = func.plainto_tsquery("english", query)
            base_query = base_query.where(SvsPage.search_vector.op("@@")(ts_query)).order_by(
                func.ts_rank(SvsPage.search_vector, ts_query).desc()
            )

        base_query = base_query.limit(limit)
        result = await self.session.execute(base_query)
        pages = result.scalars().all()

        chunks = []
        for page in pages:
            # Create a pseudo-chunk from the page content
            content = f"{page.title}\n\n{page.description or page.summary or ''}"
            chunks.append(
                ChunkWithScore(
                    chunk_id=uuid.uuid4(),  # Placeholder
                    svs_id=page.svs_id,
                    title=page.title,
                    section="description",
                    content=content[:2000],  # Truncate to reasonable size
                    score=0.5,  # Placeholder score
                )
            )

        return chunks

    def build_context_string(self, chunks: list[ChunkWithScore]) -> str:
        """Build context string from chunks for the prompt."""
        if not chunks:
            return "No relevant context found."

        context_parts = []
        for chunk in chunks:
            context_parts.append(
                f"[SVS-{chunk.svs_id}] {chunk.title}\nSection: {chunk.section}\nContent: {chunk.content}\n"
            )

        return "\n---\n".join(context_parts)

    async def generate_response_stream(self, query: str, context: list[ChunkWithScore]) -> AsyncIterator[str]:
        """Generate streaming response from LLM (supports OpenAI and Anthropic)."""
        context_str = self.build_context_string(context)
        system_prompt = RAG_SYSTEM_PROMPT.format(context=context_str)

        try:
            if self.client_type == "openai":
                # OpenAI API (also works for Ollama)
                stream = await self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": query},
                    ],
                    stream=True,
                    temperature=0.3,  # Lower temperature for factual responses
                    max_tokens=1000,
                )

                async for chunk in stream:
                    if chunk.choices and chunk.choices[0].delta.content:
                        yield chunk.choices[0].delta.content

            elif self.client_type == "anthropic":
                # Anthropic API
                async with self.client.messages.stream(
                    model=self.model,
                    max_tokens=1000,
                    temperature=0.3,
                    system=system_prompt,
                    messages=[
                        {"role": "user", "content": query},
                    ],
                ) as stream:
                    async for text in stream.text_stream:
                        yield text

        except Exception as e:
            logger.error(f"Error generating response: {e}")
            yield f"I encountered an error while generating a response: {str(e)}"

    def extract_citations(self, response: str, context: list[ChunkWithScore]) -> list[Citation]:
        """Extract citations from the response based on SVS-ID references."""
        # Find all [SVS-{id}] patterns in the response
        pattern = r"\[SVS-(\d+)\]"
        matches = re.findall(pattern, response)
        cited_ids = set(int(m) for m in matches)

        # Build citations from context chunks that were cited
        citations = []
        seen_svs_ids = set()

        for chunk in context:
            if chunk.svs_id in cited_ids and chunk.svs_id not in seen_svs_ids:
                seen_svs_ids.add(chunk.svs_id)
                citations.append(
                    Citation(
                        svs_id=chunk.svs_id,
                        title=chunk.title,
                        chunk_id=chunk.chunk_id,
                        section=chunk.section,
                        anchor=f"svs-{chunk.svs_id}",
                        excerpt=chunk.content[:200] + "..." if len(chunk.content) > 200 else chunk.content,
                    )
                )

        return citations

    async def chat(
        self,
        query: str,
        context_svs_id: int | None = None,
        use_embeddings: bool = True,
    ) -> tuple[str, list[Citation]]:
        """Non-streaming chat for simpler use cases."""
        # Retrieve context
        if use_embeddings:
            try:
                context = await self.retrieve_context(query, limit=5, context_svs_id=context_svs_id)
            except Exception as e:
                logger.warning(f"Embedding retrieval failed, using fallback: {e}")
                # Rollback the failed transaction before fallback
                await self.session.rollback()
                context = await self.retrieve_context_fallback(query, limit=5, context_svs_id=context_svs_id)
        else:
            context = await self.retrieve_context_fallback(query, limit=5, context_svs_id=context_svs_id)

        if not context:
            return (
                "I couldn't find any relevant information in the SVS archive to answer your question.",
                [],
            )

        # Generate response
        response_parts = []
        async for token in self.generate_response_stream(query, context):
            response_parts.append(token)

        response = "".join(response_parts)
        citations = self.extract_citations(response, context)

        return response, citations
