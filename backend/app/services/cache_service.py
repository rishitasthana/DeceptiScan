"""Redis cache service for scan results and domain lookups."""

from __future__ import annotations

import json
from typing import Any, Optional

import structlog

from app.config import get_settings

logger = structlog.get_logger(__name__)

_redis_client: Any = None


async def init_cache() -> None:
    """Initialize the Redis connection pool."""
    global _redis_client
    try:
        import redis.asyncio as aioredis

        settings = get_settings()
        _redis_client = aioredis.from_url(settings.redis_url, decode_responses=True)
        await _redis_client.ping()
        logger.info("Redis cache connected")
    except Exception as exc:
        logger.warning("Redis unavailable — caching disabled", error=str(exc))
        _redis_client = None


async def close_cache() -> None:
    """Close the Redis connection."""
    global _redis_client
    if _redis_client:
        await _redis_client.close()


async def cache_get(key: str) -> Optional[dict]:
    """Retrieve a JSON-serialized value from cache.

    Args:
        key: Cache key.

    Returns:
        Deserialized dict, or None if not found or cache unavailable.
    """
    if not _redis_client:
        return None
    try:
        value = await _redis_client.get(key)
        return json.loads(value) if value else None
    except Exception as exc:
        logger.warning("Cache get failed", key=key, error=str(exc))
        return None


async def cache_set(key: str, value: dict, ttl_seconds: int = 3600) -> None:
    """Store a JSON-serialized value in cache.

    Args:
        key: Cache key.
        value: Dict to serialize and store.
        ttl_seconds: Time-to-live in seconds (default 1 hour).
    """
    if not _redis_client:
        return
    try:
        await _redis_client.set(key, json.dumps(value, default=str), ex=ttl_seconds)
    except Exception as exc:
        logger.warning("Cache set failed", key=key, error=str(exc))


async def cache_delete(key: str) -> None:
    """Invalidate a cache entry.

    Args:
        key: Cache key to delete.
    """
    if not _redis_client:
        return
    try:
        await _redis_client.delete(key)
    except Exception as exc:
        logger.warning("Cache delete failed", key=key, error=str(exc))


def domain_cache_key(domain: str) -> str:
    """Generate a cache key for a domain's latest scan.

    Args:
        domain: Hostname string.

    Returns:
        Formatted cache key string.
    """
    return f"scan:domain:{domain}"


def scan_cache_key(scan_id: str) -> str:
    """Generate a cache key for a specific scan ID.

    Args:
        scan_id: UUID string of the scan.

    Returns:
        Formatted cache key string.
    """
    return f"scan:id:{scan_id}"
