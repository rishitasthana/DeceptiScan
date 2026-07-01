"""NLP dark pattern label definitions."""

NLP_LABELS = [
    "fee_burial",
    "auto_renewal_trap",
    "urgency_language",
    "ambiguous_opt_out",
    "misleading_free",
    "clean",
]

NLP_LABEL2ID = {label: i for i, label in enumerate(NLP_LABELS)}
NLP_ID2LABEL = {i: label for i, label in enumerate(NLP_LABELS)}

# Severity weight per label (used for score fusion)
NLP_LABEL_SEVERITY = {
    "fee_burial": 0.9,
    "auto_renewal_trap": 0.85,
    "urgency_language": 0.6,
    "ambiguous_opt_out": 0.75,
    "misleading_free": 0.8,
    "clean": 0.0,
}
