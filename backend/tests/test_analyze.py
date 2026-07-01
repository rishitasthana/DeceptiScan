"""Tests for /analyze/* endpoints."""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
async def client():
    """Async test client for the FastAPI app."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_analyze_text_success(client):
    """POST /analyze/text should return labeled clauses for valid input."""
    payload = {
        "text": (
            "This service auto-renews annually. Cancel within 30 days to avoid charges. "
            "Fees may apply. Limited time offer — act now!"
        ),
        "domain": "test.com",
    }
    response = await client.post("/analyze/text", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["status_code"] == 200
    assert isinstance(body["data"], list)
    assert len(body["data"]) > 0
    first = body["data"][0]
    assert "text" in first
    assert "labels" in first
    assert "severity" in first


@pytest.mark.asyncio
async def test_analyze_text_short_input_rejected(client):
    """POST /analyze/text should reject text shorter than 10 characters."""
    response = await client.post("/analyze/text", json={"text": "hi"})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_analyze_screenshot_success(client):
    """POST /analyze/screenshot should return UI patterns for a valid base64 image."""
    import base64
    from PIL import Image
    import io

    # Create a minimal 50x50 PNG
    img = Image.new("RGB", (50, 50), color=(200, 100, 50))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode()

    response = await client.post("/analyze/screenshot", json={"screenshot_b64": b64, "domain": "test.com"})
    assert response.status_code == 200
    body = response.json()
    assert body["status_code"] == 200
    assert isinstance(body["data"], list)
    assert len(body["data"]) > 0


@pytest.mark.asyncio
async def test_analyze_full_no_screenshot(client):
    """POST /analyze/full without screenshot should still return a valid ScanResult."""
    payload = {
        "text": "Auto-renewal applies. Fees buried in section 12b. Act now for a limited time offer.",
        "domain": "example-bank.com",
        "page_title": "Example Bank Credit Card",
    }
    response = await client.post("/analyze/full", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["status_code"] == 200
    data = body["data"]
    assert "scan_id" in data
    assert "risk_score" in data
    assert 1.0 <= data["risk_score"]["score"] <= 10.0
    assert data["risk_score"]["level"] in ("low", "medium", "high", "critical")


@pytest.mark.asyncio
async def test_rag_ask(client):
    """GET /rag/ask should return a list of similar clauses."""
    response = await client.get("/rag/ask", params={"q": "hidden fees", "top_k": 3})
    print("DEBUG RESPONSE:", response.json())
    assert response.status_code == 200
    body = response.json()
    assert body["status_code"] == 200
    assert isinstance(body["data"], list)
