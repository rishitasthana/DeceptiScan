"""NLP inference wrapper for Legal-BERT dark pattern classifier."""

from __future__ import annotations

import os
from typing import List

import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

from nlp.labels import NLP_ID2LABEL, NLP_LABELS

_THRESHOLD = 0.5
_MAX_LENGTH = 512


class NLPPredictor:
    """Loads a fine-tuned Legal-BERT checkpoint and runs multi-label inference."""

    def __init__(self, model_dir: str = "weights/nlp_model") -> None:
        """Load the tokenizer and model from disk.

        Args:
            model_dir: Path to the saved model directory.
        """
        if not os.path.exists(model_dir):
            raise FileNotFoundError(f"Model directory not found: {model_dir}")

        self.tokenizer = AutoTokenizer.from_pretrained(model_dir)
        self.model = AutoModelForSequenceClassification.from_pretrained(model_dir)
        self.model.eval()
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model.to(self.device)

    def predict(self, texts: List[str]) -> List[dict]:
        """Run inference on a list of T&C clause texts.

        Args:
            texts: List of clause strings to classify.

        Returns:
            List of dicts: {'text', 'labels', 'confidences', 'severity'}
        """
        results = []
        for text in texts:
            inputs = self.tokenizer(
                text,
                return_tensors="pt",
                max_length=_MAX_LENGTH,
                truncation=True,
                padding=True,
            ).to(self.device)

            with torch.no_grad():
                logits = self.model(**inputs).logits

            probs = torch.sigmoid(logits).squeeze().cpu().tolist()
            if isinstance(probs, float):
                probs = [probs]

            detected_labels = [
                NLP_ID2LABEL[i] for i, p in enumerate(probs) if p >= _THRESHOLD
            ]
            confidences = {NLP_ID2LABEL[i]: round(p, 4) for i, p in enumerate(probs)}
            severity = max(
                (p for i, p in enumerate(probs) if NLP_ID2LABEL[i] != "clean"),
                default=0.0,
            )

            results.append({
                "text": text,
                "labels": detected_labels or ["clean"],
                "confidences": confidences,
                "severity": round(severity, 4),
            })

        return results


if __name__ == "__main__":
    predictor = NLPPredictor()
    samples = [
        "This service auto-renews annually. Cancel within 30 days to avoid charges.",
        "You may close your account at any time by contacting customer service.",
        "Fees are described in section 14b of the cardholder agreement.",
    ]
    for result in predictor.predict(samples):
        print(result)
