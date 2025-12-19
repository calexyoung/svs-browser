"""Chat service with RAG using LangChain and multiple LLM backends."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass, field

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from app.config import get_settings
from app.services.retrieval import RetrievalService, RetrievedChunk

logger = logging.getLogger(__name__)


# System prompt for RAG
RAG_SYSTEM_PROMPT = """You are an expert assistant for NASA's Scientific Visualization Studio (SVS) archive.
Your role is to help users discover and understand NASA's scientific visualizations.

IMPORTANT RULES:
1. Base your answers ONLY on the provided context from the SVS archive
2. ALWAYS cite your sources using the format [SVS-{id}] where {id} is the SVS page ID
3. If you cannot find relevant information in the context, say: "I couldn't find information about that in the indexed SVS archive."
4. Be concise but informative
5. When describing visualizations, mention the data sources, missions, and scientific significance
6. Do not make up information or cite sources that aren't in the context

Context from the SVS archive:
{context}
"""


@dataclass
class Citation:
    """A citation to an SVS source."""

    svs_id: int
    title: str
    section: str
    excerpt: str


@dataclass
class ChatMessage:
    """A chat message with role and content."""

    role: str  # "user" or "assistant"
    content: str


@dataclass
class ChatResponse:
    """Response from the chat service."""

    answer: str
    citations: list[Citation] = field(default_factory=list)
    sources_used: int = 0


def get_llm():
    """Get the LLM based on configuration."""
    settings = get_settings()
    backend = settings.llm_backend.lower()
    model = settings.llm_model

    if backend == "openai":
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(
            model=model,
            api_key=settings.openai_api_key,
            temperature=0.7,
            streaming=True,
        )

    elif backend == "anthropic":
        from langchain_anthropic import ChatAnthropic

        return ChatAnthropic(
            model=model,
            api_key=settings.anthropic_api_key,
            temperature=0.7,
            streaming=True,
        )

    elif backend == "ollama":
        from langchain_community.chat_models import ChatOllama

        return ChatOllama(
            model=model,
            base_url=settings.ollama_base_url,
            temperature=0.7,
        )

    else:
        raise ValueError(f"Unknown LLM backend: {backend}")


class ChatService:
    """Chat service with RAG capabilities."""

    def __init__(self, retrieval_service: RetrievalService):
        self.retrieval_service = retrieval_service
        self.llm = get_llm()

    async def chat(
        self,
        query: str,
        history: list[ChatMessage] | None = None,
        max_context_tokens: int = 4000,
    ) -> ChatResponse:
        """
        Process a chat query with RAG.

        Args:
            query: The user's question
            history: Previous chat messages for context
            max_context_tokens: Maximum tokens for retrieved context

        Returns:
            ChatResponse with answer and citations
        """
        # Retrieve relevant chunks
        chunks, context = await self.retrieval_service.retrieve_for_context(query, max_tokens=max_context_tokens)

        # Build the prompt
        messages = self._build_messages(query, context, history)

        # Get response from LLM
        response = await self.llm.ainvoke(messages)
        answer = response.content

        # Extract citations from the retrieved chunks
        citations = self._build_citations(chunks, answer)

        return ChatResponse(
            answer=answer,
            citations=citations,
            sources_used=len(chunks),
        )

    async def chat_stream(
        self,
        query: str,
        history: list[ChatMessage] | None = None,
        max_context_tokens: int = 4000,
    ) -> AsyncIterator[str | ChatResponse]:
        """
        Stream a chat response with RAG.

        Yields:
            String tokens as they are generated, then a final ChatResponse
        """
        # Retrieve relevant chunks
        chunks, context = await self.retrieval_service.retrieve_for_context(query, max_tokens=max_context_tokens)

        # Build the prompt
        messages = self._build_messages(query, context, history)

        # Stream response from LLM
        full_response = ""
        async for chunk in self.llm.astream(messages):
            if hasattr(chunk, "content") and chunk.content:
                full_response += chunk.content
                yield chunk.content

        # Build final response with citations
        citations = self._build_citations(chunks, full_response)

        yield ChatResponse(
            answer=full_response,
            citations=citations,
            sources_used=len(chunks),
        )

    def _build_messages(
        self,
        query: str,
        context: str,
        history: list[ChatMessage] | None,
    ) -> list:
        """Build the message list for the LLM."""
        messages = []

        # System message with context
        system_content = RAG_SYSTEM_PROMPT.format(context=context)
        messages.append(SystemMessage(content=system_content))

        # Add history if provided
        if history:
            for msg in history[-6:]:  # Limit to last 6 messages
                if msg.role == "user":
                    messages.append(HumanMessage(content=msg.content))
                else:
                    messages.append(AIMessage(content=msg.content))

        # Add current query
        messages.append(HumanMessage(content=query))

        return messages

    def _build_citations(self, chunks: list[RetrievedChunk], answer: str) -> list[Citation]:
        """Build citations from retrieved chunks that were referenced in the answer."""
        citations = []
        seen_svs_ids = set()

        for chunk in chunks:
            # Check if this source was cited in the answer
            citation_pattern = f"[SVS-{chunk.svs_id}]"
            if citation_pattern in answer and chunk.svs_id not in seen_svs_ids:
                seen_svs_ids.add(chunk.svs_id)
                citations.append(
                    Citation(
                        svs_id=chunk.svs_id,
                        title=chunk.page_title,
                        section=chunk.section,
                        excerpt=chunk.content[:200] + "..." if len(chunk.content) > 200 else chunk.content,
                    )
                )

        # If no explicit citations but we used sources, include top sources
        if not citations and chunks:
            for chunk in chunks[:3]:
                if chunk.svs_id not in seen_svs_ids:
                    seen_svs_ids.add(chunk.svs_id)
                    citations.append(
                        Citation(
                            svs_id=chunk.svs_id,
                            title=chunk.page_title,
                            section=chunk.section,
                            excerpt=chunk.content[:200] + "..." if len(chunk.content) > 200 else chunk.content,
                        )
                    )

        return citations


async def get_chat_service(retrieval_service: RetrievalService) -> ChatService:
    """Factory function to create a chat service."""
    return ChatService(retrieval_service)
