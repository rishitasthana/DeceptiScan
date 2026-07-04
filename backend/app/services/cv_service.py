"""CV service: ResNet-50 multi-label classifier for UI dark patterns."""

from __future__ import annotations

import base64
import io
import os
import json
from typing import List

import structlog

from app.config import get_settings
from app.models.scan import CVLabel, UIPattern

logger = structlog.get_logger(__name__)

# ── Label metadata ────────────────────────────────────────────────────────────

_LABEL_DESCRIPTIONS: dict[str, str] = {
    "pre_checked_consent": "Consent checkboxes are pre-checked, enrolling users without explicit action.",
    "hidden_unsubscribe": "Unsubscribe or cancel options are hidden or visually suppressed.",
    "misleading_cta_color": "High-contrast color draws attention to the unwanted action; the preferred action is de-emphasized.",
    "small_print_placement": "Critical terms are placed in tiny text in low-visibility areas.",
    "clean": "No UI dark patterns detected in this screenshot.",
}

_LABEL_SEVERITY: dict[str, float] = {
    "pre_checked_consent": 0.9,
    "hidden_unsubscribe": 0.85,
    "misleading_cta_color": 0.7,
    "small_print_placement": 0.75,
    "clean": 0.0,
}

_LABELS = [lbl.value for lbl in CVLabel]
_THRESHOLD = 0.5


class CVPredictor:
    """ResNet-50 multi-label screenshot classifier.

    Falls back to a mock classifier based on image statistics when weights are absent.
    """

    def __init__(self) -> None:
        """Initialize the predictor (weights loaded lazily)."""
        self._model = None
        self._transform = None
        self._loaded = False

    def _try_load(self) -> bool:
        """Attempt to load model weights. Returns True if successful."""
        if self._loaded:
            return True
        # Resolve absolute path to the trained model directory relative to this file
        model_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "ml", "cv", "weights", "cv_model"))
        model_path = os.path.join(model_dir, "resnet50.pt")
        class_map_path = os.path.join(model_dir, "class_map.json")
        
        # Verify both files exist
        if not (os.path.exists(model_path) and os.path.exists(class_map_path)):
            logger.warning(
                "CV model weights or class map not found — using mock classifier",
                model_path=model_path,
                class_map_path=class_map_path,
            )
            return False
        
        try:
            import torch
            import torchvision.transforms as T
            from torchvision.models import resnet50
            
            # Load model architecture without pretrained weights
            self._model = resnet50(weights=None)
            # Load class map to determine label order
            with open(class_map_path, "r") as f:
                class_map = json.load(f)  # expects {"0": "pre_checked_consent", ...}
            # Update global label list based on loaded map
            global _LABELS
            _LABELS = [class_map[str(i)] for i in range(len(class_map))]
            
            # Replace final fully connected layer to match training architecture
            self._model.fc = torch.nn.Sequential(
                torch.nn.Dropout(0.3),
                torch.nn.Linear(self._model.fc.in_features, len(_LABELS)),
            )
            
            # Load state dict
            state = torch.load(model_path, map_location="cpu")
            self._model.load_state_dict(state)
            self._model.eval()
            
            # Define same preprocessing as training
            self._transform = T.Compose([
                T.Resize((224, 224)),
                T.ToTensor(),
                T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
            ])
            
            self._loaded = True
            logger.info("CV model loaded", model_path=model_path)
            return True
        except Exception as exc:
            logger.error("Failed to load CV model", error=str(exc))
            return False

    def _mock_predict(self, image) -> dict[str, float]:
        """Mock classifier using image statistics as a stand-in for real inference.

        Args:
            image: PIL Image object.

        Returns:
            Dict mapping label → confidence score.
        """
        import numpy as np

        arr = np.array(image.convert("RGB"))
        # Use pixel variance and mean as rough heuristic signals
        variance = float(arr.var())
        mean_brightness = float(arr.mean())

        scores = {
            "pre_checked_consent": min(0.8, variance / 10000),
            "hidden_unsubscribe": min(0.7, (255 - mean_brightness) / 400),
            "misleading_cta_color": min(0.75, variance / 12000),
            "small_print_placement": min(0.65, (255 - mean_brightness) / 500),
        }
        max_score = max(scores.values())
        scores["clean"] = 0.9 if max_score < 0.3 else 0.1
        return scores

    def _real_predict(self, image) -> dict[str, float]:
        """Run ResNet-50 inference on a PIL Image.

        Args:
            image: PIL Image object.

        Returns:
            Dict mapping label → sigmoid confidence score.
        """
        import torch

        tensor = self._transform(image).unsqueeze(0)
        with torch.no_grad():
            logits = self._model(tensor)
        probs = torch.softmax(logits, dim=1).squeeze().tolist()
        return dict(zip(_LABELS, probs))

    def classify_screenshot(self, image_b64: str) -> List[UIPattern]:
        """Classify a base64-encoded screenshot for UI dark patterns.

        Args:
            image_b64: Base64-encoded PNG or JPEG image.

        Returns:
            List of detected UIPattern objects.
        """
        from PIL import Image

        image_bytes = base64.b64decode(image_b64)
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

        use_real = self._try_load()
        scores = self._real_predict(image) if use_real else self._mock_predict(image)

        detected: List[UIPattern] = []
        for label, confidence in scores.items():
            if confidence >= _THRESHOLD:
                severity = _LABEL_SEVERITY.get(label, 0.0) * confidence
                detected.append(
                    UIPattern(
                        label=CVLabel(label),
                        confidence=round(confidence, 4),
                        severity=round(severity, 4),
                        description=_LABEL_DESCRIPTIONS.get(label, ""),
                    )
                )

        if not detected:
            detected.append(
                UIPattern(
                    label=CVLabel.clean,
                    confidence=0.95,
                    severity=0.0,
                    description=_LABEL_DESCRIPTIONS["clean"],
                )
            )

        return sorted(detected, key=lambda p: p.severity, reverse=True)


# ── Module-level singleton ────────────────────────────────────────────────────

_predictor: CVPredictor | None = None


def get_cv_predictor() -> CVPredictor:
    """Return the module-level CVPredictor singleton."""
    global _predictor
    if _predictor is None:
        _predictor = CVPredictor()
    return _predictor
