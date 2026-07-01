"""Report router: GET /report/pdf/{scan_id} — generates and streams PDF reports."""

from __future__ import annotations

import structlog
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response

from app.database import col_scan_history
from app.models.scan import ScanResult
from app.routers.auth import verify_token
from app.services.pdf_service import generate_pdf_report

router = APIRouter(prefix="/report", tags=["Reports"])
logger = structlog.get_logger(__name__)


@router.get("/pdf/{scan_id}")
async def get_pdf_report(
    scan_id: str,
    token_data: dict = Depends(verify_token),
) -> Response:
    """Generate and return a PDF report for a completed scan.

    Fetches the scan document from MongoDB, renders a styled HTML report
    using Jinja2 + WeasyPrint, and streams the PDF bytes.

    Args:
        scan_id: UUID of the scan to generate a report for.

    Returns:
        PDF file as an application/pdf response.
    """
    try:
        doc = await col_scan_history().find_one({"scan_id": scan_id}, {"_id": 0})
        if not doc:
            raise HTTPException(status_code=404, detail=f"Scan not found: {scan_id}")

        scan = ScanResult(**doc)
        pdf_bytes = await generate_pdf_report(scan)

        logger.info("PDF report generated", scan_id=scan_id, bytes=len(pdf_bytes))
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="report_{scan_id}.pdf"',
                "Content-Length": str(len(pdf_bytes)),
            },
        )
    except HTTPException:
        raise
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        logger.error("PDF generation failed", scan_id=scan_id, error=str(exc))
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/metrics")
async def get_model_metrics() -> dict:
    """Return model performance metrics (precision, recall, F1 per label).

    Reads from the metrics JSON files produced by ml/nlp/evaluate.py and ml/cv/evaluate.py.
    Falls back to mock metrics if files are not found.

    Returns:
        Standard API response with nlp_metrics and cv_metrics dicts.
    """
    import json
    import os

    metrics: dict = {"nlp_metrics": {}, "cv_metrics": {}}

    for model_type in ["nlp", "cv"]:
        path = f"../ml/weights/{model_type}_model/metrics.json"
        if os.path.exists(path):
            with open(path) as f:
                metrics[f"{model_type}_metrics"] = json.load(f)
        else:
            # Return illustrative mock metrics
            labels = (
                ["fee_burial", "auto_renewal_trap", "urgency_language", "ambiguous_opt_out", "misleading_free", "clean"]
                if model_type == "nlp"
                else ["pre_checked_consent", "hidden_unsubscribe", "misleading_cta_color", "small_print_placement", "clean"]
            )
            metrics[f"{model_type}_metrics"] = {
                lbl: {"precision": 0.0, "recall": 0.0, "f1": 0.0}
                for lbl in labels
            }

    return {"data": metrics, "error": None, "status_code": 200}
