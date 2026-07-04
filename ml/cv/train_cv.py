"""
Fine-tune ResNet-50 for UI dark pattern detection.
Usage:
  python train_cv.py              # full training
  python train_cv.py --dry_run   # quick test with 2 epochs
"""

import argparse
import copy
import json
import os

import torch
import torch.nn as nn
import torch.optim as optim
from PIL import Image
from sklearn.metrics import classification_report, f1_score
from torch.utils.data import DataLoader, Dataset, random_split
from torchvision import models, transforms

print("Script started!")  # debug line

# ── Config ────────────────────────────────────────────────────────────────────

CLASSES = [
    "pre_checked_consent",
    "hidden_unsubscribe",
    "misleading_cta_color",
    "small_print_placement",
    "clean",
]
NUM_CLASSES = len(CLASSES)
DATA_DIR    = "./data/augmented"
OUTPUT_DIR  = "./weights/cv_model"
IMG_SIZE    = 224
DEVICE      = torch.device("cuda" if torch.cuda.is_available() else "cpu")


# ── Dataset ───────────────────────────────────────────────────────────────────

class ScreenshotDataset(Dataset):
    def __init__(self, data_dir, transform=None):
        self.samples   = []
        self.transform = transform

        for label_idx, cls in enumerate(CLASSES):
            cls_dir = os.path.join(data_dir, cls)
            if not os.path.exists(cls_dir):
                print(f"Warning: folder not found — {cls_dir}")
                continue
            for fname in os.listdir(cls_dir):
                if fname.lower().endswith((".png", ".jpg", ".jpeg")):
                    self.samples.append((
                        os.path.join(cls_dir, fname),
                        label_idx,
                    ))

        print(f"Dataset loaded: {len(self.samples)} total images")

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        path, label = self.samples[idx]
        img = Image.open(path).convert("RGB")
        if self.transform:
            img = self.transform(img)
        return img, label


# ── Transforms ────────────────────────────────────────────────────────────────

train_transform = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.RandomHorizontalFlip(),
    transforms.ColorJitter(brightness=0.2, contrast=0.2),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406],
                         [0.229, 0.224, 0.225]),
])

val_transform = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406],
                         [0.229, 0.224, 0.225]),
])


# ── Evaluate ──────────────────────────────────────────────────────────────────

def evaluate(model, loader):
    model.eval()
    all_preds, all_labels = [], []
    with torch.no_grad():
        for imgs, labels in loader:
            imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
            outputs = model(imgs)
            preds   = outputs.argmax(dim=1)
            all_preds.extend(preds.cpu().numpy())
            all_labels.extend(labels.cpu().numpy())
    f1 = f1_score(all_labels, all_preds, average="macro", zero_division=0)
    return f1, all_preds, all_labels


# ── Main ──────────────────────────────────────────────────────────────────────

def main(args):
    print(f"\n{'='*50}")
    print(f"  ShieldCheck CV Training")
    print(f"  Device : {DEVICE}")
    print(f"  Mode   : {'DRY RUN' if args.dry_run else 'FULL TRAINING'}")
    print(f"{'='*50}\n")

    # 1. Dataset
    full_dataset = ScreenshotDataset(DATA_DIR, transform=train_transform)

    if len(full_dataset) == 0:
        print("ERROR: No images found in", DATA_DIR)
        print("Make sure augment.py has been run first.")
        return

    # Train / val split 85/15
    val_size   = max(1, int(0.15 * len(full_dataset)))
    train_size = len(full_dataset) - val_size
    train_ds, val_ds = random_split(full_dataset, [train_size, val_size])
    val_ds.dataset.transform = val_transform

    train_loader = DataLoader(train_ds, batch_size=args.batch_size,
                              shuffle=True,  num_workers=0, pin_memory=False)
    val_loader   = DataLoader(val_ds,   batch_size=args.batch_size,
                              shuffle=False, num_workers=0, pin_memory=False)

    print(f"Train: {train_size} | Val: {val_size}\n")

    # 2. Model
    print("Loading ResNet-50 (pretrained)...")
    model = models.resnet50(weights=models.ResNet50_Weights.IMAGENET1K_V1)

    # Freeze all layers
    for param in model.parameters():
        param.requires_grad = False

    # Replace final layer
    model.fc = nn.Sequential(
        nn.Dropout(0.3),
        nn.Linear(model.fc.in_features, NUM_CLASSES),
    )
    model = model.to(DEVICE)

    # 3. Loss + optimizer
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.fc.parameters(), lr=args.lr)
    scheduler = optim.lr_scheduler.StepLR(optimizer, step_size=3, gamma=0.5)

    # 4. Training
    best_f1    = 0.0
    best_model = None
    epochs     = 2 if args.dry_run else args.epochs

    for epoch in range(1, epochs + 1):
        model.train()
        running_loss = 0.0
        correct = 0
        total   = 0

        for batch_idx, (imgs, labels) in enumerate(train_loader):
            imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
            optimizer.zero_grad()
            outputs = model(imgs)
            loss    = criterion(outputs, labels)
            loss.backward()
            optimizer.step()

            running_loss += loss.item()
            preds    = outputs.argmax(dim=1)
            correct += (preds == labels).sum().item()
            total   += labels.size(0)

            if (batch_idx + 1) % 5 == 0 or (batch_idx + 1) == len(train_loader):
                print(f"  Epoch {epoch}/{epochs} "
                      f"Step {batch_idx+1}/{len(train_loader)} "
                      f"Loss: {running_loss/(batch_idx+1):.4f} "
                      f"Acc: {correct/total:.4f}")

        val_f1, _, _ = evaluate(model, val_loader)
        print(f"\nEpoch {epoch} → Val F1: {val_f1:.4f}\n")

        if val_f1 > best_f1:
            best_f1    = val_f1
            best_model = copy.deepcopy(model.state_dict())

        scheduler.step()

        # Unfreeze all layers after epoch 3
        if epoch == 3 and not args.dry_run:
            print("Unfreezing all layers for fine-tuning...\n")
            for param in model.parameters():
                param.requires_grad = True
            optimizer = optim.Adam(model.parameters(), lr=args.lr * 0.1)

    # 5. Save
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    torch.save(best_model, os.path.join(OUTPUT_DIR, "resnet50.pt"))

    class_map = {str(i): cls for i, cls in enumerate(CLASSES)}
    with open(os.path.join(OUTPUT_DIR, "class_map.json"), "w") as f:
        json.dump(class_map, f, indent=2)

    print(f"\n{'='*50}")
    print(f"  Training complete!")
    print(f"  Best Val F1 : {best_f1:.4f}")
    print(f"  Saved to    : {OUTPUT_DIR}/resnet50.pt")
    print(f"{'='*50}\n")

    # 6. Final report
    model.load_state_dict(best_model)
    _, preds, labels = evaluate(model, val_loader)
    print("Per-class report:")
    print(classification_report(labels, preds, target_names=CLASSES, zero_division=0))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs",     type=int,   default=10)
    parser.add_argument("--batch_size", type=int,   default=16)
    parser.add_argument("--lr",         type=float, default=1e-3)
    parser.add_argument("--dry_run",    action="store_true")
    main(parser.parse_args())