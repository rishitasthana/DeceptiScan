"""NLP service: Legal-BERT multi-label classifier for T&C dark patterns."""

from __future__ import annotations

import os
import re
from typing import List

import structlog

from app.config import get_settings
from app.models.scan import LabeledClause, NLPLabel

logger = structlog.get_logger(__name__)

# ── Label metadata ────────────────────────────────────────────────────────────

_LABEL_EXPLANATIONS: dict[str, str] = {
    "fee_burial": "Hidden fees are buried in long paragraphs to avoid attention.",
    "auto_renewal_trap": "Subscription auto-renews without clear notice, making cancellation difficult.",
    "urgency_language": "Artificial urgency or scarcity pressure is used to rush the decision.",
    "ambiguous_opt_out": "Opting out of data sharing or marketing is intentionally confusing.",
    "misleading_free": "'Free' offer hides required purchases or automatic charges.",
    "clean": "No dark patterns detected in this clause.",
}

_LABEL_SEVERITY: dict[str, float] = {
    "fee_burial": 0.9,
    "auto_renewal_trap": 0.85,
    "urgency_language": 0.6,
    "ambiguous_opt_out": 0.75,
    "misleading_free": 0.8,
    "clean": 0.0,
}

_LABELS = [lbl.value for lbl in NLPLabel]
_THRESHOLD = 0.5  # sigmoid threshold for multi-label


class NLPPredictor:
    """Legal-BERT multi-label classifier.

    Falls back to a heuristic mock classifier when model weights are absent.
    """

    def __init__(self) -> None:
        """Initialize the predictor (weights loaded lazily)."""
        self._model = None
        self._tokenizer = None
        self._loaded = False

    def _try_load(self) -> bool:
        """Attempt to load model weights. Returns True if successful."""
        if self._loaded:
            return True
        settings = get_settings()
        model_path = settings.nlp_model_path

        if not os.path.exists(model_path):
            logger.warning("NLP model weights not found — using mock classifier", path=model_path)
            return False

        try:
            import torch
            from transformers import AutoModelForSequenceClassification, AutoTokenizer

            self._tokenizer = AutoTokenizer.from_pretrained(model_path)
            self._model = AutoModelForSequenceClassification.from_pretrained(model_path)
            self._model.eval()
            self._loaded = True
            logger.info("NLP model loaded", path=model_path)
            return True
        except Exception as exc:
            logger.error("Failed to load NLP model", error=str(exc))
            return False

    def _mock_predict(self, sentence: str) -> dict[str, float]:
        """Heuristic keyword-based mock classifier for development.

        Args:
            sentence: Input clause text.

        Returns:
            Dict mapping label → confidence score.
        """
        text_lower = sentence.lower()
        scores: dict[str, float] = {}

        keyword_map = {
            "fee_burial": ["fee", "charge", "cost", "payment", "rate", "apr", "interest"],
            "auto_renewal_trap": ["auto-renew", "automatically renew", "cancel within", "recurring"],
            "urgency_language": ["limited time", "act now", "expires", "hurry", "today only"],
            "ambiguous_opt_out": ["opt out", "unsubscribe", "unless you", "by default"],
            "misleading_free": ["free", "no cost", "complimentary", "zero cost"],
        }

        for label, keywords in keyword_map.items():
            matches = sum(1 for kw in keywords if kw in text_lower)
            scores[label] = min(0.95, matches * 0.3) if matches else 0.05

        # If no strong signals, label as clean
        max_score = max(scores.values()) if scores else 0.0
        scores["clean"] = 0.9 if max_score < 0.3 else 0.1
        return scores

    def _real_predict(self, sentence: str) -> dict[str, float]:
        """Run Legal-BERT inference on a single sentence.

        Args:
            sentence: Input clause text.

        Returns:
            Dict mapping label → sigmoid confidence score.
        """
        import torch

        inputs = self._tokenizer(
            sentence,
            return_tensors="pt",
            max_length=512,
            truncation=True,
            padding=True,
        )
        with torch.no_grad():
            logits = self._model(**inputs).logits
        probs = torch.sigmoid(logits).squeeze().tolist()
        if isinstance(probs, float):
            probs = [probs]
        return dict(zip(_LABELS, probs))

    def classify_clauses(self, text: str) -> List[LabeledClause]:
        """Split text into sentences and classify each clause.

        Args:
            text: Full T&C document text.

        Returns:
            List of LabeledClause objects with detected patterns.
        """
        sentences = _split_sentences(text)
        use_real = self._try_load()
        results: List[LabeledClause] = []

        for sent in sentences:
            sent = sent.strip()
            if len(sent) < 20:
                continue

            scores = self._real_predict(sent) if use_real else self._mock_predict(sent)
            detected_labels = [
                NLPLabel(lbl) for lbl, score in scores.items() if score >= _THRESHOLD
            ]

            if not detected_labels:
                detected_labels = [NLPLabel.clean]

            severity = max(
                (_LABEL_SEVERITY.get(lbl.value, 0.0) * scores.get(lbl.value, 0.0) for lbl in detected_labels),
                default=0.0,
            )

            primary = detected_labels[0]
            explanation = _LABEL_EXPLANATIONS.get(primary.value, "")

            results.append(
                LabeledClause(
                    text=sent,
                    labels=detected_labels,
                    confidences={lbl: round(scores.get(lbl, 0.0), 4) for lbl in scores},
                    severity=round(severity, 4),
                    explanation=explanation,
                )
            )

        return results


def _split_sentences(text: str) -> List[str]:
    """Split text into sentences on period/newline boundaries.

    Args:
        text: Raw input text.

    Returns:
        List of sentence strings.
    """
    # Split on sentence-ending punctuation followed by whitespace or newlines
    sentences = re.split(r"(?<=[.!?])\s+|\n+", text)
    return [s.strip() for s in sentences if s.strip()]


# ── Module-level singleton ────────────────────────────────────────────────────

_predictor: NLPPredictor | None = None


def get_nlp_predictor() -> NLPPredictor:
    """Return the module-level NLPPredictor singleton."""
    global _predictor
    if _predictor is None:
        _predictor = NLPPredictor()
    return _predictor
