"""Embedding service supporting local (sentence-transformers) and OpenAI backends."""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

from app.config import get_settings

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)


class BaseEmbeddingService(ABC):
    """Abstract base class for embedding services."""

    @abstractmethod
    async def generate_embedding(self, text: str) -> list[float]:
        """Generate embedding for a single text."""
        pass

    @abstractmethod
    async def batch_generate_embeddings(self, texts: list[str], batch_size: int = 32) -> list[list[float]]:
        """Generate embeddings for multiple texts in batches."""
        pass

    @property
    @abstractmethod
    def model_name(self) -> str:
        """Return the model name."""
        pass

    @property
    @abstractmethod
    def model_version(self) -> str:
        """Return the model version."""
        pass

    @property
    @abstractmethod
    def dims(self) -> int:
        """Return the embedding dimensions."""
        pass


class LocalEmbeddingService(BaseEmbeddingService):
    """Embedding service using local sentence-transformers models."""

    def __init__(self):
        settings = get_settings()
        self._model_name = settings.embedding_model
        self._dims = settings.embedding_dims
        self._model = None

    def _load_model(self):
        """Lazy load the model."""
        if self._model is None:
            logger.info(f"Loading embedding model: {self._model_name}")
            from sentence_transformers import SentenceTransformer

            self._model = SentenceTransformer(self._model_name)
            logger.info(f"Model loaded. Dimensions: {self._model.get_sentence_embedding_dimension()}")

    @property
    def model_name(self) -> str:
        return self._model_name

    @property
    def model_version(self) -> str:
        return "1.0"  # sentence-transformers doesn't expose version easily

    @property
    def dims(self) -> int:
        return self._dims

    async def generate_embedding(self, text: str) -> list[float]:
        """Generate embedding for a single text."""
        self._load_model()

        if not text.strip():
            return [0.0] * self._dims

        try:
            # sentence-transformers is synchronous, but fast enough for single texts
            embedding = self._model.encode(text, normalize_embeddings=True)
            return embedding.tolist()
        except Exception as e:
            logger.error(f"Failed to generate embedding: {e}")
            raise

    async def batch_generate_embeddings(self, texts: list[str], batch_size: int = 32) -> list[list[float]]:
        """Generate embeddings for multiple texts in batches."""
        self._load_model()

        # Replace empty texts with a space
        texts = [t if t.strip() else " " for t in texts]

        try:
            # sentence-transformers handles batching internally
            embeddings = self._model.encode(
                texts,
                batch_size=batch_size,
                normalize_embeddings=True,
                show_progress_bar=len(texts) > 100,
            )
            return embeddings.tolist()
        except Exception as e:
            logger.error(f"Failed to generate batch embeddings: {e}")
            raise


class OpenAIEmbeddingService(BaseEmbeddingService):
    """Embedding service using OpenAI API."""

    def __init__(self):
        settings = get_settings()
        from openai import AsyncOpenAI

        self.client = AsyncOpenAI(api_key=settings.openai_api_key)
        self._model_name = settings.embedding_model
        self._dims = settings.embedding_dims

    @property
    def model_name(self) -> str:
        return self._model_name

    @property
    def model_version(self) -> str:
        return "1.0"

    @property
    def dims(self) -> int:
        return self._dims

    async def generate_embedding(self, text: str) -> list[float]:
        """Generate embedding for a single text."""
        if not text.strip():
            return [0.0] * self._dims

        try:
            response = await self.client.embeddings.create(
                model=self._model_name,
                input=text,
                dimensions=self._dims,
            )
            return response.data[0].embedding
        except Exception as e:
            logger.error(f"Failed to generate embedding: {e}")
            raise

    async def batch_generate_embeddings(self, texts: list[str], batch_size: int = 100) -> list[list[float]]:
        """Generate embeddings for multiple texts in batches."""
        all_embeddings = []

        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            # Filter empty texts
            batch = [t if t.strip() else " " for t in batch]

            try:
                response = await self.client.embeddings.create(
                    model=self._model_name,
                    input=batch,
                    dimensions=self._dims,
                )
                batch_embeddings = [item.embedding for item in response.data]
                all_embeddings.extend(batch_embeddings)
            except Exception as e:
                logger.error(f"Failed to generate batch embeddings: {e}")
                raise

        return all_embeddings


# Singleton instance
_embedding_service: BaseEmbeddingService | None = None


def get_embedding_service() -> BaseEmbeddingService:
    """Get the embedding service singleton based on config."""
    global _embedding_service
    if _embedding_service is None:
        settings = get_settings()
        if settings.embedding_backend == "local":
            _embedding_service = LocalEmbeddingService()
        elif settings.embedding_backend == "openai":
            _embedding_service = OpenAIEmbeddingService()
        else:
            raise ValueError(f"Unknown embedding backend: {settings.embedding_backend}")
        logger.info(f"Initialized embedding service: {settings.embedding_backend}")
    return _embedding_service


def preload_embedding_model() -> bool:
    """
    Preload the embedding model on startup.

    This avoids cold-start latency on the first embedding request.
    Only applicable for local embedding backend.
    """
    settings = get_settings()
    if settings.embedding_backend != "local":
        logger.info(f"Skipping embedding preload for backend: {settings.embedding_backend}")
        return True

    try:
        service = get_embedding_service()
        if isinstance(service, LocalEmbeddingService):
            service._load_model()
            logger.info("Embedding model preloaded successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to preload embedding model: {e}")
        return False
