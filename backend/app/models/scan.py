"""Pydantic v2 schemas for scan requests and responses."""

from __future__ import annotations

from datetime import datetime, UTC
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


# ── NLP Labels ───────────────────────────────────────────────────────────────

class NLPLabel(str, Enum):
    """Multi-label NLP classification categories."""

    fee_burial = "fee_burial"
    auto_renewal_trap = "auto_renewal_trap"
    urgency_language = "urgency_language"
    ambiguous_opt_out = "ambiguous_opt_out"
    misleading_free = "misleading_free"
    clean = "clean"


# ── CV Labels ─────────────────────────────────────────────────────────────────

class CVLabel(str, Enum):
    """CV screenshot classification categories."""

    pre_checked_consent = "pre_checked_consent"
    hidden_unsubscribe = "hidden_unsubscribe"
    misleading_cta_color = "misleading_cta_color"
    small_print_placement = "small_print_placement"
    clean = "clean"


# ── NLP results ───────────────────────────────────────────────────────────────

class LabeledClause(BaseModel):
    """A T&C clause with its detected dark-pattern labels."""

    text: str = Field(..., description="The raw clause text")
    labels: List[NLPLabel] = Field(default_factory=list)
    confidences: dict[str, float] = Field(
        default_factory=dict,
        description="Label → confidence score mapping",
    )
    severity: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Aggregate severity of detected labels",
    )
    explanation: Optional[str] = Field(None, description="Plain-English explanation")


# ── CV results ────────────────────────────────────────────────────────────────

class UIPattern(BaseModel):
    """A detected UI dark pattern from the screenshot classifier."""

    label: CVLabel
    confidence: float = Field(..., ge=0.0, le=1.0)
    severity: float = Field(..., ge=0.0, le=1.0)
    description: str = Field(..., description="Plain-English description")
    bounding_box: Optional[dict] = Field(None, description="Optional pixel region")


# ── Risk score ────────────────────────────────────────────────────────────────

class RiskScore(BaseModel):
    """Fused risk score from NLP + CV analysis."""

    score: float = Field(..., ge=1.0, le=10.0, description="Overall risk score 1–10")
    nlp_score: float = Field(..., ge=0.0, le=10.0)
    cv_score: float = Field(..., ge=0.0, le=10.0)
    level: str = Field(..., description="low | medium | high | critical")


# ── Requests ─────────────────────────────────────────────────────────────────

class TextAnalysisRequest(BaseModel):
    """Request body for POST /analyze/text."""

    text: str = Field(..., min_length=10, description="Raw T&C text to analyze")
    domain: Optional[str] = Field(None, description="Source domain for caching")


class ScreenshotAnalysisRequest(BaseModel):
    """Request body for POST /analyze/screenshot."""

    screenshot_b64: str = Field(..., description="Base64-encoded PNG/JPEG screenshot")
    domain: Optional[str] = None


class FullAnalysisRequest(BaseModel):
    """Request body for POST /analyze/full."""

    text: str = Field(..., min_length=10)
    screenshot_b64: Optional[str] = Field(None)
    domain: Optional[str] = None
    pdf_urls: List[str] = Field(default_factory=list, description="Linked PDF URLs found in DOM")
    page_title: Optional[str] = None


# ── Responses ─────────────────────────────────────────────────────────────────

class TextAnalysisResponse(BaseModel):
    """Response for POST /analyze/text."""

    data: List[LabeledClause]
    error: Optional[str] = None
    status_code: int = 200


class ScreenshotAnalysisResponse(BaseModel):
    """Response for POST /analyze/screenshot."""

    data: List[UIPattern]
    error: Optional[str] = None
    status_code: int = 200


class ScanResult(BaseModel):
    """Full scan result stored in MongoDB and returned to the extension."""

    scan_id: str
    domain: str
    page_title: Optional[str] = None
    risk_score: RiskScore
    top_patterns: List[LabeledClause | UIPattern] = Field(
        default_factory=list,
        description="Top 3 most severe patterns for the overlay",
    )
    nlp_results: List[LabeledClause] = Field(default_factory=list)
    cv_results: List[UIPattern] = Field(default_factory=list)
    pdf_urls: List[str] = Field(default_factory=list)
    screenshot_uri: Optional[str] = None
    scanned_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class FullAnalysisResponse(BaseModel):
    """Response for POST /analyze/full."""

    data: Optional[ScanResult] = None
    error: Optional[str] = None
    status_code: int = 200
