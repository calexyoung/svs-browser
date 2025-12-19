"""Tests for search endpoints."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_search_requires_query(client: AsyncClient):
    """Test that search requires a query parameter."""
    response = await client.get("/api/v1/search")
    assert response.status_code == 422  # Validation error


@pytest.mark.asyncio
async def test_search_with_query(client: AsyncClient):
    """Test search with a query parameter."""
    response = await client.get("/api/v1/search", params={"q": "mars"})
    assert response.status_code == 200
    data = response.json()
    assert "count" in data
    assert "results" in data
    assert "facets" in data
    assert isinstance(data["results"], list)


@pytest.mark.asyncio
async def test_search_pagination(client: AsyncClient):
    """Test search pagination parameters."""
    response = await client.get(
        "/api/v1/search",
        params={"q": "test", "limit": 10, "offset": 0},
    )
    assert response.status_code == 200
    data = response.json()
    assert "count" in data


@pytest.mark.asyncio
async def test_search_invalid_limit(client: AsyncClient):
    """Test search with invalid limit."""
    response = await client.get(
        "/api/v1/search",
        params={"q": "test", "limit": 1000},  # Max is 100
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_search_sort_options(client: AsyncClient):
    """Test search sort options."""
    for sort in ["relevance", "date_desc", "date_asc"]:
        response = await client.get(
            "/api/v1/search",
            params={"q": "test", "sort": sort},
        )
        assert response.status_code == 200
