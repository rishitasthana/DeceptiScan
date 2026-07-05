"""Pydantic v2 schemas for Product domain."""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class ProductSummary(BaseModel):
    """Lightweight product summary shown in the admin dashboard."""

    domain: str
    last_risk_score: float = Field(..., ge=1.0, le=10.0)
    risk_level: str  # low | medium | high | critical
    scan_count: int
    last_scanned_at: datetime
    scan_id: Optional[str] = None
    flagged: bool = False


class ProductScanHistoryResponse(BaseModel):
    """Response for GET /products/{domain}."""

    data: Optional[List[dict]] = None
    total: int = 0
    page: int = 1
    page_size: int = 20
    error: Optional[str] = None
    status_code: int = 200


class ProductListResponse(BaseModel):
    """Response for GET /products (admin dashboard)."""

    data: List[ProductSummary] = Field(default_factory=list)
    total: int = 0
    error: Optional[str] = None
    status_code: int = 200
