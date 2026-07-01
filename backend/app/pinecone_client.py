"""In-memory vector store with cosine similarity fallback for RAG clause search.

Supports Pinecone when configured, otherwise falls back to a simple NumPy-based
in-memory store using cosine similarity — no external vector DB required.
"""

import uuid
from datetime import datetime, UTC
from typing import Any, Dict, List, Optional

import numpy as np
import structlog

from app.config import get_settings

logger = structlog.get_logger(__name__)

_vector_store: Any = None


class InMemoryVectorStore:
    """Simple in-memory vector store using cosine similarity with NumPy.

    Stores embeddings, texts, and metadata in Python lists and performs
    brute-force cosine similarity search on query.
    """

    def __init__(self) -> None:
        """Initialize empty storage lists."""
        self._ids: List[str] = []
        self._embeddings: List[List[float]] = []
        self._documents: List[str] = []
        self._metadatas: List[Dict] = []

    def upsert(
        self,
        ids: List[str],
        embeddings: List[List[float]],
        documents: List[str],
        metadatas: List[Dict],
    ) -> None:
        """Add or update embeddings in the store.

        Args:
            ids: Unique identifier per vector.
            embeddings: List of float vectors.
            documents: Raw text for each vector.
            metadatas: Metadata dicts per vector.
        """
        for i, uid in enumerate(ids):
            if uid in self._ids:
                idx = self._ids.index(uid)
                self._embeddings[idx] = embeddings[i]
                self._documents[idx] = documents[i]
                self._metadatas[idx] = metadatas[i]
            else:
                self._ids.append(uid)
                self._embeddings.append(embeddings[i])
                self._documents.append(documents[i])
                self._metadatas.append(metadatas[i])

    def query(
        self,
        query_embedding: List[float],
        n_results: int = 5,
    ) -> Dict[str, List]:
        """Find the top-n most similar documents by cosine similarity.

        Args:
            query_embedding: Query vector.
            n_results: Number of results to return.

        Returns:
            Dict with 'documents', 'distances', and 'metadatas' lists.
        """
        if not self._embeddings:
            return {"documents": [[]], "distances": [[]], "metadatas": [[]]}

        query_vec = np.array(query_embedding, dtype=np.float32)
        query_norm = np.linalg.norm(query_vec)
        if query_norm == 0:
            query_norm = 1.0

        store_mat = np.array(self._embeddings, dtype=np.float32)
        store_norms = np.linalg.norm(store_mat, axis=1)
        store_norms[store_norms == 0] = 1.0

        cosine_similarities = store_mat @ query_vec / (store_norms * query_norm)
        # Convert to distance (1 - similarity) so lower = more similar
        distances = 1.0 - cosine_similarities

        top_k = min(n_results, len(self._embeddings))
        top_indices = np.argsort(distances)[:top_k]

        return {
            "documents": [[self._documents[i] for i in top_indices]],
            "distances": [[float(distances[i]) for i in top_indices]],
            "metadatas": [[self._metadatas[i] for i in top_indices]],
        }

    @property
    def count(self) -> int:
        """Return the number of stored vectors."""
        return len(self._ids)


async def init_vector_store() -> None:
    """Initialize the vector store — Pinecone if configured, else in-memory."""
    global _vector_store
    settings = get_settings()

    if settings.pinecone_api_key:
        _vector_store = await _init_pinecone(
            settings.pinecone_api_key,
            settings.pinecone_environment,
            settings.pinecone_index,
        )
        logger.info("Using Pinecone vector store")
    else:
        _vector_store = InMemoryVectorStore()
        logger.info("Using in-memory vector store (cosine similarity)")


async def _init_pinecone(api_key: str, environment: str, index_name: str):
    """Connect to Pinecone and return the index.

    Args:
        api_key: Pinecone API key.
        environment: Pinecone environment.
        index_name: Name of the Pinecone index.

    Returns:
        Pinecone Index object.
    """
    from pinecone import Pinecone

    pc = Pinecone(api_key=api_key)
    index = pc.Index(index_name)
    return index


def upsert_clauses(
    embeddings: List[List[float]],
    texts: List[str],
    metadata: Optional[List[Dict]] = None,
) -> None:
    """Upsert clause embeddings into the active vector store.

    Args:
        embeddings: List of float vectors (dim 768).
        texts: Corresponding raw text for each embedding.
        metadata: Optional list of metadata dicts per clause.
    """
    if _vector_store is None:
        logger.warning("Vector store not initialized — skipping upsert")
        return

    settings = get_settings()
    ids = [str(uuid.uuid4()) for _ in embeddings]
    meta = metadata or [{} for _ in embeddings]

    if isinstance(_vector_store, InMemoryVectorStore):
        _vector_store.upsert(
            ids=ids,
            embeddings=embeddings,
            documents=texts,
            metadatas=meta,
        )
    else:
        # Pinecone
        vectors = [(id_, emb, m) for id_, emb, m in zip(ids, embeddings, meta)]
        _vector_store.upsert(vectors=vectors)


def query_clauses(query_embedding: List[float], top_k: int = 5) -> List[Dict]:
    """Query the vector store for similar clauses.

    Args:
        query_embedding: Query vector (dim 768).
        top_k: Number of results to return.

    Returns:
        List of dicts with 'text', 'score', and 'metadata' keys.
    """
    if _vector_store is None:
        logger.warning("Vector store not initialized — returning empty results")
        return []

    settings = get_settings()

    if isinstance(_vector_store, InMemoryVectorStore):
        results = _vector_store.query(
            query_embedding=query_embedding,
            n_results=top_k,
        )
        docs = results["documents"][0] if results["documents"] else []
        distances = results["distances"][0] if results["distances"] else []
        metas = results["metadatas"][0] if results["metadatas"] else []
        return [
            {"text": d, "score": 1 - dist, "metadata": m}
            for d, dist, m in zip(docs, distances, metas)
        ]
    else:
        # Pinecone
        response = _vector_store.query(
            vector=query_embedding, top_k=top_k, include_metadata=True
        )
        return [
            {
                "text": m["metadata"].get("text", ""),
                "score": m["score"],
                "metadata": m["metadata"],
            }
            for m in response["matches"]
        ]
