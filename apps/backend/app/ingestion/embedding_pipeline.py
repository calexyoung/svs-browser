"""Embedding generation pipeline for text chunks."""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chunk import PageTextChunk, AssetTextChunk
from app.models.embedding import Embedding
from app.services.embedding import get_embedding_service

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)


class EmbeddingPipeline:
    """Pipeline for generating embeddings for text chunks."""

    def __init__(self, session: AsyncSession, batch_size: int = 32):
        self.session = session
        self.batch_size = batch_size
        self.embedding_service = get_embedding_service()

    async def get_chunks_without_embeddings(
        self, chunk_type: str = "page", limit: int | None = None
    ) -> list[tuple[UUID, str]]:
        """Get chunks that don't have current embeddings."""
        if chunk_type == "page":
            ChunkModel = PageTextChunk
        else:
            ChunkModel = AssetTextChunk

        # Find chunks without current embeddings for this model
        subquery = (
            select(Embedding.chunk_id)
            .where(Embedding.chunk_type == chunk_type)
            .where(Embedding.model_name == self.embedding_service.model_name)
            .where(Embedding.is_current == True)
        )

        query = (
            select(ChunkModel.chunk_id, ChunkModel.content)
            .where(~ChunkModel.chunk_id.in_(subquery))
            .order_by(ChunkModel.chunk_id)
        )

        if limit:
            query = query.limit(limit)

        result = await self.session.execute(query)
        return [(row.chunk_id, row.content) for row in result.all()]

    async def count_chunks_without_embeddings(self, chunk_type: str = "page") -> int:
        """Count chunks that need embeddings."""
        if chunk_type == "page":
            ChunkModel = PageTextChunk
        else:
            ChunkModel = AssetTextChunk

        subquery = (
            select(Embedding.chunk_id)
            .where(Embedding.chunk_type == chunk_type)
            .where(Embedding.model_name == self.embedding_service.model_name)
            .where(Embedding.is_current == True)
        )

        query = select(func.count()).select_from(ChunkModel).where(
            ~ChunkModel.chunk_id.in_(subquery)
        )

        result = await self.session.execute(query)
        return result.scalar() or 0

    async def generate_embeddings_for_chunks(
        self,
        chunks: list[tuple[UUID, str]],
        chunk_type: str = "page",
    ) -> int:
        """Generate and store embeddings for a batch of chunks."""
        if not chunks:
            return 0

        chunk_ids = [c[0] for c in chunks]
        texts = [c[1] for c in chunks]

        try:
            # Generate embeddings
            embeddings = await self.embedding_service.batch_generate_embeddings(
                texts, batch_size=self.batch_size
            )

            # Create embedding records
            for chunk_id, embedding_vector in zip(chunk_ids, embeddings):
                embedding = Embedding(
                    chunk_id=chunk_id,
                    chunk_type=chunk_type,
                    model_name=self.embedding_service.model_name,
                    model_version=self.embedding_service.model_version,
                    dims=self.embedding_service.dims,
                    embedding=embedding_vector,
                    is_current=True,
                )
                self.session.add(embedding)

            await self.session.commit()
            return len(chunks)

        except Exception as e:
            logger.error(f"Failed to generate embeddings: {e}")
            await self.session.rollback()
            raise

    async def run(
        self,
        chunk_type: str = "page",
        limit: int | None = None,
        progress_callback: callable | None = None,
    ) -> dict:
        """Run the embedding pipeline for all chunks without embeddings.

        Args:
            chunk_type: 'page' or 'asset'
            limit: Maximum number of chunks to process (None for all)
            progress_callback: Optional callback(processed, total) for progress updates

        Returns:
            Dict with stats: total_processed, elapsed_time, chunks_per_second
        """
        start_time = datetime.now()

        total_to_process = await self.count_chunks_without_embeddings(chunk_type)
        if limit:
            total_to_process = min(total_to_process, limit)

        logger.info(
            f"Starting embedding pipeline for {total_to_process} {chunk_type} chunks "
            f"using model {self.embedding_service.model_name}"
        )

        processed = 0
        batch_num = 0

        while processed < total_to_process:
            batch_limit = min(self.batch_size, total_to_process - processed)
            chunks = await self.get_chunks_without_embeddings(
                chunk_type=chunk_type, limit=batch_limit
            )

            if not chunks:
                break

            count = await self.generate_embeddings_for_chunks(chunks, chunk_type)
            processed += count
            batch_num += 1

            if progress_callback:
                progress_callback(processed, total_to_process)

            if batch_num % 10 == 0:
                elapsed = (datetime.now() - start_time).total_seconds()
                rate = processed / elapsed if elapsed > 0 else 0
                logger.info(
                    f"Progress: {processed}/{total_to_process} chunks "
                    f"({processed/total_to_process*100:.1f}%) - {rate:.1f} chunks/sec"
                )

        elapsed = (datetime.now() - start_time).total_seconds()
        rate = processed / elapsed if elapsed > 0 else 0

        logger.info(
            f"Embedding pipeline complete: {processed} chunks in {elapsed:.1f}s "
            f"({rate:.1f} chunks/sec)"
        )

        return {
            "total_processed": processed,
            "elapsed_seconds": elapsed,
            "chunks_per_second": rate,
            "model_name": self.embedding_service.model_name,
        }


async def run_embedding_pipeline(
    chunk_type: str = "page",
    batch_size: int = 32,
    limit: int | None = None,
) -> dict:
    """Convenience function to run embedding pipeline with a new session."""
    from app.database import async_session_maker

    async with async_session_maker() as session:
        pipeline = EmbeddingPipeline(session, batch_size=batch_size)
        return await pipeline.run(chunk_type=chunk_type, limit=limit)


if __name__ == "__main__":
    # CLI entry point
    import argparse

    parser = argparse.ArgumentParser(description="Generate embeddings for text chunks")
    parser.add_argument(
        "--type",
        choices=["page", "asset", "all"],
        default="all",
        help="Type of chunks to process",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=32,
        help="Batch size for embedding generation",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Maximum number of chunks to process",
    )

    args = parser.parse_args()

    async def main():
        if args.type in ["page", "all"]:
            print("Processing page chunks...")
            result = await run_embedding_pipeline(
                chunk_type="page",
                batch_size=args.batch_size,
                limit=args.limit,
            )
            print(f"Page chunks: {result}")

        if args.type in ["asset", "all"]:
            print("Processing asset chunks...")
            result = await run_embedding_pipeline(
                chunk_type="asset",
                batch_size=args.batch_size,
                limit=args.limit,
            )
            print(f"Asset chunks: {result}")

    asyncio.run(main())
