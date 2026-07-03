"""
Fine-tune Legal-BERT for ShieldCheck dark pattern detection.
Usage:
  python train_nlp.py              # full training
  python train_nlp.py --dry_run   # quick test with 1 epoch
"""

import argparse
import json
import os

import numpy as np
import torch
from datasets import load_dataset
from sklearn.metrics import f1_score
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
    EarlyStoppingCallback,
    Trainer,
    TrainingArguments,
)

# ── Must match NLPLabel enum in nlp_service.py exactly ───────────────────────
LABELS = [
    "fee_burial",
    "auto_renewal_trap",
    "urgency_language",
    "ambiguous_opt_out",
    "misleading_free",
    "clean",
]
NUM_LABELS = len(LABELS)
BASE_MODEL = "nlpaueb/legal-bert-base-uncased"
DATA_DIR   = "./data"
OUTPUT_DIR = "./weights/nlp_model"


# ── Tokenisation ──────────────────────────────────────────────────────────────

def preprocess(examples, tokenizer):
    batch = tokenizer(
        examples["text"],
        padding="max_length",
        truncation=True,
        max_length=512,
    )
    # Convert labels to float list — required for BCEWithLogitsLoss
    batch["labels"] = [
        [float(l) for l in label_list]
        for label_list in examples["labels"]
    ]
    return batch


# ── Metrics ───────────────────────────────────────────────────────────────────

def compute_metrics(eval_pred):
    logits, labels = eval_pred
    probs = torch.sigmoid(torch.tensor(logits)).numpy()
    preds = (probs >= 0.5).astype(int)
    labels = np.array(labels).astype(int)

    f1_macro = f1_score(labels, preds, average="macro", zero_division=0)
    f1_per   = f1_score(labels, preds, average=None,    zero_division=0)

    metrics = {"f1_macro": f1_macro}
    for label, score in zip(LABELS, f1_per):
        metrics[f"f1_{label}"] = round(float(score), 4)
    return metrics


# ── Custom Trainer to fix Float/Long label dtype issue ────────────────────────

class MultiLabelTrainer(Trainer):
    """
    Overrides compute_loss to ensure labels are always float32.
    This fixes: RuntimeError: result type Float can't be cast to Long
    """
    def compute_loss(self, model, inputs, return_outputs=False, **kwargs):
        # Force labels to float32 right before the forward pass
        if "labels" in inputs:
            inputs["labels"] = inputs["labels"].float()

        outputs = model(**inputs)
        loss = outputs.loss

        return (loss, outputs) if return_outputs else loss


# ── Main ──────────────────────────────────────────────────────────────────────

def main(args):
    print(f"\n{'='*50}")
    print(f"  ShieldCheck NLP Training")
    print(f"  Mode: {'DRY RUN' if args.dry_run else 'FULL TRAINING'}")
    print(f"{'='*50}\n")

    # 1. Load dataset
    dataset = load_dataset(
        "json",
        data_files={
            "train": f"{DATA_DIR}/train.jsonl",
            "val":   f"{DATA_DIR}/val.jsonl",
        },
    )
    print(f"Train examples : {len(dataset['train'])}")
    print(f"Val examples   : {len(dataset['val'])}\n")

    # 2. Load tokenizer
    print(f"Loading tokenizer from {BASE_MODEL}...")
    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)

    # 3. Tokenize datasets
    tokenized = dataset.map(
        lambda b: preprocess(b, tokenizer),
        batched=True,
        remove_columns=["text"],
    )
    # Set format to torch tensors
    tokenized.set_format("torch", columns=["input_ids", "attention_mask", "token_type_ids", "labels"])

    # 4. Load model configured for multi-label classification
    print(f"Loading model from {BASE_MODEL}...")
    model = AutoModelForSequenceClassification.from_pretrained(
        BASE_MODEL,
        num_labels=NUM_LABELS,
        problem_type="multi_label_classification",  # uses BCEWithLogitsLoss
        ignore_mismatched_sizes=True,               # suppresses id2label warning
    )

    # 5. Training arguments
    training_args = TrainingArguments(
        output_dir=OUTPUT_DIR,
        num_train_epochs=1 if args.dry_run else args.epochs,
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=args.batch_size,
        learning_rate=2e-5,
        weight_decay=0.01,
        eval_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="f1_macro",
        greater_is_better=True,
        logging_steps=5,
        save_total_limit=2,
        fp16=False,                    # CPU safe
        report_to="none",              # no W&B
        dataloader_pin_memory=False,   # suppresses pin_memory warning on CPU
    )

    # 6. Use custom trainer that fixes the Float/Long dtype issue
    trainer = MultiLabelTrainer(
        model=model,
        args=training_args,
        train_dataset=tokenized["train"],
        eval_dataset=tokenized["val"],
        compute_metrics=compute_metrics,
        callbacks=[EarlyStoppingCallback(early_stopping_patience=2)],
    )

    # 7. Train
    print("\nStarting training...\n")
    trainer.train()

    # 8. Save model + tokenizer + label map
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    trainer.save_model(OUTPUT_DIR)
    tokenizer.save_pretrained(OUTPUT_DIR)

    label_map = {str(i): label for i, label in enumerate(LABELS)}
    with open(os.path.join(OUTPUT_DIR, "label_map.json"), "w") as f:
        json.dump(label_map, f, indent=2)

    # 9. Final results
    print(f"\n{'='*50}")
    print(f"  Training complete!")
    print(f"  Model saved to: {OUTPUT_DIR}")
    print(f"{'='*50}\n")

    metrics = trainer.evaluate()
    print("Final evaluation metrics:")
    for k, v in metrics.items():
        if isinstance(v, float):
            print(f"  {k:35s}: {v:.4f}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs",     type=int, default=5)
    parser.add_argument("--batch_size", type=int, default=8)
    parser.add_argument("--dry_run",    action="store_true")
    main(parser.parse_args())