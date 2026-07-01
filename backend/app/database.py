"""MongoDB Motor async client and collection accessors."""

from typing import Optional

import structlog
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.config import get_settings

logger = structlog.get_logger(__name__)

_client: Optional[AsyncIOMotorClient] = None
_db: Optional[AsyncIOMotorDatabase] = None


async def connect_db() -> None:
    """Initialize the MongoDB Motor client and verify connectivity."""
    global _client, _db
    settings = get_settings()
    _client = AsyncIOMotorClient(settings.mongo_uri)
    _db = _client[settings.mongo_db]
    # Ping to confirm connection
    await _client.admin.command("ping")
    logger.info("MongoDB connected", db=settings.mongo_db)


async def close_db() -> None:
    """Close the MongoDB Motor client connection."""
    global _client
    if _client:
        _client.close()
        logger.info("MongoDB connection closed")


def get_db() -> AsyncIOMotorDatabase:
    """Return the active database instance."""
    if _db is None:
        raise RuntimeError("Database not initialized. Call connect_db() first.")
    return _db


# ── Collection helpers ────────────────────────────────────────────────────────

def col_products():
    """Return the 'products' collection."""
    return get_db()["products"]


def col_flags():
    """Return the 'flags' collection."""
    return get_db()["flags"]


def col_community_reports():
    """Return the 'community_reports' collection."""
    return get_db()["community_reports"]


def col_users():
    """Return the 'users' collection."""
    return get_db()["users"]


def col_scan_history():
    """Return the 'scan_history' collection."""
    return get_db()["scan_history"]
