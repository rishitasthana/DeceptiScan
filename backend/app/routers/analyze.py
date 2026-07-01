"""Analysis router: /analyze/text, /analyze/screenshot, /analyze/full, /rag/ask."""

from __future__ import annotations

import uuid
from datetime import datetime, UTC
from typing import Optional

import structlog
from fastapi import APIRouter, BackgroundTasks, HTTPException

from app.database import col_scan_history
from app.models.scan import (
    FullAnalysisRequest,
    FullAnalysisResponse,
    ScanResult,
    ScreenshotAnalysisRequest,
    ScreenshotAnalysisResponse,
    TextAnalysisRequest,
    TextAnalysisResponse,
)
from app.services import cache_service, rag_service
from app.services.cv_service import get_cv_predictor
from app.services.fusion_service import fuse_results, get_top_patterns
from app.services.nlp_service import get_nlp_predictor

router = APIRouter(prefix="/analyze", tags=["Analysis"])
logger = structlog.get_logger(__name__)


@router.post("/text", response_model=TextAnalysisResponse)
async def analyze_text(request: TextAnalysisRequest) -> TextAnalysisResponse:
    """Run the NLP classifier on raw T&C text and return labeled clauses.

    Args:
        request: TextAnalysisRequest with the raw text.

    Returns:
        TextAnalysisResponse containing a list of LabeledClause objects.
    """
    try:
        predictor = get_nlp_predictor()
        clauses = predictor.classify_clauses(request.text)
        logger.info("Text analysis complete", clauses=len(clauses), domain=request.domain)
        return TextAnalysisResponse(data=clauses, status_code=200)
    except Exception as exc:
        logger.error("Text analysis failed", error=str(exc))
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/screenshot", response_model=ScreenshotAnalysisResponse)
async def analyze_screenshot(request: ScreenshotAnalysisRequest) -> ScreenshotAnalysisResponse:
    """Run the CV classifier on a base64-encoded screenshot.

    Args:
        request: ScreenshotAnalysisRequest with the base64 image.

    Returns:
        ScreenshotAnalysisResponse containing a list of UIPattern objects.
    """
    try:
        predictor = get_cv_predictor()
        patterns = predictor.classify_screenshot(request.screenshot_b64)
        logger.info("Screenshot analysis complete", patterns=len(patterns), domain=request.domain)
        return ScreenshotAnalysisResponse(data=patterns, status_code=200)
    except Exception as exc:
        logger.error("Screenshot analysis failed", error=str(exc))
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/full", response_model=FullAnalysisResponse)
async def analyze_full(
    request: FullAnalysisRequest,
    background_tasks: BackgroundTasks,
) -> FullAnalysisResponse:
    """Run NLP + CV analysis, fuse results, persist to MongoDB, and return ScanResult.

    Args:
        request: FullAnalysisRequest with text, optional screenshot, and domain.
        background_tasks: FastAPI background task queue.

    Returns:
        FullAnalysisResponse with the complete ScanResult.
    """
    try:
        domain = request.domain or "unknown"
        scan_id = str(uuid.uuid4())

        # ── NLP analysis ──────────────────────────────────────────────────
        nlp_predictor = get_nlp_predictor()
        nlp_results = nlp_predictor.classify_clauses(request.text)

        # ── CV analysis (if screenshot provided) ──────────────────────────
        cv_results = []
        if request.screenshot_b64:
            cv_predictor = get_cv_predictor()
            cv_results = cv_predictor.classify_screenshot(request.screenshot_b64)

        # ── Fusion ────────────────────────────────────────────────────────
        risk_score = fuse_results(nlp_results, cv_results)
        top_patterns = get_top_patterns(nlp_results, cv_results, top_k=3)

        scan = ScanResult(
            scan_id=scan_id,
            domain=domain,
            page_title=request.page_title,
            risk_score=risk_score,
            top_patterns=top_patterns,
            nlp_results=nlp_results,
            cv_results=cv_results,
            pdf_urls=request.pdf_urls,
            scanned_at=datetime.now(UTC),
        )

        # ── Persist (background) ──────────────────────────────────────────
        background_tasks.add_task(_persist_scan, scan)
        background_tasks.add_task(_index_clauses, scan_id, domain, nlp_results)

        logger.info(
            "Full analysis complete",
            scan_id=scan_id,
            domain=domain,
            risk=risk_score.score,
        )
        return FullAnalysisResponse(data=scan, status_code=200)

    except Exception as exc:
        logger.error("Full analysis failed", error=str(exc))
        raise HTTPException(status_code=500, detail=str(exc))


async def _persist_scan(scan: ScanResult) -> None:
    """Persist a ScanResult to MongoDB and update cache.

    Args:
        scan: The completed ScanResult.
    """
    try:
        doc = scan.model_dump(mode="json")
        await col_scan_history().insert_one(doc)

        # Cache the result for quick domain lookup
        cache_key = cache_service.domain_cache_key(scan.domain)
        await cache_service.cache_set(cache_key, doc, ttl_seconds=3600)
        logger.info("Scan persisted", scan_id=scan.scan_id)
    except Exception as exc:
        logger.error("Failed to persist scan", error=str(exc))


async def _index_clauses(scan_id: str, domain: str, clauses) -> None:
    """Index flagged clause texts into the vector store for RAG.

    Args:
        scan_id: UUID of the scan.
        domain: Source domain.
        clauses: List of LabeledClause objects.
    """
    try:
        flagged = [c for c in clauses if any(lbl.value != "clean" for lbl in c.labels)]
        if flagged:
            texts = [c.text for c in flagged]
            meta = [{"scan_id": scan_id, "domain": domain, "severity": c.severity} for c in flagged]
            await rag_service.index_clauses(texts, meta)
    except Exception as exc:
        logger.warning("Clause indexing failed", error=str(exc))


# ── RAG endpoint ─────────────────────────────────────────────────────────────

rag_router = APIRouter(prefix="/rag", tags=["RAG"])


@rag_router.get("/ask")
async def rag_ask(q: str, top_k: int = 5) -> dict:
    """Find T&C clauses semantically similar to the query.

    Args:
        q: Natural-language query (e.g., 'What hidden fees exist?').
        top_k: Number of similar clauses to return.

    Returns:
        Standard API response with a list of similar clause evidence passages.
    """
    try:
        results = await rag_service.query_similar_clauses(q, top_k=top_k)
        return {"data": results, "error": None, "status_code": 200}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
