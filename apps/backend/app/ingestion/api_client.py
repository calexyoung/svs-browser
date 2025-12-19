"""SVS API client for discovering and fetching visualization pages."""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# SVS API endpoints
SVS_API_BASE = "https://svs.gsfc.nasa.gov/api"
SVS_SEARCH_URL = f"{SVS_API_BASE}/search/"
SVS_PAGE_URL = "https://svs.gsfc.nasa.gov"

# Rate limiting defaults
DEFAULT_RATE_LIMIT = 2.0  # requests per second
DEFAULT_MAX_RETRIES = 3
DEFAULT_RETRY_DELAY = 5.0  # seconds


@dataclass
class SvsSearchResult:
    """Individual search result from SVS API."""

    id: int
    url: str
    title: str
    description: str | None
    release_date: str | None
    result_type: str


@dataclass
class SvsSearchResponse:
    """Response from SVS search API."""

    count: int
    results: list[SvsSearchResult]
    next_url: str | None
    previous_url: str | None


class RateLimiter:
    """Simple rate limiter for API requests."""

    def __init__(self, requests_per_second: float = DEFAULT_RATE_LIMIT):
        self.min_interval = 1.0 / requests_per_second
        self.last_request_time: float = 0

    async def wait(self) -> None:
        """Wait if needed to respect rate limit."""
        now = asyncio.get_event_loop().time()
        elapsed = now - self.last_request_time
        if elapsed < self.min_interval:
            await asyncio.sleep(self.min_interval - elapsed)
        self.last_request_time = asyncio.get_event_loop().time()


class SvsApiClient:
    """Client for interacting with SVS API."""

    def __init__(
        self,
        rate_limit: float = DEFAULT_RATE_LIMIT,
        max_retries: int = DEFAULT_MAX_RETRIES,
        retry_delay: float = DEFAULT_RETRY_DELAY,
        timeout: float = 30.0,
    ):
        self.rate_limiter = RateLimiter(rate_limit)
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.timeout = timeout
        self._client: httpx.AsyncClient | None = None

    async def __aenter__(self) -> SvsApiClient:
        """Enter async context manager."""
        self._client = httpx.AsyncClient(
            timeout=self.timeout,
            headers={
                "User-Agent": "SVS-Browser/1.0 (NASA SVS Knowledge Browser; research project)",
                "Accept": "application/json",
            },
        )
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        """Exit async context manager."""
        if self._client:
            await self._client.aclose()
            self._client = None

    async def _request(
        self,
        method: str,
        url: str,
        **kwargs,
    ) -> httpx.Response:
        """Make an HTTP request with rate limiting and retries."""
        if not self._client:
            raise RuntimeError("Client not initialized. Use async context manager.")

        last_error: Exception | None = None

        for attempt in range(self.max_retries):
            try:
                await self.rate_limiter.wait()
                response = await self._client.request(method, url, **kwargs)
                response.raise_for_status()
                return response

            except httpx.HTTPStatusError as e:
                last_error = e
                if e.response.status_code in (429, 500, 502, 503, 504):
                    # Retry on rate limit or server errors
                    wait_time = self.retry_delay * (2**attempt)
                    logger.warning(
                        f"HTTP {e.response.status_code} on attempt {attempt + 1}, retrying in {wait_time}s: {url}"
                    )
                    await asyncio.sleep(wait_time)
                else:
                    raise

            except httpx.RequestError as e:
                last_error = e
                wait_time = self.retry_delay * (2**attempt)
                logger.warning(f"Request error on attempt {attempt + 1}, retrying in {wait_time}s: {e}")
                await asyncio.sleep(wait_time)

        raise last_error or RuntimeError("Request failed after retries")

    async def search(
        self,
        query: str | None = None,
        missions: list[str] | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> SvsSearchResponse:
        """
        Search SVS pages using the API.

        Args:
            query: Search query string
            missions: Filter by mission names
            limit: Max results per page (API max ~2000)
            offset: Pagination offset

        Returns:
            SvsSearchResponse with results and pagination info
        """
        params: dict[str, Any] = {
            "limit": min(limit, 2000),
            "offset": offset,
        }
        if query:
            params["search"] = query
        if missions:
            params["missions"] = ",".join(missions)

        response = await self._request("GET", SVS_SEARCH_URL, params=params)
        data = response.json()

        results = [
            SvsSearchResult(
                id=item["id"],
                url=item.get("url", f"{SVS_PAGE_URL}/{item['id']}"),
                title=item.get("title", ""),
                description=item.get("description"),
                release_date=item.get("release_date"),
                result_type=item.get("result_type", "visualization"),
            )
            for item in data.get("results", [])
        ]

        return SvsSearchResponse(
            count=data.get("count", len(results)),
            results=results,
            next_url=data.get("next"),
            previous_url=data.get("previous"),
        )

    async def discover_all_pages(
        self,
        batch_size: int = 500,
        progress_callback: callable | None = None,
    ) -> list[SvsSearchResult]:
        """
        Discover all SVS pages using the search API.

        Args:
            batch_size: Number of results to fetch per request
            progress_callback: Optional callback(current, total) for progress

        Returns:
            List of all discovered SVS pages
        """
        all_results: list[SvsSearchResult] = []
        offset = 0

        # Initial request to get total count
        first_response = await self.search(limit=batch_size, offset=0)
        total_count = first_response.count
        all_results.extend(first_response.results)

        logger.info(f"Discovered {total_count} total SVS pages")

        if progress_callback:
            progress_callback(len(all_results), total_count)

        # Fetch remaining pages
        offset = batch_size
        while offset < total_count:
            response = await self.search(limit=batch_size, offset=offset)
            all_results.extend(response.results)
            offset += batch_size

            if progress_callback:
                progress_callback(len(all_results), total_count)

            logger.debug(f"Fetched {len(all_results)}/{total_count} pages")

        return all_results

    async def fetch_page_html(self, svs_id: int) -> str:
        """
        Fetch the HTML content of an SVS page.

        Args:
            svs_id: SVS page ID

        Returns:
            Raw HTML content
        """
        url = f"{SVS_PAGE_URL}/{svs_id}"
        response = await self._request("GET", url)
        return response.text

    async def check_page_exists(self, svs_id: int) -> bool:
        """
        Check if an SVS page exists.

        Args:
            svs_id: SVS page ID

        Returns:
            True if page exists, False otherwise
        """
        url = f"{SVS_PAGE_URL}/{svs_id}"
        try:
            response = await self._request("HEAD", url)
            return response.status_code == 200
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return False
            raise
