"""Synthetic seed dataset for NLP dark pattern classifier training."""

from __future__ import annotations

from typing import List, Tuple

from datasets import Dataset

from nlp.labels import NLP_LABELS, NLP_LABEL2ID

# ── Synthetic labeled T&C clauses ─────────────────────────────────────────────
# Format: (text, [positive_labels])

SEED_DATA: List[Tuple[str, List[str]]] = [
    # fee_burial
    ("A maintenance fee of $12.99 per month will be applied, as described in Appendix B, subsection 4(c).", ["fee_burial"]),
    ("Refer to Schedule of Fees, available upon written request, for applicable service charges.", ["fee_burial"]),
    ("Foreign transaction fees are disclosed in the supplemental rate and fee schedule.", ["fee_burial"]),
    ("Interest charges are calculated using the Average Daily Balance method as described in section 14.", ["fee_burial"]),
    ("Additional fees may apply for paper statements. See fee schedule for details.", ["fee_burial"]),
    ("Late payment fees up to $39 are disclosed in the Cardholder Agreement appendix.", ["fee_burial"]),
    ("Cash advance fees of 5% or $10 minimum are outlined in Exhibit A.", ["fee_burial"]),
    ("Annual membership fee of $95 is charged in the first billing cycle after account opening.", ["fee_burial"]),

    # auto_renewal_trap
    ("Your subscription will automatically renew at the end of each billing period.", ["auto_renewal_trap"]),
    ("Cancel your plan at least 30 days prior to renewal to avoid the next charge.", ["auto_renewal_trap"]),
    ("By continuing to use the service, you agree to automatic annual renewal.", ["auto_renewal_trap"]),
    ("Renewal charges are non-refundable after the billing date.", ["auto_renewal_trap"]),
    ("Your free trial automatically converts to a paid subscription unless cancelled.", ["auto_renewal_trap"]),
    ("We will charge your payment method on file unless you notify us in writing.", ["auto_renewal_trap"]),
    ("Plans renew monthly; cancellation must be received 7 days before billing.", ["auto_renewal_trap"]),
    ("Automatic renewal is enabled by default. To disable, contact customer service.", ["auto_renewal_trap"]),

    # urgency_language
    ("This offer expires tonight at midnight — act now to secure your rate!", ["urgency_language"]),
    ("Limited time offer: only 3 spots remaining at this special APR.", ["urgency_language"]),
    ("Apply within the next 24 hours to lock in this promotional rate.", ["urgency_language"]),
    ("Offer valid today only — rates subject to change without notice.", ["urgency_language"]),
    ("Hurry! This introductory APR is available to new applicants this month only.", ["urgency_language"]),
    ("Last chance: 0% APR balance transfer offer ends this Sunday.", ["urgency_language"]),
    ("Act immediately to avoid missing your chance at these exclusive rates.", ["urgency_language"]),
    ("Only 48 hours left to take advantage of this zero-fee promotional period.", ["urgency_language"]),

    # ambiguous_opt_out
    ("Uncheck this box if you do not wish to not receive marketing communications.", ["ambiguous_opt_out"]),
    ("To opt out of data sharing, contact us at optout@company.com within 60 days.", ["ambiguous_opt_out"]),
    ("Unless you indicate otherwise, you consent to receiving promotional offers.", ["ambiguous_opt_out"]),
    ("By not responding, you agree to allow sharing of your data with partners.", ["ambiguous_opt_out"]),
    ("Deselect the checked box below to remove yourself from future email lists.", ["ambiguous_opt_out"]),
    ("Your participation in rewards is presumed unless you call to cancel.", ["ambiguous_opt_out"]),
    ("You may opt out at any time by submitting a written request to our privacy team.", ["ambiguous_opt_out"]),
    ("Marketing preferences can be changed by navigating to Settings > Privacy > Advanced.", ["ambiguous_opt_out"]),

    # misleading_free
    ("Get your first month free when you sign up — no credit card required for trial.", ["misleading_free"]),
    ("Free checking account — no monthly fee when conditions are met.", ["misleading_free"]),
    ("Complimentary travel insurance included at no extra cost with qualifying purchases.", ["misleading_free"]),
    ("Zero annual fee for the first year; $95 fee applies from year two.", ["misleading_free"]),
    ("Free ATM withdrawals at in-network ATMs; $3.50 fee applies at all others.", ["misleading_free"]),
    ("No-cost balance transfers for new cardholders; 3% fee applies after 60 days.", ["misleading_free"]),
    ("Free credit score monitoring included, subject to enrollment in paperless billing.", ["misleading_free"]),
    ("Introductory offer: free for 12 months; standard rate applies thereafter.", ["misleading_free"]),

    # clean
    ("You may close your account at any time by contacting customer service.", ["clean"]),
    ("Interest is charged at a fixed rate of 18.99% APR.", ["clean"]),
    ("Your credit limit is determined based on your creditworthiness.", ["clean"]),
    ("Payments received by 5 PM ET on the due date are credited same day.", ["clean"]),
    ("You are not responsible for unauthorized charges reported promptly.", ["clean"]),
    ("The grace period for purchases is 21 days from the statement date.", ["clean"]),
    ("Your account information is protected using 256-bit encryption.", ["clean"]),
    ("Disputes must be submitted within 60 days of the statement date.", ["clean"]),
    ("You will receive a statement each billing cycle showing all transactions.", ["clean"]),
    ("Minimum payment due is the greater of $25 or 2% of your outstanding balance.", ["clean"]),

    # Multi-label examples
    ("This free trial auto-renews — act now, offer ends soon!", ["misleading_free", "auto_renewal_trap", "urgency_language"]),
    ("Fees are buried in section 22. Cancel or you'll be charged automatically.", ["fee_burial", "auto_renewal_trap"]),
    ("Uncheck to not opt out of data sharing. Offer expires tonight!", ["ambiguous_opt_out", "urgency_language"]),
]


def build_multi_hot(labels: List[str]) -> List[float]:
    """Convert a list of label strings to a multi-hot float vector.

    Args:
        labels: List of positive label strings.

    Returns:
        Multi-hot float vector of length len(NLP_LABELS).
    """
    vec = [0.0] * len(NLP_LABELS)
    for lbl in labels:
        if lbl in NLP_LABEL2ID:
            vec[NLP_LABEL2ID[lbl]] = 1.0
    return vec


def load_dataset(split: float = 0.8) -> Tuple[Dataset, Dataset]:
    """Load the synthetic seed dataset split into train and validation sets.

    Args:
        split: Fraction of data to use for training.

    Returns:
        Tuple of (train_dataset, val_dataset).
    """
    texts = [item[0] for item in SEED_DATA]
    labels = [build_multi_hot(item[1]) for item in SEED_DATA]

    split_idx = int(len(texts) * split)
    train_data = {"text": texts[:split_idx], "labels": labels[:split_idx]}
    val_data = {"text": texts[split_idx:], "labels": labels[split_idx:]}

    return Dataset.from_dict(train_data), Dataset.from_dict(val_data)
