"""FastAPI application entry point."""

from __future__ import annotations

from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import close_db, connect_db
from app.pinecone_client import init_vector_store
from app.routers.analyze import rag_router, router as analyze_router
from app.routers.auth import router as auth_router
from app.routers.community import router as community_router
from app.routers.products import router as products_router
from app.routers.report import router as report_router
from app.services.cache_service import close_cache, init_cache

logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application startup and shutdown lifecycle."""
    settings = get_settings()

    # ── Startup ───────────────────────────────────────────────────────────
    logger.info("Starting Dark Pattern Detector API", env=settings.app_env)

    await connect_db()
    await init_cache()
    await init_vector_store()

    logger.info("All services initialized — API ready")
    yield

    # ── Shutdown ──────────────────────────────────────────────────────────
    await close_db()
    await close_cache()
    logger.info("API shutdown complete")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    settings = get_settings()

    app = FastAPI(
        title="Dark Pattern Detector API",
        description=(
            "Detects manipulative dark patterns in financial product websites "
            "using NLP (Legal-BERT) and computer vision (ResNet-50) models."
        ),
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # ── CORS ──────────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_origin_regex="chrome-extension://.*",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Routers ───────────────────────────────────────────────────────────
    app.include_router(auth_router)
    app.include_router(analyze_router)
    app.include_router(rag_router)
    app.include_router(products_router)
    app.include_router(community_router)
    app.include_router(report_router)

    @app.get("/health", tags=["Health"])
    async def health_check() -> dict:
        """Return API health status."""
        return {"data": {"status": "ok", "version": "1.0.0"}, "error": None, "status_code": 200}

    return app


app = create_app()
