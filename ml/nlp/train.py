"""Fine-tune Legal-BERT for multi-label T&C dark pattern classification."""

from __future__ import annotations

import argparse
import json
import os
from typing import List

import numpy as np
import torch
from datasets import Dataset
from sklearn.metrics import f1_score
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
    Trainer,
    TrainingArguments,
)

from nlp.dataset import load_dataset
from nlp.labels import NLP_ID2LABEL, NLP_LABEL2ID, NLP_LABELS

MODEL_NAME = "nlpaueb/legal-bert-base-uncased"
OUTPUT_DIR = "weights/nlp_model"
MAX_LENGTH = 512


def tokenize_function(examples: dict, tokenizer) -> dict:
    """Tokenize a batch of examples.

    Args:
        examples: Batch dict with 'text' and 'labels' keys.
        tokenizer: HuggingFace tokenizer.

    Returns:
        Dict with input_ids, attention_mask, labels as float tensors.
    """
    result = tokenizer(
        examples["text"],
        padding="max_length",
        max_length=MAX_LENGTH,
        truncation=True,
    )
    result["labels"] = [list(map(float, lbl)) for lbl in examples["labels"]]
    return result


def compute_metrics(eval_pred) -> dict:
    """Compute micro F1 score for multi-label classification.

    Args:
        eval_pred: Tuple of (logits, labels) arrays.

    Returns:
        Dict with 'f1' key.
    """
    logits, labels = eval_pred
    probs = torch.sigmoid(torch.tensor(logits)).numpy()
    preds = (probs >= 0.5).astype(int)
    f1 = f1_score(labels, preds, average="micro", zero_division=0)
    return {"f1": f1}


def train(epochs: int = 5, batch_size: int = 8, dry_run: bool = False) -> None:
    """Fine-tune Legal-BERT on the dark pattern classification task.

    Args:
        epochs: Number of training epochs.
        batch_size: Per-device training batch size.
        dry_run: If True, run only 1 step to verify the pipeline.
    """
    print(f"Loading tokenizer: {MODEL_NAME}")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)

    print("Loading dataset...")
    train_ds, val_ds = load_dataset(split=0.8)

    tokenized_train = train_ds.map(
        lambda ex: tokenize_function(ex, tokenizer), batched=True
    )
    tokenized_val = val_ds.map(
        lambda ex: tokenize_function(ex, tokenizer), batched=True
    )

    print(f"Loading model: {MODEL_NAME}")
    model = AutoModelForSequenceClassification.from_pretrained(
        MODEL_NAME,
        num_labels=len(NLP_LABELS),
        problem_type="multi_label_classification",
        id2label=NLP_ID2LABEL,
        label2id=NLP_LABEL2ID,
    )

    training_args = TrainingArguments(
        output_dir=OUTPUT_DIR,
        num_train_epochs=1 if dry_run else epochs,
        max_steps=1 if dry_run else -1,
        per_device_train_batch_size=batch_size,
        per_device_eval_batch_size=batch_size,
        evaluation_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="f1",
        logging_dir=os.path.join(OUTPUT_DIR, "logs"),
        logging_steps=10,
        fp16=torch.cuda.is_available(),
        report_to="none",
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized_train,
        eval_dataset=tokenized_val,
        compute_metrics=compute_metrics,
    )

    print("Starting training...")
    trainer.train()

    print(f"Saving model to {OUTPUT_DIR}")
    trainer.save_model(OUTPUT_DIR)
    tokenizer.save_pretrained(OUTPUT_DIR)
    print("Training complete.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fine-tune Legal-BERT for dark pattern classification")
    parser.add_argument("--epochs", type=int, default=5)
    parser.add_argument("--batch-size", type=int, default=8)
    parser.add_argument("--dry-run", action="store_true", help="Run 1 step to verify pipeline")
    args = parser.parse_args()
    train(epochs=args.epochs, batch_size=args.batch_size, dry_run=args.dry_run)
