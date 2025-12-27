"""Chat/RAG API endpoints."""

from __future__ import annotations

import json
import logging
import uuid

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.rate_limit import rate_limit_chat
from app.services.rag import RAGService

logger = logging.getLogger(__name__)

router = APIRouter()


class ChatRequest(BaseModel):
    """Chat query request model."""

    query: str = Field(..., min_length=1, max_length=2000, description="User question")
    conversation_id: str | None = Field(None, description="Optional conversation ID for context")
    context_svs_id: int | None = Field(None, description="Optional SVS page ID for focused Q&A")
    settings: dict | None = Field(None, description="Optional LLM settings")


@router.post("/chat/query", dependencies=[Depends(rate_limit_chat)])
async def chat_query(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """
    Ask a question about SVS content.

    Returns a streaming SSE response with:
    - token events: Individual response tokens
    - citation events: Source citations
    - done event: Completion with metadata

    Example SSE events:
    ```
    event: token
    data: {"content": "The "}

    event: citation
    data: {"svs_id": 12345, "title": "...", ...}

    event: done
    data: {"conversation_id": "...", "token_count": 150}
    ```
    """
    rag_service = RAGService(db)
    conversation_id = request.conversation_id or str(uuid.uuid4())

    async def generate():
        token_count = 0
        response_text = ""
        citations_sent = set()

        try:
            # Retrieve context
            try:
                context = await rag_service.retrieve_context(
                    request.query,
                    limit=5,
                    context_svs_id=request.context_svs_id,
                )
            except Exception as e:
                logger.warning(f"Embedding retrieval failed, using fallback: {e}")
                # Rollback the failed transaction before fallback
                await db.rollback()
                context = await rag_service.retrieve_context_fallback(
                    request.query,
                    limit=5,
                    context_svs_id=request.context_svs_id,
                )

            if not context:
                yield 'event: token\ndata: {"content": "I couldn\'t find any relevant information in the SVS archive to answer your question."}\n\n'
                yield f'event: done\ndata: {{"conversation_id": "{conversation_id}", "token_count": 0}}\n\n'
                return

            # Stream the response
            async for token in rag_service.generate_response_stream(request.query, context):
                response_text += token
                token_count += 1

                # Send token event
                token_data = json.dumps({"content": token})
                yield f"event: token\ndata: {token_data}\n\n"

                # Check for new citations in accumulated text
                import re

                matches = re.findall(r"\[SVS-(\d+)\]", response_text)
                for svs_id_str in matches:
                    svs_id = int(svs_id_str)
                    if svs_id not in citations_sent:
                        # Find the matching chunk
                        for chunk in context:
                            if chunk.svs_id == svs_id:
                                citations_sent.add(svs_id)
                                citation_data = json.dumps(
                                    {
                                        "svs_id": chunk.svs_id,
                                        "title": chunk.title,
                                        "chunk_id": str(chunk.chunk_id),
                                        "section": chunk.section,
                                        "anchor": f"svs-{chunk.svs_id}",
                                        "excerpt": chunk.content[:200] + "..."
                                        if len(chunk.content) > 200
                                        else chunk.content,
                                    }
                                )
                                yield f"event: citation\ndata: {citation_data}\n\n"
                                break

            # Send done event
            done_data = json.dumps(
                {
                    "conversation_id": conversation_id,
                    "token_count": token_count,
                }
            )
            yield f"event: done\ndata: {done_data}\n\n"

        except Exception as e:
            logger.error(f"Error in chat stream: {e}")
            error_data = json.dumps({"content": f"An error occurred: {str(e)}"})
            yield f"event: error\ndata: {error_data}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )


@router.post("/chat/query/sync", dependencies=[Depends(rate_limit_chat)])
async def chat_query_sync(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Non-streaming chat endpoint for simpler integrations.

    Returns the complete response with citations.
    """
    rag_service = RAGService(db)
    conversation_id = request.conversation_id or str(uuid.uuid4())

    response_text, citations = await rag_service.chat(
        request.query,
        context_svs_id=request.context_svs_id,
    )

    return {
        "content": response_text,
        "conversation_id": conversation_id,
        "citations": [
            {
                "svs_id": c.svs_id,
                "title": c.title,
                "chunk_id": str(c.chunk_id),
                "section": c.section,
                "anchor": c.anchor,
                "excerpt": c.excerpt,
            }
            for c in citations
        ],
        "token_count": len(response_text.split()),  # Rough estimate
    }
