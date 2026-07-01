"""Celery application instance."""

from celery import Celery

from app.config import get_settings


def create_celery_app() -> Celery:
    """Create and configure the Celery application."""
    settings = get_settings()
    celery_app = Celery(
        "darkpattern",
        broker=settings.redis_url,
        backend=settings.redis_url,
        include=["app.tasks.scan_tasks"],
    )
    celery_app.conf.update(
        task_serializer="json",
        accept_content=["json"],
        result_serializer="json",
        timezone="UTC",
        enable_utc=True,
        task_track_started=True,
        task_acks_late=True,
        worker_prefetch_multiplier=1,
    )
    return celery_app


celery_app = create_celery_app()
