"""Report router: HTML and PDF report generation for scan results."""

from __future__ import annotations

import structlog
from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse, Response

from app.database import col_scan_history
from app.models.scan import ScanResult

router = APIRouter(prefix="/report", tags=["Reports"])
logger = structlog.get_logger(__name__)


# ── HTML Report (public, no auth required) ────────────────────────────────────

_HTML_REPORT = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Dark Pattern Report — {domain}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root {{
    --primary: #6c63ff;
    --critical: #ff4757; --critical-bg: #fff0f1;
    --high: #ff7f50;     --high-bg: #fff6f0;
    --medium: #ffa502;   --medium-bg: #fffbf0;
    --low: #2ed573;      --low-bg: #f0fff4;
    --bg: #0f0e17; --surface: #1a1933; --card: #22203a;
    --text: #fffffe; --muted: #a7a9be; --border: #2e2c4a;
  }}
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: 'Inter', sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; }}

  /* Hero */
  .hero {{ background: linear-gradient(135deg, #1a1933 0%, #0f0e17 100%);
    border-bottom: 1px solid var(--border); padding: 48px 32px 40px; text-align: center; }}
  .logo {{ font-size: 13px; font-weight: 600; letter-spacing: 3px; color: var(--primary);
    text-transform: uppercase; margin-bottom: 24px; opacity: 0.8; }}
  .hero h1 {{ font-size: 28px; font-weight: 700; margin-bottom: 8px; }}
  .hero .meta {{ color: var(--muted); font-size: 13px; margin-top: 8px; }}

  /* Risk gauge */
  .gauge-wrap {{ margin: 32px auto; max-width: 200px; position: relative; }}
  .gauge-circle {{
    width: 140px; height: 140px; border-radius: 50%; margin: 0 auto;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    border: 6px solid; font-weight: 700; gap: 4px;
  }}
  .gauge-score {{ font-size: 42px; line-height: 1; }}
  .gauge-label {{ font-size: 12px; letter-spacing: 1px; text-transform: uppercase; opacity: 0.7; }}
  .risk-badge {{
    display: inline-block; padding: 6px 18px; border-radius: 20px;
    font-size: 12px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase;
    margin-top: 14px;
  }}
  .level-critical {{ border-color: var(--critical); color: var(--critical); }}
  .level-high {{ border-color: var(--high); color: var(--high); }}
  .level-medium {{ border-color: var(--medium); color: var(--medium); }}
  .level-low {{ border-color: var(--low); color: var(--low); }}
  .badge-critical {{ background: var(--critical-bg); color: var(--critical); }}
  .badge-high {{ background: var(--high-bg); color: var(--high); }}
  .badge-medium {{ background: var(--medium-bg); color: var(--medium); }}
  .badge-low {{ background: var(--low-bg); color: var(--low); }}

  /* Stats bar */
  .stats {{ display: flex; justify-content: center; gap: 32px; margin: 24px 0;
    flex-wrap: wrap; padding: 0 32px; }}
  .stat {{ text-align: center; }}
  .stat-value {{ font-size: 22px; font-weight: 700; }}
  .stat-label {{ font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; margin-top: 2px; }}

  /* Content */
  .content {{ max-width: 780px; margin: 0 auto; padding: 32px 20px 64px; }}
  .section-title {{
    font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px;
    color: var(--primary); margin: 36px 0 16px; display: flex; align-items: center; gap: 10px;
  }}
  .section-title::after {{ content: ""; flex: 1; height: 1px; background: var(--border); }}

  /* Pattern card */
  .pattern-card {{
    background: var(--card); border: 1px solid var(--border); border-radius: 12px;
    padding: 18px 20px; margin-bottom: 12px; border-left: 4px solid;
    transition: box-shadow 0.2s;
  }}
  .pattern-card:hover {{ box-shadow: 0 4px 24px rgba(108,99,255,0.15); }}
  .pattern-card.critical {{ border-left-color: var(--critical); }}
  .pattern-card.high {{ border-left-color: var(--high); }}
  .pattern-card.medium {{ border-left-color: var(--medium); }}
  .pattern-card.low {{ border-left-color: var(--low); }}
  .pattern-header {{ display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 10px; }}
  .pattern-name {{ font-weight: 600; font-size: 14px; }}
  .sev-pill {{
    font-size: 10px; font-weight: 700; padding: 3px 9px; border-radius: 20px;
    text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; flex-shrink: 0;
  }}
  .pattern-text {{
    font-size: 13px; color: var(--muted); line-height: 1.6;
    border-left: 2px solid var(--border); padding-left: 12px; margin-bottom: 10px;
    font-style: italic;
  }}
  .pattern-explanation {{ font-size: 12px; color: #8b87bb; line-height: 1.5; }}

  /* Sub-score bars */
  .score-bars {{ display: flex; flex-direction: column; gap: 10px; margin-top: 8px; }}
  .bar-row {{ display: flex; align-items: center; gap: 12px; }}
  .bar-label {{ font-size: 12px; color: var(--muted); width: 90px; flex-shrink: 0; }}
  .bar-track {{ flex: 1; height: 6px; background: var(--border); border-radius: 3px; }}
  .bar-fill {{ height: 100%; border-radius: 3px; background: var(--primary); transition: width 0.6s ease; }}
  .bar-value {{ font-size: 12px; font-weight: 600; width: 36px; text-align: right; flex-shrink: 0; }}

  /* Empty state */
  .empty {{ text-align: center; color: var(--muted); padding: 32px 0; font-size: 14px; }}

  /* Footer */
  .footer {{ text-align: center; color: var(--muted); font-size: 12px; margin-top: 48px;
    padding: 24px; border-top: 1px solid var(--border); }}
  @media print {{ body {{ background: white; color: black; }} .hero {{ background: white; }}
    .pattern-card {{ break-inside: avoid; background: #f9f9f9; }} }}
</style>
</head>
<body>

<div class="hero">
  <div class="logo">ShieldCheck — Dark Pattern Detector</div>
  <h1>{title}</h1>
  <div class="meta">
    <strong>{domain}</strong> &nbsp;·&nbsp; Scan ID: {scan_id} &nbsp;·&nbsp; {scanned_at}
  </div>

  <div class="gauge-wrap">
    <div class="gauge-circle level-{level}">
      <div class="gauge-score">{score}</div>
      <div class="gauge-label">out of 10</div>
    </div>
    <div style="text-align:center">
      <span class="risk-badge badge-{level}">{level} Risk</span>
    </div>
  </div>

  <div class="stats">
    <div class="stat">
      <div class="stat-value">{nlp_count}</div>
      <div class="stat-label">Text Patterns</div>
    </div>
    <div class="stat">
      <div class="stat-value">{cv_count}</div>
      <div class="stat-label">UI Patterns</div>
    </div>
    <div class="stat">
      <div class="stat-value">{total_count}</div>
      <div class="stat-label">Total Flags</div>
    </div>
  </div>

  <div class="score-bars" style="max-width:360px; margin: 0 auto;">
    <div class="bar-row">
      <div class="bar-label">Text Score</div>
      <div class="bar-track"><div class="bar-fill" style="width:{nlp_pct}%; background:#6c63ff;"></div></div>
      <div class="bar-value">{nlp_score}</div>
    </div>
    <div class="bar-row">
      <div class="bar-label">Visual Score</div>
      <div class="bar-track"><div class="bar-fill" style="width:{cv_pct}%; background:#ff6b81;"></div></div>
      <div class="bar-value">{cv_score}</div>
    </div>
  </div>
</div>

<div class="content">
  {nlp_section}
  {cv_section}

  <div class="footer">
    Generated by ShieldCheck Dark Pattern Detector &mdash; {scanned_at}
    <br>This report is for informational purposes only.
  </div>
</div>

</body>
</html>"""


def _sev_to_level(sev: float) -> str:
    """Convert 0-1 severity float to risk level string."""
    if sev >= 0.85:
        return "critical"
    if sev >= 0.65:
        return "high"
    if sev >= 0.35:
        return "medium"
    return "low"


def _humanize(s: str) -> str:
    """Convert snake_case to Title Case."""
    return s.replace("_", " ").title()


def _build_html_report(scan: ScanResult) -> str:
    """Render the scan result into a self-contained HTML report string.

    Args:
        scan: The ScanResult document.

    Returns:
        Fully-rendered HTML string.
    """
    level = scan.risk_score.level.lower()
    nlp_results = [c for c in scan.nlp_results if "clean" not in [str(l) for l in c.labels]]
    cv_results = [p for p in scan.cv_results if str(p.label) != "clean"]

    # ── NLP section ───────────────────────────────────────────
    if nlp_results:
        cards = []
        for clause in sorted(nlp_results, key=lambda c: c.severity, reverse=True):
            c_level = _sev_to_level(clause.severity)
            label_str = ", ".join(_humanize(str(l)) for l in clause.labels if str(l) != "clean") or "Unknown"
            cards.append(f"""
            <div class="pattern-card {c_level}">
              <div class="pattern-header">
                <div class="pattern-name">{label_str}</div>
                <span class="sev-pill badge-{c_level}">{c_level} · {clause.severity:.0%}</span>
              </div>
              <div class="pattern-text">{clause.text[:300]}</div>
              <div class="pattern-explanation">{clause.explanation or ""}</div>
            </div>""")
        nlp_section = f"""
        <div class="section-title">T&amp;C Clause Analysis ({len(nlp_results)} patterns)</div>
        {"".join(cards)}"""
    else:
        nlp_section = """
        <div class="section-title">T&amp;C Clause Analysis</div>
        <div class="empty">No dark patterns detected in the text</div>"""

    # ── CV section ────────────────────────────────────────────
    if cv_results:
        cards = []
        for pat in sorted(cv_results, key=lambda p: p.severity, reverse=True):
            c_level = _sev_to_level(pat.severity)
            cards.append(f"""
            <div class="pattern-card {c_level}">
              <div class="pattern-header">
                <div class="pattern-name">{_humanize(str(pat.label))}</div>
                <span class="sev-pill badge-{c_level}">{c_level} · {pat.confidence:.0%} confidence</span>
              </div>
              <div class="pattern-explanation">{pat.description}</div>
            </div>""")
        cv_section = f"""
        <div class="section-title">UI / Visual Pattern Analysis ({len(cv_results)} patterns)</div>
        {"".join(cards)}"""
    else:
        cv_section = """
        <div class="section-title">UI / Visual Pattern Analysis</div>
        <div class="empty">No dark UI patterns detected in the screenshot</div>"""

    scanned_at_str = scan.scanned_at.strftime("%Y-%m-%d %H:%M UTC") if scan.scanned_at else "Unknown"
    nlp_count = len(nlp_results)
    cv_count = len(cv_results)
    total_count = nlp_count + cv_count
    nlp_pct = min(scan.risk_score.nlp_score * 10, 100)
    cv_pct = min(scan.risk_score.cv_score * 10, 100)

    return _HTML_REPORT.format(
        domain=scan.domain,
        title=scan.page_title or scan.domain,
        scan_id=scan.scan_id,
        scanned_at=scanned_at_str,
        level=level,
        score=round(scan.risk_score.score, 1),
        nlp_score=round(scan.risk_score.nlp_score, 1),
        cv_score=round(scan.risk_score.cv_score, 1),
        nlp_count=nlp_count,
        cv_count=cv_count,
        total_count=total_count,
        nlp_pct=round(nlp_pct, 1),
        cv_pct=round(cv_pct, 1),
        nlp_section=nlp_section,
        cv_section=cv_section,
    )


@router.get("/html/{scan_id}", response_class=HTMLResponse)
async def get_html_report(scan_id: str) -> HTMLResponse:
    """Return a beautiful HTML report for a completed scan. No auth required.

    Args:
        scan_id: UUID of the scan to report on.

    Returns:
        Fully rendered HTML page.
    """
    try:
        doc = await col_scan_history().find_one({"scan_id": scan_id}, {"_id": 0})
        if not doc:
            raise HTTPException(status_code=404, detail=f"Scan not found: {scan_id}")
        scan = ScanResult(**doc)
        html = _build_html_report(scan)
        logger.info("HTML report generated", scan_id=scan_id)
        return HTMLResponse(content=html)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("HTML report failed", scan_id=scan_id, error=str(exc))
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

