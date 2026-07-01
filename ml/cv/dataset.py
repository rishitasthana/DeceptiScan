"""Synthetic dataset generator for CV dark pattern classifier."""

from __future__ import annotations

import io
import random
from typing import List, Tuple

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from torch.utils.data import Dataset as TorchDataset
from torchvision import transforms

from cv.labels import CV_LABEL2ID, CV_LABELS


def _make_pre_checked_consent_image(size: Tuple[int, int] = (224, 224)) -> Image.Image:
    """Generate a synthetic image simulating pre-checked consent checkboxes."""
    img = Image.new("RGB", size, color=(245, 245, 250))
    draw = ImageDraw.Draw(img)
    # Draw a checked checkbox
    draw.rectangle([20, 80, 40, 100], outline=(50, 50, 50), width=2)
    draw.line([22, 90, 30, 98], fill=(50, 50, 50), width=2)
    draw.line([30, 98, 42, 80], fill=(50, 50, 50), width=2)
    draw.text((50, 82), "I agree to receive marketing emails", fill=(30, 30, 30))
    draw.rectangle([20, 120, 40, 140], outline=(50, 50, 50), width=2)
    draw.line([22, 130, 30, 138], fill=(50, 50, 50), width=2)
    draw.line([30, 138, 42, 120], fill=(50, 50, 50), width=2)
    draw.text((50, 122), "Share my data with partners", fill=(30, 30, 30))
    return img


def _make_hidden_unsubscribe_image(size: Tuple[int, int] = (224, 224)) -> Image.Image:
    """Generate a synthetic image simulating a hidden unsubscribe link."""
    img = Image.new("RGB", size, color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    # Prominent subscribe button
    draw.rectangle([30, 60, 190, 100], fill=(0, 120, 212))
    draw.text((60, 72), "Subscribe Now!", fill=(255, 255, 255))
    # Tiny hidden unsubscribe text at bottom
    draw.text((5, 210), "unsubscribe", fill=(220, 220, 220))
    return img


def _make_misleading_cta_image(size: Tuple[int, int] = (224, 224)) -> Image.Image:
    """Generate a synthetic image with misleading CTA color patterns."""
    img = Image.new("RGB", size, color=(250, 250, 250))
    draw = ImageDraw.Draw(img)
    # Bad action: bright color
    draw.rectangle([20, 80, 200, 120], fill=(255, 69, 0))
    draw.text((50, 95), "Yes! Enroll Me Now", fill=(255, 255, 255))
    # Good action: gray, hard to see
    draw.rectangle([20, 140, 200, 170], fill=(200, 200, 200))
    draw.text((60, 150), "No thanks", fill=(190, 190, 190))
    return img


def _make_small_print_image(size: Tuple[int, int] = (224, 224)) -> Image.Image:
    """Generate a synthetic image with small print placement."""
    img = Image.new("RGB", size, color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.rectangle([20, 40, 200, 80], fill=(0, 120, 212))
    draw.text((50, 55), "Apply for Card", fill=(255, 255, 255))
    # Small print at bottom
    tiny_text = "* rates 24.99% APR fees apply auto-renewal subject to terms"
    draw.text((5, 215), tiny_text, fill=(180, 180, 180))
    return img


def _make_clean_image(size: Tuple[int, int] = (224, 224)) -> Image.Image:
    """Generate a clean synthetic UI image with no dark patterns."""
    img = Image.new("RGB", size, color=(248, 249, 250))
    draw = ImageDraw.Draw(img)
    draw.rectangle([20, 60, 200, 100], fill=(52, 168, 83))
    draw.text((55, 75), "Continue to Account", fill=(255, 255, 255))
    draw.rectangle([20, 120, 200, 150], outline=(100, 100, 100), width=1)
    draw.text((55, 130), "Cancel", fill=(80, 80, 80))
    return img


_GENERATORS = {
    "pre_checked_consent": _make_pre_checked_consent_image,
    "hidden_unsubscribe": _make_hidden_unsubscribe_image,
    "misleading_cta_color": _make_misleading_cta_image,
    "small_print_placement": _make_small_print_image,
    "clean": _make_clean_image,
}


class SyntheticCVDataset(TorchDataset):
    """PyTorch dataset of synthetically generated UI dark pattern images.

    Args:
        samples_per_class: Number of images to generate per label.
        image_size: Target image dimensions.
        augment: Whether to apply random augmentation.
    """

    def __init__(
        self,
        samples_per_class: int = 50,
        image_size: Tuple[int, int] = (224, 224),
        augment: bool = True,
    ) -> None:
        """Initialize the dataset by generating synthetic samples."""
        self.samples: List[Tuple[Image.Image, List[float]]] = []
        self.transform = self._build_transform(image_size, augment)

        for label in CV_LABELS:
            generator = _GENERATORS[label]
            label_vec = [0.0] * len(CV_LABELS)
            label_vec[CV_LABEL2ID[label]] = 1.0

            for _ in range(samples_per_class):
                img = generator(image_size)
                # Add slight noise
                arr = np.array(img).astype(float)
                noise = np.random.normal(0, 5, arr.shape)
                arr = np.clip(arr + noise, 0, 255).astype(np.uint8)
                self.samples.append((Image.fromarray(arr), label_vec))

        random.shuffle(self.samples)

    def _build_transform(self, image_size, augment: bool):
        """Build the torchvision transform pipeline."""
        ops = [transforms.Resize(image_size), transforms.ToTensor()]
        if augment:
            ops = [
                transforms.Resize(image_size),
                transforms.RandomHorizontalFlip(),
                transforms.ColorJitter(brightness=0.2, contrast=0.2),
                transforms.ToTensor(),
            ]
        ops.append(transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]))
        return transforms.Compose(ops)

    def __len__(self) -> int:
        """Return the number of samples in the dataset."""
        return len(self.samples)

    def __getitem__(self, idx: int) -> Tuple:
        """Return a single (tensor, label_vector) pair."""
        import torch

        img, label_vec = self.samples[idx]
        return self.transform(img), torch.tensor(label_vec, dtype=torch.float32)
