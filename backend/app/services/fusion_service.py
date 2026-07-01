"""Fusion service: combines NLP + CV results into a single risk score 1–10."""

from __future__ import annotations

from typing import List, Union

from app.config import get_settings
from app.models.scan import CVLabel, LabeledClause, NLPLabel, RiskScore, UIPattern


def _nlp_subscores(clauses: List[LabeledClause]) -> float:
    """Compute a 0–10 sub-score from NLP results.

    Uses the mean of the top-5 clause severity scores, scaled to 10.

    Args:
        clauses: List of classified clauses.

    Returns:
        Float in [0, 10].
    """
    if not clauses:
        return 1.0
    severities = sorted([c.severity for c in clauses], reverse=True)[:5]
    mean_severity = sum(severities) / len(severities)
    return round(mean_severity * 10, 2)


def _cv_subscores(patterns: List[UIPattern]) -> float:
    """Compute a 0–10 sub-score from CV results.

    Uses the mean severity of non-clean patterns, scaled to 10.

    Args:
        patterns: List of detected UI patterns.

    Returns:
        Float in [0, 10].
    """
    non_clean = [p for p in patterns if p.label != CVLabel.clean]
    if not non_clean:
        return 1.0
    mean_severity = sum(p.severity for p in non_clean) / len(non_clean)
    return round(mean_severity * 10, 2)


def _risk_level(score: float) -> str:
    """Convert numeric risk score to named level.

    Args:
        score: Risk score in [1, 10].

    Returns:
        One of 'low', 'medium', 'high', 'critical'.
    """
    if score <= 3.0:
        return "low"
    elif score <= 5.5:
        return "medium"
    elif score <= 7.5:
        return "high"
    else:
        return "critical"


def fuse_results(
    nlp_results: List[LabeledClause],
    cv_results: List[UIPattern],
) -> RiskScore:
    """Fuse NLP and CV sub-scores into a single 1–10 risk score.

    Args:
        nlp_results: Output of NLPPredictor.classify_clauses.
        cv_results: Output of CVPredictor.classify_screenshot.

    Returns:
        RiskScore with fused score, sub-scores, and risk level.
    """
    settings = get_settings()
    nlp_weight = settings.nlp_weight
    cv_weight = settings.cv_weight

    nlp_score = _nlp_subscores(nlp_results)
    cv_score = _cv_subscores(cv_results)

    # Weighted average, clamped to [1, 10]
    fused = nlp_weight * nlp_score + cv_weight * cv_score
    fused = max(1.0, min(10.0, fused))

    return RiskScore(
        score=round(fused, 2),
        nlp_score=nlp_score,
        cv_score=cv_score,
        level=_risk_level(fused),
    )


def get_top_patterns(
    nlp_results: List[LabeledClause],
    cv_results: List[UIPattern],
    top_k: int = 3,
) -> List[Union[LabeledClause, UIPattern]]:
    """Return the top-k most severe patterns across both modalities.

    Args:
        nlp_results: Classified NLP clauses.
        cv_results: Detected UI patterns.
        top_k: Number of top patterns to return.

    Returns:
        Sorted list of the most severe LabeledClause or UIPattern objects.
    """
    combined: List[Union[LabeledClause, UIPattern]] = [
        *[c for c in nlp_results if NLPLabel.clean not in c.labels],
        *[p for p in cv_results if p.label != CVLabel.clean],
    ]
    combined.sort(key=lambda x: x.severity, reverse=True)
    return combined[:top_k]
