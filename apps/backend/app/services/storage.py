"""MinIO storage service for object storage operations."""

import io
import logging
from typing import TYPE_CHECKING

import httpx
from minio import Minio
from minio.error import S3Error

if TYPE_CHECKING:
    from app.config import Settings

logger = logging.getLogger(__name__)


class MinioStorageService:
    """Service for MinIO object storage operations."""

    def __init__(self, settings: "Settings"):
        """Initialize MinIO client.

        Args:
            settings: Application settings containing MinIO configuration.
        """
        self.client = Minio(
            endpoint=settings.minio_endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=settings.minio_secure,
        )
        self.bucket = settings.minio_bucket

    def ensure_bucket_exists(self) -> None:
        """Create bucket if it doesn't exist."""
        try:
            if not self.client.bucket_exists(self.bucket):
                self.client.make_bucket(self.bucket)
                logger.info(f"Created MinIO bucket: {self.bucket}")
            else:
                logger.debug(f"MinIO bucket already exists: {self.bucket}")
        except S3Error as e:
            logger.error(f"Failed to create/check bucket: {e}")
            raise

    def upload_bytes(
        self,
        data: bytes,
        object_name: str,
        content_type: str = "application/octet-stream",
    ) -> str:
        """Upload bytes directly to MinIO.

        Args:
            data: Bytes to upload.
            object_name: Object path in bucket (e.g., "thumbnails/pages/123/thumbnail.jpg").
            content_type: MIME type of the content.

        Returns:
            The object_name (storage URI) on success.

        Raises:
            S3Error: If upload fails.
        """
        try:
            data_stream = io.BytesIO(data)
            self.client.put_object(
                bucket_name=self.bucket,
                object_name=object_name,
                data=data_stream,
                length=len(data),
                content_type=content_type,
            )
            logger.debug(f"Uploaded object: {object_name} ({len(data)} bytes)")
            return object_name
        except S3Error as e:
            logger.error(f"Failed to upload object {object_name}: {e}")
            raise

    def get_object(self, object_name: str) -> tuple[bytes, str]:
        """Retrieve object data from MinIO.

        Args:
            object_name: Object path in bucket.

        Returns:
            Tuple of (data bytes, content_type).

        Raises:
            S3Error: If object doesn't exist or retrieval fails.
        """
        try:
            response = self.client.get_object(self.bucket, object_name)
            try:
                data = response.read()
                content_type = response.headers.get("Content-Type", "application/octet-stream")
                return data, content_type
            finally:
                response.close()
                response.release_conn()
        except S3Error as e:
            logger.error(f"Failed to get object {object_name}: {e}")
            raise

    def object_exists(self, object_name: str) -> bool:
        """Check if object exists in bucket.

        Args:
            object_name: Object path in bucket.

        Returns:
            True if object exists, False otherwise.
        """
        try:
            self.client.stat_object(self.bucket, object_name)
            return True
        except S3Error as e:
            if e.code == "NoSuchKey":
                return False
            logger.error(f"Error checking object existence {object_name}: {e}")
            raise

    def delete_object(self, object_name: str) -> None:
        """Delete object from bucket.

        Args:
            object_name: Object path in bucket.
        """
        try:
            self.client.remove_object(self.bucket, object_name)
            logger.debug(f"Deleted object: {object_name}")
        except S3Error as e:
            logger.error(f"Failed to delete object {object_name}: {e}")
            raise

    async def upload_from_url(
        self,
        source_url: str,
        object_name: str,
        timeout: float = 30.0,
    ) -> tuple[bool, str | None]:
        """Download content from URL and upload to MinIO.

        Args:
            source_url: URL to download from.
            object_name: Path in MinIO bucket.
            timeout: HTTP request timeout.

        Returns:
            Tuple of (success, content_type on success or error message on failure).
        """
        try:
            async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
                response = await client.get(source_url)
                response.raise_for_status()

                content = response.content
                content_type = response.headers.get("content-type", "application/octet-stream")

                # Upload to MinIO
                self.upload_bytes(content, object_name, content_type)
                logger.debug(f"Uploaded from URL {source_url} to {object_name} ({len(content)} bytes)")
                return True, content_type

        except httpx.HTTPStatusError as e:
            logger.warning(f"HTTP error downloading {source_url}: {e.response.status_code}")
            return False, f"HTTP {e.response.status_code}"
        except httpx.RequestError as e:
            logger.warning(f"Request error downloading {source_url}: {e}")
            return False, str(e)
        except S3Error as e:
            logger.error(f"MinIO error uploading {object_name}: {e}")
            return False, str(e)


# Singleton instance (lazy initialization)
_storage_service: MinioStorageService | None = None


def get_storage_service() -> MinioStorageService:
    """Get or create the singleton storage service instance.

    Returns:
        MinioStorageService instance.
    """
    global _storage_service
    if _storage_service is None:
        from app.config import get_settings

        settings = get_settings()
        _storage_service = MinioStorageService(settings)
    return _storage_service
