"""Tests for /community/* endpoints."""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient
from unittest.mock import AsyncMock, patch, MagicMock

from app.main import app


@pytest.fixture
async def client():
    """Async test client for the FastAPI app."""
    from app.routers.auth import verify_token
    app.dependency_overrides[verify_token] = lambda: {"sub": "test@example.com"}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_submit_report_success(client):
    """POST /community/report should create and return a report."""
    mock_result = MagicMock()
    mock_result.inserted_id = "507f1f77bcf86cd799439011"

    with patch("app.routers.community.col_community_reports") as mock_col:
        mock_col.return_value.insert_one = AsyncMock(return_value=mock_result)

        payload = {
            "domain": "badbank.com",
            "pattern_type": "auto_renewal_trap",
            "description": "The bank auto-renewed my card without any prior notice.",
            "url": "https://badbank.com/credit-cards/terms",
        }
        response = await client.post("/community/report", json=payload)

    assert response.status_code == 201
    body = response.json()
    assert body["status_code"] == 201
    assert body["data"]["domain"] == "badbank.com"
    assert body["data"]["status"] == "pending"


@pytest.mark.asyncio
async def test_submit_report_missing_description(client):
    """POST /community/report should reject reports with short descriptions."""
    response = await client.post("/community/report", json={
        "domain": "bank.com",
        "pattern_type": "fee_burial",
        "description": "bad",
    })
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_list_reports_requires_admin_key(client):
    """GET /community/reports should return 403 without admin key."""
    response = await client.get("/community/reports")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_list_reports_with_admin_key(client):
    """GET /community/reports should return data with valid admin key."""
    from app.config import get_settings
    key = get_settings().admin_api_key

    mock_cursor = MagicMock()
    mock_cursor.to_list = AsyncMock(return_value=[])

    with patch("app.routers.community.col_community_reports") as mock_col:
        mock_col.return_value.find.return_value.skip.return_value.limit.return_value = mock_cursor
        mock_col.return_value.count_documents = AsyncMock(return_value=0)

        response = await client.get("/community/reports", headers={"X-API-Key": key})

    assert response.status_code == 200
    body = response.json()
    assert body["status_code"] == 200
    assert isinstance(body["data"], list)
