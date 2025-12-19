"""Thumbnail caching service for downloading and storing thumbnails in MinIO."""

import logging
import mimetypes
from pathlib import Path
from urllib.parse import urlparse

import httpx
from minio.error import S3Error

from app.services.storage import MinioStorageService

logger = logging.getLogger(__name__)

# Common image extensions and their MIME types
IMAGE_EXTENSIONS = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
}

# Default timeout for thumbnail downloads (seconds)
DOWNLOAD_TIMEOUT = 30.0

# Maximum thumbnail file size (10 MB)
MAX_THUMBNAIL_SIZE = 10 * 1024 * 1024


class ThumbnailService:
    """Service for downloading and caching thumbnails in MinIO."""

    def __init__(
        self,
        storage: MinioStorageService,
        http_client: httpx.AsyncClient | None = None,
    ):
        """Initialize thumbnail service.

        Args:
            storage: MinIO storage service instance.
            http_client: Optional async HTTP client. If not provided, one will be created.
        """
        self.storage = storage
        self._http_client = http_client
        self._owns_client = http_client is None

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._http_client is None:
            self._http_client = httpx.AsyncClient(
                timeout=DOWNLOAD_TIMEOUT,
                follow_redirects=True,
                headers={
                    "User-Agent": "SVS-Browser/1.0 (NASA SVS Knowledge Browser; thumbnail cache)",
                },
            )
        return self._http_client

    async def close(self) -> None:
        """Close HTTP client if owned by this service."""
        if self._owns_client and self._http_client is not None:
            await self._http_client.aclose()
            self._http_client = None

    def _get_extension_from_url(self, url: str) -> str:
        """Extract file extension from URL.

        Args:
            url: The URL to parse.

        Returns:
            File extension including dot (e.g., ".jpg"), or ".jpg" as default.
        """
        parsed = urlparse(url)
        path = Path(parsed.path)
        ext = path.suffix.lower()
        if ext in IMAGE_EXTENSIONS:
            return ext
        return ".jpg"  # Default to jpg

    def _get_content_type(self, ext: str, response_content_type: str | None) -> str:
        """Determine content type from extension or response header.

        Args:
            ext: File extension.
            response_content_type: Content-Type header from response.

        Returns:
            MIME type string.
        """
        # Prefer extension-based type if valid
        if ext in IMAGE_EXTENSIONS:
            return IMAGE_EXTENSIONS[ext]
        # Fall back to response header
        if response_content_type and response_content_type.startswith("image/"):
            return response_content_type.split(";")[0].strip()
        return "image/jpeg"  # Default

    def _build_storage_path(self, svs_id: int, ext: str) -> str:
        """Build storage path for a page thumbnail.

        Args:
            svs_id: SVS page ID.
            ext: File extension including dot.

        Returns:
            Storage path (e.g., "thumbnails/pages/12345/thumbnail.jpg").
        """
        return f"thumbnails/pages/{svs_id}/thumbnail{ext}"

    async def cache_page_thumbnail(
        self,
        svs_id: int,
        thumbnail_url: str,
    ) -> str | None:
        """Download and cache a page thumbnail.

        Args:
            svs_id: SVS page ID.
            thumbnail_url: URL of the thumbnail to download.

        Returns:
            storage_uri if successful, None on failure.
        """
        try:
            client = await self._get_client()

            # Download thumbnail
            logger.debug(f"Downloading thumbnail for page {svs_id}: {thumbnail_url}")
            response = await client.get(thumbnail_url)
            response.raise_for_status()

            # Check size
            data = response.content
            if len(data) > MAX_THUMBNAIL_SIZE:
                logger.warning(
                    f"Thumbnail too large for page {svs_id}: {len(data)} bytes"
                )
                return None

            if len(data) == 0:
                logger.warning(f"Empty thumbnail response for page {svs_id}")
                return None

            # Determine extension and content type
            ext = self._get_extension_from_url(thumbnail_url)
            content_type = self._get_content_type(
                ext, response.headers.get("content-type")
            )

            # Build storage path and upload
            storage_path = self._build_storage_path(svs_id, ext)
            self.storage.upload_bytes(data, storage_path, content_type)

            logger.info(
                f"Cached thumbnail for page {svs_id}: {storage_path} ({len(data)} bytes)"
            )
            return storage_path

        except httpx.HTTPStatusError as e:
            logger.warning(
                f"HTTP error downloading thumbnail for page {svs_id}: {e.response.status_code}"
            )
            return None
        except httpx.RequestError as e:
            logger.warning(f"Request error downloading thumbnail for page {svs_id}: {e}")
            return None
        except S3Error as e:
            logger.error(f"Storage error caching thumbnail for page {svs_id}: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error caching thumbnail for page {svs_id}: {e}")
            return None

    def get_thumbnail_data(self, storage_uri: str) -> tuple[bytes, str] | None:
        """Get cached thumbnail data from storage.

        Args:
            storage_uri: Storage path of the thumbnail.

        Returns:
            Tuple of (data bytes, content_type) or None if not found.
        """
        try:
            return self.storage.get_object(storage_uri)
        except S3Error as e:
            if e.code == "NoSuchKey":
                logger.debug(f"Thumbnail not found in storage: {storage_uri}")
                return None
            logger.error(f"Error retrieving thumbnail {storage_uri}: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error retrieving thumbnail {storage_uri}: {e}")
            return None

    def thumbnail_exists(self, storage_uri: str) -> bool:
        """Check if thumbnail exists in storage.

        Args:
            storage_uri: Storage path of the thumbnail.

        Returns:
            True if exists, False otherwise.
        """
        return self.storage.object_exists(storage_uri)
