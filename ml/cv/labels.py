"""CV dark pattern label definitions."""

CV_LABELS = [
    "pre_checked_consent",
    "hidden_unsubscribe",
    "misleading_cta_color",
    "small_print_placement",
    "clean",
]

CV_LABEL2ID = {label: i for i, label in enumerate(CV_LABELS)}
CV_ID2LABEL = {i: label for i, label in enumerate(CV_LABELS)}

CV_LABEL_SEVERITY = {
    "pre_checked_consent": 0.9,
    "hidden_unsubscribe": 0.85,
    "misleading_cta_color": 0.7,
    "small_print_placement": 0.75,
    "clean": 0.0,
}
