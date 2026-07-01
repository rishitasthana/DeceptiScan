"""Tests for /report/* endpoints."""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient
from unittest.mock import AsyncMock, patch

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
async def test_get_pdf_not_found(client):
    """GET /report/pdf/{scan_id} should return 404 for unknown scan_id."""
    with patch("app.routers.report.col_scan_history") as mock_col:
        mock_col.return_value.find_one = AsyncMock(return_value=None)
        response = await client.get("/report/pdf/nonexistent-scan-id")

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_metrics_returns_structure(client):
    """GET /report/metrics should return nlp_metrics and cv_metrics dicts."""
    response = await client.get("/report/metrics")
    assert response.status_code == 200
    body = response.json()
    assert body["status_code"] == 200
    assert "nlp_metrics" in body["data"]
    assert "cv_metrics" in body["data"]


@pytest.mark.asyncio
async def test_get_pdf_success(client):
    """GET /report/pdf/{scan_id} should return PDF bytes for a known scan."""
    from datetime import datetime, UTC

    mock_scan_doc = {
        "scan_id": "test-scan-123",
        "domain": "testbank.com",
        "page_title": "Test Bank Credit Card",
        "risk_score": {"score": 7.5, "nlp_score": 8.0, "cv_score": 6.5, "level": "high"},
        "top_patterns": [],
        "nlp_results": [],
        "cv_results": [],
        "pdf_urls": [],
        "scanned_at": datetime.now(UTC).isoformat(),
    }
    fake_pdf = b"%PDF-1.4 fake pdf content"

    with patch("app.routers.report.col_scan_history") as mock_col:
        mock_col.return_value.find_one = AsyncMock(return_value=mock_scan_doc)
        with patch("app.routers.report.generate_pdf_report", new_callable=AsyncMock, return_value=fake_pdf):
            response = await client.get("/report/pdf/test-scan-123")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
