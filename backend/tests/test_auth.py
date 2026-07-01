"""Tests for /auth/* endpoints."""

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
async def test_register_success(client):
    """POST /auth/register should create user and return token."""
    mock_find_one = AsyncMock(return_value=None)
    mock_insert_one = AsyncMock(return_value=None)

    with patch("app.routers.auth.col_users") as mock_col:
        mock_col.return_value.find_one = mock_find_one
        mock_col.return_value.insert_one = mock_insert_one

        payload = {"email": "newuser@example.com", "password": "securepassword123"}
        response = await client.post("/auth/register", json=payload)

    assert response.status_code == 201
    body = response.json()
    assert body["status_code"] == 201
    assert "access_token" in body["data"]

@pytest.mark.asyncio
async def test_register_duplicate(client):
    """POST /auth/register should reject duplicate email with 400."""
    mock_find_one = AsyncMock(return_value={"email": "existing@example.com"})

    with patch("app.routers.auth.col_users") as mock_col:
        mock_col.return_value.find_one = mock_find_one

        payload = {"email": "existing@example.com", "password": "securepassword123"}
        response = await client.post("/auth/register", json=payload)

    assert response.status_code == 400
    body = response.json()
    assert body["status_code"] == 400
    assert body["error"] == "Email is already registered"

@pytest.mark.asyncio
async def test_login_success(client):
    """POST /auth/login should return token for valid credentials."""
    from app.routers.auth import hash_password
    hashed = hash_password("mypassword")
    mock_find_one = AsyncMock(return_value={"email": "user@example.com", "hashed_password": hashed})

    with patch("app.routers.auth.col_users") as mock_col:
        mock_col.return_value.find_one = mock_find_one

        payload = {"email": "user@example.com", "password": "mypassword"}
        response = await client.post("/auth/login", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["status_code"] == 200
    assert "access_token" in body["data"]

@pytest.mark.asyncio
async def test_login_invalid_password(client):
    """POST /auth/login should return 401 for incorrect password."""
    from app.routers.auth import hash_password
    hashed = hash_password("mypassword")
    mock_find_one = AsyncMock(return_value={"email": "user@example.com", "hashed_password": hashed})

    with patch("app.routers.auth.col_users") as mock_col:
        mock_col.return_value.find_one = mock_find_one

        payload = {"email": "user@example.com", "password": "wrongpassword"}
        response = await client.post("/auth/login", json=payload)

    assert response.status_code == 401
    body = response.json()
    assert body["status_code"] == 401
    assert "Invalid email or password" in body["error"]
