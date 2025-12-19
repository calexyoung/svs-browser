"""Tests for health check endpoints."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_endpoint(client: AsyncClient):
    """Test that health endpoint returns 200."""
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


@pytest.mark.asyncio
async def test_ready_endpoint(client: AsyncClient):
    """Test that ready endpoint returns 200."""
    response = await client.get("/ready")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
