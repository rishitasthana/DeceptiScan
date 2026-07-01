"""Community reports router: POST /community/report and admin management endpoints."""

from __future__ import annotations

from datetime import datetime, UTC

import structlog
from bson import ObjectId
from fastapi import APIRouter, Depends, Header, HTTPException, Query

from app.config import get_settings
from app.database import col_community_reports
from app.routers.auth import verify_token
from app.models.community import (
    CommunityReport,
    CommunityReportListResponse,
    CommunityReportRequest,
    CommunityReportResponse,
    ReportStatus,
)

router = APIRouter(prefix="/community", tags=["Community"])
logger = structlog.get_logger(__name__)


def _require_admin(x_api_key: str = Header(default="")) -> None:
    """Validate the admin API key header.

    Args:
        x_api_key: Value of X-API-Key header.

    Raises:
        HTTPException: 403 if the key is invalid.
    """
    if x_api_key != get_settings().admin_api_key:
        raise HTTPException(status_code=403, detail="Invalid admin API key")


@router.post("/report", response_model=CommunityReportResponse, status_code=201)
async def submit_report(
    request: CommunityReportRequest,
    token_data: dict = Depends(verify_token),
) -> CommunityReportResponse:
    """Accept a user-submitted dark pattern flag.

    Args:
        request: CommunityReportRequest with domain and description.

    Returns:
        CommunityReportResponse with the created report document.
    """
    try:
        report = CommunityReport(
            domain=request.domain,
            pattern_type=request.pattern_type,
            description=request.description,
            url=request.url,
            reporter_id=request.reporter_id,
            status=ReportStatus.pending,
        )
        doc = report.model_dump(mode="json")
        result = await col_community_reports().insert_one(doc)
        report.id = str(result.inserted_id)

        logger.info("Community report submitted", domain=request.domain, id=report.id)
        return CommunityReportResponse(data=report, status_code=201)
    except Exception as exc:
        logger.error("Submit report failed", error=str(exc))
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/reports", response_model=CommunityReportListResponse)
async def list_reports(
    status: str = Query(default="pending"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    x_api_key: str = Header(default=""),
) -> CommunityReportListResponse:
    """List community reports filtered by status (admin only).

    Args:
        status: Filter by report status (pending/approved/rejected).
        page: Page number.
        page_size: Results per page.
        x_api_key: Admin API key.

    Returns:
        CommunityReportListResponse with a list of CommunityReport objects.
    """
    _require_admin(x_api_key)
    try:
        skip = (page - 1) * page_size
        query = {"status": status} if status != "all" else {}
        cursor = col_community_reports().find(query, sort=[("created_at", -1)]).skip(skip).limit(page_size)
        docs = await cursor.to_list(length=page_size)
        total = await col_community_reports().count_documents(query)

        reports = [
            CommunityReport(id=str(d.get("_id", "")), **{k: v for k, v in d.items() if k != "_id"})
            for d in docs
        ]
        return CommunityReportListResponse(data=reports, total=total, status_code=200)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.patch("/report/{report_id}/approve")
async def approve_report(report_id: str, x_api_key: str = Header(default="")) -> dict:
    """Approve a community report (admin only).

    Args:
        report_id: MongoDB ObjectId of the report.
        x_api_key: Admin API key.

    Returns:
        Standard API response confirming approval.
    """
    _require_admin(x_api_key)
    try:
        result = await col_community_reports().update_one(
            {"_id": ObjectId(report_id)},
            {"$set": {"status": ReportStatus.approved, "reviewed_at": datetime.now(UTC)}},
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Report not found")
        return {"data": {"approved": True}, "error": None, "status_code": 200}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.patch("/report/{report_id}/reject")
async def reject_report(report_id: str, x_api_key: str = Header(default="")) -> dict:
    """Reject a community report (admin only).

    Args:
        report_id: MongoDB ObjectId of the report.
        x_api_key: Admin API key.

    Returns:
        Standard API response confirming rejection.
    """
    _require_admin(x_api_key)
    try:
        result = await col_community_reports().update_one(
            {"_id": ObjectId(report_id)},
            {"$set": {"status": ReportStatus.rejected, "reviewed_at": datetime.now(UTC)}},
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Report not found")
        return {"data": {"rejected": True}, "error": None, "status_code": 200}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
