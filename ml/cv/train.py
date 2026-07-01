"""Fine-tune ResNet-50 for multi-label UI dark pattern screenshot classification."""

from __future__ import annotations

import argparse
import os

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, random_split
from torchvision.models import ResNet50_Weights, resnet50

from cv.dataset import SyntheticCVDataset
from cv.labels import CV_LABELS

OUTPUT_DIR = "weights/cv_model"
NUM_CLASSES = len(CV_LABELS)


def build_model(freeze_backbone: bool = True) -> nn.Module:
    """Build a ResNet-50 model with a custom multi-label classification head.

    Args:
        freeze_backbone: If True, only the final FC layer is trained initially.

    Returns:
        ResNet-50 model with replaced FC head.
    """
    model = resnet50(weights=ResNet50_Weights.IMAGENET1K_V2)

    if freeze_backbone:
        for param in model.parameters():
            param.requires_grad = False

    # Replace the final fully connected layer
    in_features = model.fc.in_features
    model.fc = nn.Sequential(
        nn.Dropout(0.3),
        nn.Linear(in_features, NUM_CLASSES),
    )
    return model


def train(
    epochs: int = 10,
    batch_size: int = 16,
    lr: float = 1e-3,
    samples_per_class: int = 50,
    dry_run: bool = False,
    unfreeze_after: int = 5,
) -> None:
    """Train ResNet-50 on synthetic CV dark pattern data.

    Args:
        epochs: Total training epochs.
        batch_size: Mini-batch size.
        lr: Initial learning rate.
        samples_per_class: Number of synthetic images per label.
        dry_run: If True, run only 1 batch to verify the pipeline.
        unfreeze_after: Epoch after which backbone is unfrozen for fine-tuning.
    """
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Training on: {device}")

    dataset = SyntheticCVDataset(samples_per_class=samples_per_class, augment=not dry_run)
    val_size = max(1, int(len(dataset) * 0.2))
    train_size = len(dataset) - val_size
    train_ds, val_ds = random_split(dataset, [train_size, val_size])

    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=batch_size)

    model = build_model(freeze_backbone=True).to(device)
    criterion = nn.BCEWithLogitsLoss()
    optimizer = torch.optim.Adam(filter(lambda p: p.requires_grad, model.parameters()), lr=lr)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)

    best_val_loss = float("inf")
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    for epoch in range(1 if dry_run else epochs):
        # Unfreeze backbone after warm-up
        if epoch == unfreeze_after and not dry_run:
            print(f"Epoch {epoch}: Unfreezing backbone for full fine-tuning")
            for param in model.parameters():
                param.requires_grad = True
            optimizer = torch.optim.Adam(model.parameters(), lr=lr * 0.1)

        model.train()
        train_loss = 0.0

        for batch_idx, (images, labels) in enumerate(train_loader):
            images, labels = images.to(device), labels.to(device)
            optimizer.zero_grad()
            logits = model(images)
            loss = criterion(logits, labels)
            loss.backward()
            optimizer.step()
            train_loss += loss.item()

            if dry_run:
                print(f"Dry run batch loss: {loss.item():.4f}")
                break

        if not dry_run:
            # Validation
            model.eval()
            val_loss = 0.0
            with torch.no_grad():
                for images, labels in val_loader:
                    images, labels = images.to(device), labels.to(device)
                    val_loss += criterion(model(images), labels).item()

            avg_val_loss = val_loss / len(val_loader)
            scheduler.step()
            print(f"Epoch {epoch + 1}/{epochs} — Train Loss: {train_loss / len(train_loader):.4f}, Val Loss: {avg_val_loss:.4f}")

            if avg_val_loss < best_val_loss:
                best_val_loss = avg_val_loss
                torch.save(model.state_dict(), os.path.join(OUTPUT_DIR, "cv_model.pt"))
                print(f"  ✓ Saved best model (val_loss={avg_val_loss:.4f})")

    if dry_run:
        torch.save(model.state_dict(), os.path.join(OUTPUT_DIR, "cv_model.pt"))
        print("Dry run complete — model saved.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fine-tune ResNet-50 for CV dark pattern classification")
    parser.add_argument("--epochs", type=int, default=10)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--samples-per-class", type=int, default=50)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    train(
        epochs=args.epochs,
        batch_size=args.batch_size,
        lr=args.lr,
        samples_per_class=args.samples_per_class,
        dry_run=args.dry_run,
    )
