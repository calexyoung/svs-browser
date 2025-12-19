"""Text chunking for RAG embeddings."""

from __future__ import annotations

import hashlib
import logging
import re
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# Chunking parameters from implementation plan
DEFAULT_TARGET_TOKENS = 512
DEFAULT_MAX_TOKENS = 768
DEFAULT_OVERLAP_TOKENS = 64
DEFAULT_MIN_TOKENS = 50

# Approximate tokens per character (for English text)
CHARS_PER_TOKEN = 4


@dataclass
class TextChunk:
    """A chunk of text for embedding."""

    content: str
    section: str  # description, credits, caption, transcript, etc.
    chunk_index: int
    token_count: int
    content_hash: str


class TextChunker:
    """
    Chunk text for embedding while respecting section boundaries.

    Parameters from implementation plan:
    - Chunk size: 512 tokens (target), 768 tokens (max)
    - Overlap: 64 tokens between adjacent chunks
    - Boundaries: Respect section boundaries
    - Sentence integrity: Never split mid-sentence
    - Minimum chunk: 50 tokens (smaller attached to previous)
    """

    def __init__(
        self,
        target_tokens: int = DEFAULT_TARGET_TOKENS,
        max_tokens: int = DEFAULT_MAX_TOKENS,
        overlap_tokens: int = DEFAULT_OVERLAP_TOKENS,
        min_tokens: int = DEFAULT_MIN_TOKENS,
    ):
        self.target_tokens = target_tokens
        self.max_tokens = max_tokens
        self.overlap_tokens = overlap_tokens
        self.min_tokens = min_tokens

        # Sentence boundary pattern
        self.sentence_pattern = re.compile(r"(?<=[.!?])\s+(?=[A-Z])|(?<=[.!?])\s*$")

    def estimate_tokens(self, text: str) -> int:
        """Estimate token count for text."""
        return len(text) // CHARS_PER_TOKEN

    def chunk_text(self, text: str, section: str) -> list[TextChunk]:
        """
        Chunk a piece of text into embedding-sized chunks.

        Args:
            text: Text content to chunk
            section: Section type (description, credits, etc.)

        Returns:
            List of TextChunk objects
        """
        if not text or not text.strip():
            return []

        text = text.strip()
        total_tokens = self.estimate_tokens(text)

        # If text is small enough, return as single chunk
        if total_tokens <= self.max_tokens:
            if total_tokens < self.min_tokens:
                # Too small to be useful on its own
                return []
            return [self._create_chunk(text, section, 0)]

        # Split into sentences
        sentences = self._split_sentences(text)

        # Build chunks from sentences
        chunks = []
        current_text = ""
        current_tokens = 0
        chunk_index = 0

        for sentence in sentences:
            sentence_tokens = self.estimate_tokens(sentence)

            # If single sentence is too long, we need to split it
            if sentence_tokens > self.max_tokens:
                # Flush current chunk if any
                if current_text:
                    chunks.append(self._create_chunk(current_text, section, chunk_index))
                    chunk_index += 1
                    current_text = ""
                    current_tokens = 0

                # Split long sentence into sub-chunks
                sub_chunks = self._split_long_sentence(sentence, section, chunk_index)
                chunks.extend(sub_chunks)
                chunk_index += len(sub_chunks)
                continue

            # Check if adding this sentence would exceed target
            if current_tokens + sentence_tokens > self.target_tokens:
                # If we have content, create a chunk
                if current_text and current_tokens >= self.min_tokens:
                    chunks.append(self._create_chunk(current_text, section, chunk_index))
                    chunk_index += 1

                    # Start new chunk with overlap
                    overlap_text = self._get_overlap_text(current_text)
                    current_text = overlap_text + sentence
                    current_tokens = self.estimate_tokens(current_text)
                else:
                    # Current chunk too small, add sentence anyway
                    current_text = (current_text + " " + sentence).strip()
                    current_tokens = self.estimate_tokens(current_text)
            else:
                # Add sentence to current chunk
                current_text = (current_text + " " + sentence).strip()
                current_tokens = self.estimate_tokens(current_text)

        # Don't forget the last chunk
        if current_text and current_tokens >= self.min_tokens:
            chunks.append(self._create_chunk(current_text, section, chunk_index))
        elif current_text and chunks:
            # Attach small remainder to previous chunk
            last_chunk = chunks[-1]
            combined = last_chunk.content + " " + current_text
            chunks[-1] = self._create_chunk(combined, section, last_chunk.chunk_index)

        return chunks

    def chunk_sections(
        self,
        sections: dict[str, str],
    ) -> list[TextChunk]:
        """
        Chunk multiple sections of text.

        Args:
            sections: Dict mapping section names to text content

        Returns:
            List of all chunks across sections
        """
        all_chunks = []

        for section_name, text in sections.items():
            if text:
                chunks = self.chunk_text(text, section_name)
                all_chunks.extend(chunks)

        # Re-index chunks globally
        for i, chunk in enumerate(all_chunks):
            # Update chunk index to be global, but keep section info
            pass  # chunk_index is already per-section which is fine

        return all_chunks

    def _split_sentences(self, text: str) -> list[str]:
        """Split text into sentences."""
        # Split on sentence boundaries
        parts = self.sentence_pattern.split(text)

        # Clean up and filter empty parts
        sentences = []
        for part in parts:
            part = part.strip()
            if part:
                sentences.append(part)

        # If no sentences found, return original text
        if not sentences:
            return [text]

        return sentences

    def _split_long_sentence(
        self,
        sentence: str,
        section: str,
        start_index: int,
    ) -> list[TextChunk]:
        """Split a sentence that's too long into smaller chunks."""
        chunks = []

        # Split on clause boundaries (commas, semicolons, etc.)
        clause_pattern = re.compile(r"[,;:]\s+")
        parts = clause_pattern.split(sentence)

        current_text = ""
        chunk_index = start_index

        for part in parts:
            if self.estimate_tokens(current_text + part) <= self.max_tokens:
                current_text = (current_text + ", " + part).strip(", ")
            else:
                if current_text:
                    chunks.append(self._create_chunk(current_text, section, chunk_index))
                    chunk_index += 1
                current_text = part

        if current_text:
            chunks.append(self._create_chunk(current_text, section, chunk_index))

        return chunks

    def _get_overlap_text(self, text: str) -> str:
        """Get overlap text from end of previous chunk."""
        overlap_chars = self.overlap_tokens * CHARS_PER_TOKEN

        if len(text) <= overlap_chars:
            return text

        # Get last overlap_chars characters
        overlap = text[-overlap_chars:]

        # Try to start at a word boundary
        space_idx = overlap.find(" ")
        if space_idx > 0:
            overlap = overlap[space_idx + 1 :]

        return overlap + " "

    def _create_chunk(self, content: str, section: str, index: int) -> TextChunk:
        """Create a TextChunk with hash."""
        content = content.strip()
        content_hash = hashlib.sha256(content.encode()).hexdigest()
        token_count = self.estimate_tokens(content)

        return TextChunk(
            content=content,
            section=section,
            chunk_index=index,
            token_count=token_count,
            content_hash=content_hash,
        )


def chunk_page_content(
    description: str | None,
    credits_text: str | None,
    download_notes: str | None,
) -> list[TextChunk]:
    """
    Chunk page content into sections.

    Section types for page_text_chunk.section:
    - description: Main page description
    - credits: Credits and attribution
    - download_notes: Download/usage instructions
    - other: Miscellaneous text
    """
    chunker = TextChunker()

    sections = {
        "description": description or "",
        "credits": credits_text or "",
        "download_notes": download_notes or "",
    }

    return chunker.chunk_sections(sections)


def chunk_asset_content(
    caption: str | None,
    transcript: str | None,
    readme: str | None,
) -> list[TextChunk]:
    """
    Chunk asset content into sections.

    Section types for asset_text_chunk.section:
    - caption: Image/video captions
    - transcript: Video transcripts
    - readme: Data file documentation
    - other: Miscellaneous text
    """
    chunker = TextChunker()

    sections = {
        "caption": caption or "",
        "transcript": transcript or "",
        "readme": readme or "",
    }

    return chunker.chunk_sections(sections)
