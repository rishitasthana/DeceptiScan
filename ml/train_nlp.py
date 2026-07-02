import torch
from datasets import load_dataset
from transformers import (
    AutoTokenizer, 
    AutoModelForSequenceClassification, 
    TrainingArguments, 
    Trainer
)

# 1. Define labels to match your backend expectations
LABELS = [
    "fee_burial", "auto_renewal_trap", "urgency_language", 
    "ambiguous_opt_out", "misleading_free", "clean"
]
num_labels = len(LABELS)

# 2. Load the base Legal-BERT model
model_name = "nlpaueb/legal-bert-base-uncased"
tokenizer = AutoTokenizer.from_pretrained(model_name)

# Ensure problem_type is set for multi-label classification (BCEWithLogitsLoss)
model = AutoModelForSequenceClassification.from_pretrained(
    model_name, 
    num_labels=num_labels,
    problem_type="multi_label_classification"
)

# 3. Load and tokenize your dataset
# Pointing to the data directory you created
dataset = load_dataset("json", data_files={"train": "data/train.jsonl", "val": "data/val.jsonl"})

def preprocess_function(examples):
    # Tokenize the text
    batch = tokenizer(examples["text"], padding="max_length", truncation=True, max_length=512)
    # Ensure labels are floats for the multi-label loss function
    batch["labels"] = [ [float(l) for l in label_list] for label_list in examples["labels"] ]
    return batch

tokenized_dataset = dataset.map(preprocess_function, batched=True)

# 4. Define Training Arguments
# Output will go to the weights directory
training_args = TrainingArguments(
    output_dir="./weights",
    evaluation_strategy="epoch",
    learning_rate=2e-5,
    per_device_train_batch_size=8,
    per_device_eval_batch_size=8,
    num_train_epochs=3,
    weight_decay=0.01,
    save_strategy="epoch",
    load_best_model_at_end=True,
)

# 5. Train the model
trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=tokenized_dataset["train"],
    eval_dataset=tokenized_dataset["val"],
    tokenizer=tokenizer,
)

trainer.train()

# 6. Save the final model in a format the backend can load
trainer.save_model("./weights/trained_legal_bert")
