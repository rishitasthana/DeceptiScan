"""Evaluate NLP model: compute per-label precision, recall, F1."""

from __future__ import annotations

import json
import os

import numpy as np
import torch
from sklearn.metrics import classification_report, precision_recall_fscore_support
from transformers import AutoModelForSequenceClassification, AutoTokenizer

from nlp.dataset import load_dataset
from nlp.labels import NLP_LABELS

_THRESHOLD = 0.5
_MAX_LENGTH = 512


def evaluate(model_dir: str = "weights/nlp_model") -> dict:
    """Evaluate the NLP model on the validation split and save metrics.

    Args:
        model_dir: Path to the saved model directory.

    Returns:
        Dict of per-label precision, recall, F1 scores.
    """
    tokenizer = AutoTokenizer.from_pretrained(model_dir)
    model = AutoModelForSequenceClassification.from_pretrained(model_dir)
    model.eval()

    _, val_ds = load_dataset(split=0.8)

    all_preds = []
    all_labels = []

    for item in val_ds:
        inputs = tokenizer(
            item["text"],
            return_tensors="pt",
            max_length=_MAX_LENGTH,
            truncation=True,
            padding=True,
        )
        with torch.no_grad():
            logits = model(**inputs).logits

        probs = torch.sigmoid(logits).squeeze().cpu().numpy()
        all_preds.append((probs >= _THRESHOLD).astype(int))
        all_labels.append(np.array(item["labels"]).astype(int))

    y_pred = np.array(all_preds)
    y_true = np.array(all_labels)

    precision, recall, f1, _ = precision_recall_fscore_support(
        y_true, y_pred, average=None, zero_division=0
    )

    metrics = {}
    for i, label in enumerate(NLP_LABELS):
        metrics[label] = {
            "precision": round(float(precision[i]), 4),
            "recall": round(float(recall[i]), 4),
            "f1": round(float(f1[i]), 4),
        }

    print("\nPer-label metrics:")
    print(f"{'Label':<25} {'Precision':>10} {'Recall':>10} {'F1':>10}")
    for label, m in metrics.items():
        print(f"{label:<25} {m['precision']:>10.4f} {m['recall']:>10.4f} {m['f1']:>10.4f}")

    out_path = os.path.join(model_dir, "metrics.json")
    with open(out_path, "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"\nMetrics saved to {out_path}")

    return metrics


if __name__ == "__main__":
    evaluate()
