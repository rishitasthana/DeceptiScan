"""Celery background tasks for asynchronous scan processing."""

from __future__ import annotations

import asyncio

import structlog

from app.celery_app import celery_app

logger = structlog.get_logger(__name__)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def async_full_scan(self, domain: str, text: str, screenshot_b64: str | None = None) -> dict:
    """Celery task to run a full dark pattern scan asynchronously.

    Useful for processing scans initiated from webhook callbacks or batch jobs
    without blocking the HTTP request/response cycle.

    Args:
        domain: The website domain to scan.
        text: Raw T&C text extracted from the page.
        screenshot_b64: Optional base64-encoded screenshot.

    Returns:
        Dict with scan_id and risk score on success.
    """
    try:
        logger.info("Starting async full scan", domain=domain)

        from app.models.scan import FullAnalysisRequest
        from app.routers.analyze import analyze_full

        request = FullAnalysisRequest(
            text=text,
            screenshot_b64=screenshot_b64,
            domain=domain,
        )

        # Run async code in a new event loop from the Celery worker thread
        loop = asyncio.new_event_loop()
        response = loop.run_until_complete(analyze_full(request, background_tasks=_NullBackgroundTasks()))
        loop.close()

        if response.data:
            logger.info("Async scan complete", scan_id=response.data.scan_id, risk=response.data.risk_score.score)
            return {"scan_id": response.data.scan_id, "risk_score": response.data.risk_score.score}
        return {"error": "No result returned"}

    except Exception as exc:
        logger.error("Async scan failed", domain=domain, error=str(exc))
        raise self.retry(exc=exc)


class _NullBackgroundTasks:
    """No-op background tasks stub for Celery context (no ASGI event loop)."""

    def add_task(self, func, *args, **kwargs) -> None:
        """Run the background function immediately instead of deferring it."""
        loop = asyncio.new_event_loop()
        try:
            loop.run_until_complete(func(*args, **kwargs))
        except Exception as exc:
            logger.warning("Background task failed in Celery context", error=str(exc))
        finally:
            loop.close()
