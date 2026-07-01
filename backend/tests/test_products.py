"""Tests for /products/* endpoints."""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient
from unittest.mock import AsyncMock, patch, MagicMock

from app.main import app


@pytest.fixture
async def client():
    """Async test client for the FastAPI app."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_list_products_empty(client):
    """GET /products should return empty list when no scans exist."""
    mock_cursor = MagicMock()
    mock_cursor.to_list = AsyncMock(return_value=[])

    with patch("app.routers.products.col_scan_history") as mock_col:
        mock_col.return_value.aggregate.return_value = mock_cursor
        response = await client.get("/products")

    assert response.status_code == 200
    body = response.json()
    assert body["status_code"] == 200
    assert isinstance(body["data"], list)


@pytest.mark.asyncio
async def test_get_product_scans_not_found(client):
    """GET /products/{domain} should return 404 for unknown domain."""
    mock_cursor = MagicMock()
    mock_cursor.to_list = AsyncMock(return_value=[])

    with patch("app.routers.products.col_scan_history") as mock_col:
        mock_col.return_value.find.return_value.skip.return_value.limit.return_value = mock_cursor
        mock_col.return_value.count_documents = AsyncMock(return_value=0)

        with patch("app.routers.products.cache_service.cache_get", new_callable=AsyncMock, return_value=None):
            response = await client.get("/products/unknown-domain.com")

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_list_products_pagination(client):
    """GET /products should respect page and page_size query params."""
    mock_cursor = MagicMock()
    mock_cursor.to_list = AsyncMock(return_value=[])

    with patch("app.routers.products.col_scan_history") as mock_col:
        mock_col.return_value.aggregate.return_value = mock_cursor
        response = await client.get("/products?page=2&page_size=5")

    assert response.status_code == 200
