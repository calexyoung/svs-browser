"""Tests for SVS page endpoints."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SvsPage


@pytest.mark.asyncio
async def test_get_page_not_found(client: AsyncClient):
    """Test getting a non-existent page returns 404."""
    response = await client.get("/api/v1/svs/99999")
    assert response.status_code == 404
    data = response.json()
    assert data["detail"]["code"] == "PAGE_NOT_FOUND"


@pytest.mark.asyncio
async def test_get_page_invalid_id(client: AsyncClient):
    """Test getting a page with invalid ID."""
    response = await client.get("/api/v1/svs/0")
    assert response.status_code == 422  # Validation error (ge=1)


@pytest.mark.asyncio
async def test_get_page_exists(client: AsyncClient, db_session: AsyncSession):
    """Test getting an existing page."""
    # Create a test page
    page = SvsPage(
        svs_id=12345,
        title="Test Visualization",
        canonical_url="https://svs.gsfc.nasa.gov/12345",
        description="A test visualization for unit testing.",
    )
    db_session.add(page)
    await db_session.commit()

    response = await client.get("/api/v1/svs/12345")
    assert response.status_code == 200
    data = response.json()
    assert data["svs_id"] == 12345
    assert data["title"] == "Test Visualization"
    assert "assets" in data
    assert "tags" in data
    assert "related_pages" in data


@pytest.mark.asyncio
async def test_list_pages(client: AsyncClient):
    """Test listing pages with pagination."""
    response = await client.get("/api/v1/pages")
    assert response.status_code == 200
    data = response.json()
    assert "count" in data
    assert "results" in data
    assert isinstance(data["results"], list)


@pytest.mark.asyncio
async def test_list_pages_pagination(client: AsyncClient):
    """Test page list pagination."""
    response = await client.get(
        "/api/v1/pages",
        params={"limit": 5, "offset": 0},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["results"]) <= 5
