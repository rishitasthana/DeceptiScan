"""Pydantic v2 schemas for community reports / flagging."""

from __future__ import annotations

from datetime import datetime, UTC
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class ReportStatus(str, Enum):
    """Lifecycle status of a community report."""

    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class CommunityReportRequest(BaseModel):
    """Request body for POST /community/report."""

    domain: str = Field(..., description="Domain being reported")
    pattern_type: str = Field(..., description="Type of dark pattern observed")
    description: str = Field(..., min_length=10, description="User description")
    url: Optional[str] = Field(None, description="Specific URL observed")
    reporter_id: Optional[str] = Field(None, description="Anonymous user ID")


class CommunityReport(BaseModel):
    """Full community report document stored in MongoDB."""

    id: Optional[str] = None
    domain: str
    pattern_type: str
    description: str
    url: Optional[str] = None
    reporter_id: Optional[str] = None
    status: ReportStatus = ReportStatus.pending
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    reviewed_at: Optional[datetime] = None
    reviewer_note: Optional[str] = None


class CommunityReportResponse(BaseModel):
    """Response for POST /community/report."""

    data: Optional[CommunityReport] = None
    error: Optional[str] = None
    status_code: int = 201


class CommunityReportListResponse(BaseModel):
    """Response for GET /community/reports (admin)."""

    data: list[CommunityReport] = Field(default_factory=list)
    total: int = 0
    error: Optional[str] = None
    status_code: int = 200
