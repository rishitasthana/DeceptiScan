"""CV inference wrapper for ResNet-50 dark pattern classifier."""

from __future__ import annotations

import io
import os
from typing import List

import torch
import torch.nn as nn
from PIL import Image
from torchvision import transforms
from torchvision.models import ResNet50_Weights, resnet50

from cv.labels import CV_ID2LABEL, CV_LABEL_SEVERITY, CV_LABELS

_THRESHOLD = 0.5
_NUM_CLASSES = len(CV_LABELS)


class CVPredictor:
    """Loads a fine-tuned ResNet-50 checkpoint and runs multi-label inference."""

    def __init__(self, model_dir: str = "weights/cv_model") -> None:
        """Load the model weights from disk.

        Args:
            model_dir: Directory containing cv_model.pt.
        """
        model_path = os.path.join(model_dir, "cv_model.pt")
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"CV model not found: {model_path}")

        model = resnet50(weights=None)
        model.fc = nn.Sequential(
            nn.Dropout(0.3),
            nn.Linear(model.fc.in_features, _NUM_CLASSES),
        )
        model.load_state_dict(torch.load(model_path, map_location="cpu"))
        model.eval()

        self.model = model
        self.transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])

    def predict(self, image_path_or_bytes) -> List[dict]:
        """Run inference on an image file path or raw bytes.

        Args:
            image_path_or_bytes: File path string or raw image bytes.

        Returns:
            List of dicts: {'label', 'confidence', 'severity', 'description'}
        """
        if isinstance(image_path_or_bytes, (str, os.PathLike)):
            image = Image.open(image_path_or_bytes).convert("RGB")
        elif isinstance(image_path_or_bytes, bytes):
            image = Image.open(io.BytesIO(image_path_or_bytes)).convert("RGB")
        else:
            raise TypeError("Expected file path or bytes")

        tensor = self.transform(image).unsqueeze(0)
        with torch.no_grad():
            logits = self.model(tensor)

        probs = torch.sigmoid(logits).squeeze().tolist()

        results = []
        for i, prob in enumerate(probs):
            if prob >= _THRESHOLD:
                label = CV_ID2LABEL[i]
                results.append({
                    "label": label,
                    "confidence": round(prob, 4),
                    "severity": round(CV_LABEL_SEVERITY.get(label, 0.0) * prob, 4),
                })

        return sorted(results, key=lambda x: x["severity"], reverse=True)


if __name__ == "__main__":
    predictor = CVPredictor()
    from cv.dataset import _make_pre_checked_consent_image
    import io as _io

    img = _make_pre_checked_consent_image()
    buf = _io.BytesIO()
    img.save(buf, format="PNG")
    results = predictor.predict(buf.getvalue())
    for r in results:
        print(r)
