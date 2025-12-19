"""Text chunking service for RAG."""
from __future__ import annotations

import hashlib
import logging
import re
from typing import TYPE_CHECKING
from uuid import UUID

import tiktoken
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chunk import AssetChunkSection, AssetTextChunk, PageChunkSection, PageTextChunk
from app.models.page import SvsPage

if TYPE_CHECKING:
    from app.models.asset import Asset

logger = logging.getLogger(__name__)

# Use cl100k_base tokenizer (same as GPT-4)
ENCODING = tiktoken.get_encoding("cl100k_base")

# Chunk configuration
TARGET_CHUNK_SIZE = 512  # tokens
MAX_CHUNK_SIZE = 768  # tokens
OVERLAP_SIZE = 64  # tokens


def count_tokens(text: str) -> int:
    """Count tokens in text using tiktoken."""
    return len(ENCODING.encode(text))


def hash_content(content: str) -> str:
    """Generate SHA-256 hash of content."""
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def split_into_sentences(text: str) -> list[str]:
    """Split text into sentences."""
    # Simple sentence splitter
    sentences = re.split(r"(?<=[.!?])\s+", text)
    return [s.strip() for s in sentences if s.strip()]


def chunk_text(
    text: str,
    target_size: int = TARGET_CHUNK_SIZE,
    max_size: int = MAX_CHUNK_SIZE,
    overlap: int = OVERLAP_SIZE,
) -> list[str]:
    """
    Split text into overlapping chunks respecting sentence boundaries.

    Args:
        text: Text to chunk
        target_size: Target chunk size in tokens
        max_size: Maximum chunk size in tokens
        overlap: Overlap between chunks in tokens

    Returns:
        List of text chunks
    """
    if not text.strip():
        return []

    sentences = split_into_sentences(text)
    if not sentences:
        return [text[:5000]]  # Fallback: just truncate

    chunks = []
    current_chunk: list[str] = []
    current_tokens = 0

    for sentence in sentences:
        sentence_tokens = count_tokens(sentence)

        # If single sentence exceeds max, split it
        if sentence_tokens > max_size:
            # Finish current chunk if any
            if current_chunk:
                chunks.append(" ".join(current_chunk))
                current_chunk = []
                current_tokens = 0

            # Split long sentence by words
            words = sentence.split()
            temp_chunk = []
            temp_tokens = 0
            for word in words:
                word_tokens = count_tokens(word + " ")
                if temp_tokens + word_tokens > max_size and temp_chunk:
                    chunks.append(" ".join(temp_chunk))
                    # Keep overlap
                    overlap_words = temp_chunk[-10:] if len(temp_chunk) > 10 else temp_chunk
                    temp_chunk = overlap_words
                    temp_tokens = count_tokens(" ".join(temp_chunk))
                temp_chunk.append(word)
                temp_tokens += word_tokens
            if temp_chunk:
                current_chunk = temp_chunk
                current_tokens = temp_tokens
            continue

        # Check if adding sentence exceeds target
        if current_tokens + sentence_tokens > target_size and current_chunk:
            # Save current chunk
            chunks.append(" ".join(current_chunk))

            # Start new chunk with overlap
            # Keep last few sentences for overlap
            overlap_sentences = []
            overlap_tokens = 0
            for s in reversed(current_chunk):
                s_tokens = count_tokens(s)
                if overlap_tokens + s_tokens > overlap:
                    break
                overlap_sentences.insert(0, s)
                overlap_tokens += s_tokens

            current_chunk = overlap_sentences
            current_tokens = overlap_tokens

        current_chunk.append(sentence)
        current_tokens += sentence_tokens

    # Don't forget the last chunk
    if current_chunk:
        chunks.append(" ".join(current_chunk))

    return chunks


class ChunkingService:
    """Service for chunking SVS page content."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def chunk_page(self, page: SvsPage) -> list[PageTextChunk]:
        """Create text chunks from an SVS page."""
        chunks = []

        # Chunk description
        if page.description:
            description_chunks = chunk_text(page.description)
            for i, content in enumerate(description_chunks):
                chunk = PageTextChunk(
                    svs_id=page.svs_id,
                    section=PageChunkSection.DESCRIPTION.value,
                    chunk_index=i,
                    content=content,
                    token_count=count_tokens(content),
                    content_hash=hash_content(content),
                )
                chunks.append(chunk)

        # Chunk summary if different from description
        if page.summary and page.summary != page.description:
            summary_chunks = chunk_text(page.summary)
            for i, content in enumerate(summary_chunks):
                chunk = PageTextChunk(
                    svs_id=page.svs_id,
                    section=PageChunkSection.OTHER.value,
                    chunk_index=i,
                    content=content,
                    token_count=count_tokens(content),
                    content_hash=hash_content(content),
                )
                chunks.append(chunk)

        return chunks

    async def chunk_asset(self, asset: "Asset") -> list[AssetTextChunk]:
        """Create text chunks from an asset's text content."""
        chunks = []

        # Chunk caption
        if asset.caption:
            caption_chunks = chunk_text(asset.caption)
            for i, content in enumerate(caption_chunks):
                chunk = AssetTextChunk(
                    asset_id=asset.asset_id,
                    section=AssetChunkSection.CAPTION.value,
                    chunk_index=i,
                    content=content,
                    token_count=count_tokens(content),
                    content_hash=hash_content(content),
                )
                chunks.append(chunk)

        return chunks

    async def process_page(self, svs_id: int) -> int:
        """
        Process a page: create chunks and optionally generate embeddings.

        Returns number of chunks created.
        """
        # Get the page
        query = select(SvsPage).where(SvsPage.svs_id == svs_id)
        result = await self.session.execute(query)
        page = result.scalar_one_or_none()

        if not page:
            logger.warning(f"Page {svs_id} not found")
            return 0

        # Delete existing chunks for this page
        await self.session.execute(
            PageTextChunk.__table__.delete().where(PageTextChunk.svs_id == svs_id)
        )

        # Create new chunks
        chunks = await self.chunk_page(page)
        for chunk in chunks:
            self.session.add(chunk)

        await self.session.commit()
        return len(chunks)

    async def process_all_pages(self, batch_size: int = 100) -> int:
        """
        Process all crawled pages to create chunks.

        Returns total number of chunks created.
        """
        # Get all crawled pages
        query = select(SvsPage.svs_id).where(
            SvsPage.status == "active",
            SvsPage.html_crawled_at.isnot(None),
        )
        result = await self.session.execute(query)
        svs_ids = [row[0] for row in result.all()]

        total_chunks = 0
        for i, svs_id in enumerate(svs_ids):
            try:
                count = await self.process_page(svs_id)
                total_chunks += count
                if (i + 1) % 100 == 0:
                    logger.info(f"Processed {i + 1}/{len(svs_ids)} pages, {total_chunks} chunks")
            except Exception as e:
                logger.error(f"Error processing page {svs_id}: {e}")
                continue

        logger.info(f"Finished processing {len(svs_ids)} pages, {total_chunks} chunks created")
        return total_chunks
