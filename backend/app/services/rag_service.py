"""RAG service: clause embedding search using Pinecone/ChromaDB + context retrieval."""

from __future__ import annotations

from typing import List

import structlog

from app import pinecone_client

logger = structlog.get_logger(__name__)

_embedder = None


def _get_embedder():
    """Lazy-load the Legal-BERT tokenizer/model for encoding queries."""
    global _embedder
    if _embedder is not None:
        return _embedder

    try:
        from transformers import AutoModel, AutoTokenizer
        import torch

        model_name = "nlpaueb/legal-bert-base-uncased"
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        model = AutoModel.from_pretrained(model_name)
        model.eval()
        _embedder = (tokenizer, model)
        logger.info("RAG embedder loaded")
    except Exception as exc:
        logger.warning("Could not load embedder; RAG unavailable", error=str(exc))
        _embedder = None

    return _embedder


def _encode_text(text: str) -> List[float]:
    """Encode text to a 768-dim CLS vector using Legal-BERT.

    Args:
        text: Input query or clause.

    Returns:
        List of 768 floats.
    """
    import torch

    pair = _get_embedder()
    if pair is None:
        # Return a zero vector as fallback
        return [0.0] * 768

    tokenizer, model = pair
    inputs = tokenizer(text, return_tensors="pt", max_length=512, truncation=True, padding=True)
    with torch.no_grad():
        outputs = model(**inputs)
    cls_vector = outputs.last_hidden_state[:, 0, :].squeeze().tolist()
    return cls_vector


async def index_clauses(texts: List[str], metadata: List[dict] | None = None) -> None:
    """Encode and upsert clauses into the vector store.

    Args:
        texts: List of clause texts to index.
        metadata: Optional list of metadata dicts (e.g. scan_id, domain).
    """
    embeddings = [_encode_text(t) for t in texts]
    pinecone_client.upsert_clauses(embeddings, texts, metadata)
    logger.info("Indexed clauses", count=len(texts))


async def query_similar_clauses(query: str, top_k: int = 5) -> List[dict]:
    """Find clauses semantically similar to the query.

    Args:
        query: Natural-language question or clause snippet.
        top_k: Number of similar clauses to return.

    Returns:
        List of dicts with 'text', 'score', 'metadata'.
    """
    embedding = _encode_text(query)
    results = pinecone_client.query_clauses(embedding, top_k=top_k)
    logger.info("RAG query executed", query=query[:50], results=len(results))
    return results
