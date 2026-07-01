"""Evaluate CV model: compute per-label precision, recall, F1."""

from __future__ import annotations

import json
import os

import numpy as np
import torch
import torch.nn as nn
from sklearn.metrics import precision_recall_fscore_support
from torch.utils.data import DataLoader, random_split
from torchvision.models import resnet50

from cv.dataset import SyntheticCVDataset
from cv.labels import CV_LABELS

_THRESHOLD = 0.5
_NUM_CLASSES = len(CV_LABELS)


def evaluate(model_dir: str = "weights/cv_model", samples_per_class: int = 50) -> dict:
    """Evaluate the CV model on a held-out validation split.

    Args:
        model_dir: Directory containing cv_model.pt.
        samples_per_class: Samples per class for the eval dataset.

    Returns:
        Dict of per-label precision, recall, F1 scores.
    """
    model_path = os.path.join(model_dir, "cv_model.pt")
    model = resnet50(weights=None)
    model.fc = nn.Sequential(
        nn.Dropout(0.3),
        nn.Linear(model.fc.in_features, _NUM_CLASSES),
    )
    model.load_state_dict(torch.load(model_path, map_location="cpu"))
    model.eval()

    dataset = SyntheticCVDataset(samples_per_class=samples_per_class, augment=False)
    val_size = max(1, int(len(dataset) * 0.2))
    _, val_ds = random_split(dataset, [len(dataset) - val_size, val_size])
    val_loader = DataLoader(val_ds, batch_size=16)

    all_preds = []
    all_labels = []

    with torch.no_grad():
        for images, labels in val_loader:
            logits = model(images)
            probs = torch.sigmoid(logits).numpy()
            preds = (probs >= _THRESHOLD).astype(int)
            all_preds.append(preds)
            all_labels.append(labels.numpy().astype(int))

    y_pred = np.vstack(all_preds)
    y_true = np.vstack(all_labels)

    precision, recall, f1, _ = precision_recall_fscore_support(
        y_true, y_pred, average=None, zero_division=0
    )

    metrics = {}
    for i, label in enumerate(CV_LABELS):
        metrics[label] = {
            "precision": round(float(precision[i]), 4),
            "recall": round(float(recall[i]), 4),
            "f1": round(float(f1[i]), 4),
        }

    print("\nCV Model Per-label metrics:")
    print(f"{'Label':<30} {'Precision':>10} {'Recall':>10} {'F1':>10}")
    for label, m in metrics.items():
        print(f"{label:<30} {m['precision']:>10.4f} {m['recall']:>10.4f} {m['f1']:>10.4f}")

    out_path = os.path.join(model_dir, "metrics.json")
    with open(out_path, "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"\nMetrics saved to {out_path}")

    return metrics


if __name__ == "__main__":
    evaluate()
