"""Pydantic v2 schemas for PDF reports."""

from __future__ import annotations

from datetime import datetime, UTC
from typing import Optional

from pydantic import BaseModel, Field

class ReportMetadata(BaseModel):
    """Metadata stored alongside a generated PDF report."""

    scan_id: str
    domain: str
    generated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    storage_uri: Optional[str] = None
    file_size_bytes: Optional[int] = None


class ReportGenerationResponse(BaseModel):
    """Response wrapper when the PDF has been generated successfully."""

    data: Optional[ReportMetadata] = None
    error: Optional[str] = None
    status_code: int = 200
