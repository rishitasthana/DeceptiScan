"""Products router: GET /products and GET /products/{domain}."""

from __future__ import annotations

import structlog
from fastapi import APIRouter, HTTPException, Query

from app.database import col_scan_history
from app.models.product import ProductListResponse, ProductScanHistoryResponse, ProductSummary
from app.services import cache_service

router = APIRouter(prefix="/products", tags=["Products"])
logger = structlog.get_logger(__name__)


@router.get("", response_model=ProductListResponse)
async def list_products(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> ProductListResponse:
    """Return a paginated list of all scanned domains with their latest risk scores.

    Args:
        page: Page number (1-indexed).
        page_size: Number of results per page.

    Returns:
        ProductListResponse with a list of ProductSummary objects.
    """
    try:
        skip = (page - 1) * page_size
        pipeline = [
            {"$sort": {"scanned_at": -1}},
            {
                "$group": {
                    "_id": "$domain",
                    "last_risk_score": {"$first": "$risk_score.score"},
                    "risk_level": {"$first": "$risk_score.level"},
                    "scan_count": {"$sum": 1},
                    "last_scanned_at": {"$first": "$scanned_at"},
                    "scan_id": {"$first": "$scan_id"},
                }
            },
            {"$sort": {"last_risk_score": -1}},
            {"$skip": skip},
            {"$limit": page_size},
        ]
        cursor = col_scan_history().aggregate(pipeline)
        docs = await cursor.to_list(length=page_size)
        total_cursor = col_scan_history().aggregate([
            {"$group": {"_id": "$domain"}},
            {"$count": "total"},
        ])
        total_docs = await total_cursor.to_list(length=1)
        total = total_docs[0]["total"] if total_docs else 0

        summaries = [
            ProductSummary(
                domain=d["_id"],
                last_risk_score=d.get("last_risk_score", 1.0),
                risk_level=d.get("risk_level", "low"),
                scan_count=d.get("scan_count", 0),
                last_scanned_at=d["last_scanned_at"],
                scan_id=d.get("scan_id"),
            )
            for d in docs
        ]
        return ProductListResponse(data=summaries, total=total, status_code=200)
    except Exception as exc:
        logger.error("List products failed", error=str(exc))
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/history", response_model=ProductListResponse)
async def get_recent_history(
    limit: int = Query(default=10, ge=1, le=100),
) -> ProductListResponse:
    """Return the most recently scanned domains sorted by scan time.

    Args:
        limit: Maximum number of entries to return.

    Returns:
        ProductListResponse with the most recent domain summaries.
    """
    try:
        pipeline = [
            {"$sort": {"scanned_at": -1}},
            {
                "$group": {
                    "_id": "$domain",
                    "last_risk_score": {"$first": "$risk_score.score"},
                    "risk_level": {"$first": "$risk_score.level"},
                    "scan_count": {"$sum": 1},
                    "last_scanned_at": {"$first": "$scanned_at"},
                    "scan_id": {"$first": "$scan_id"},
                }
            },
            {"$sort": {"last_scanned_at": -1}},
            {"$limit": limit},
        ]
        cursor = col_scan_history().aggregate(pipeline)
        docs = await cursor.to_list(length=limit)

        summaries = [
            ProductSummary(
                domain=d["_id"],
                last_risk_score=d.get("last_risk_score", 1.0),
                risk_level=d.get("risk_level", "low"),
                scan_count=d.get("scan_count", 0),
                last_scanned_at=d["last_scanned_at"],
                scan_id=d.get("scan_id"),
            )
            for d in docs
        ]
        return ProductListResponse(data=summaries, total=len(summaries), status_code=200)
    except Exception as exc:
        logger.error("Get recent history failed", error=str(exc))
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/{domain}", response_model=ProductScanHistoryResponse)
async def get_product_scans(
    domain: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> ProductScanHistoryResponse:
    """Return paginated scan history for a specific domain.

    Args:
        domain: The hostname to look up (e.g., 'chase.com').
        page: Page number (1-indexed).
        page_size: Results per page.

    Returns:
        ProductScanHistoryResponse with the list of scan documents.
    """
    try:
        # Try cache first
        cache_key = cache_service.domain_cache_key(domain)
        cached = await cache_service.cache_get(cache_key)
        if cached and page == 1:
            return ProductScanHistoryResponse(
                data=[cached],
                total=1,
                page=1,
                page_size=page_size,
                status_code=200,
            )

        skip = (page - 1) * page_size
        cursor = col_scan_history().find(
            {"domain": domain},
            {"_id": 0},
            sort=[("scanned_at", -1)],
        ).skip(skip).limit(page_size)

        docs = await cursor.to_list(length=page_size)
        total = await col_scan_history().count_documents({"domain": domain})

        if not docs and page == 1:
            raise HTTPException(status_code=404, detail=f"No scans found for domain: {domain}")

        return ProductScanHistoryResponse(
            data=docs,
            total=total,
            page=page,
            page_size=page_size,
            status_code=200,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Get product scans failed", domain=domain, error=str(exc))
        raise HTTPException(status_code=500, detail=str(exc))
