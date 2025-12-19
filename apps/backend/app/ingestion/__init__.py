"""Ingestion module for SVS data."""

from app.ingestion.api_client import SvsApiClient
from app.ingestion.html_parser import SvsHtmlParser
from app.ingestion.chunker import TextChunker
from app.ingestion.pipeline import IngestionPipeline

__all__ = [
    "SvsApiClient",
    "SvsHtmlParser",
    "TextChunker",
    "IngestionPipeline",
]
