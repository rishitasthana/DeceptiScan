"""Application configuration using pydantic-settings."""

from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All application settings, loaded from environment / .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── App ───────────────────────────────────────────────
    app_env: str = "development"
    log_level: str = "INFO"
    cors_origins: List[str] = ["*"]

    # ── MongoDB ───────────────────────────────────────────
    mongo_uri: str = "mongodb://localhost:27017"
    mongo_db: str = "darkpattern"

    # ── Redis / Celery ────────────────────────────────────
    redis_url: str = "redis://localhost:6379/0"

    # ── Pinecone ──────────────────────────────────────────
    pinecone_api_key: str = ""
    pinecone_environment: str = "us-east-1-aws"
    pinecone_index: str = "darkpattern-clauses"

    # ── ChromaDB (local fallback) ─────────────────────────
    use_local_vector_db: bool = True
    chroma_persist_dir: str = "./chroma_db"

    # ── AWS S3 ────────────────────────────────────────────
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "us-east-1"
    s3_bucket: str = "darkpattern-screenshots"

    # ── Local storage fallback ────────────────────────────
    use_local_storage: bool = True
    local_storage_dir: str = "./local_storage"

    # ── ML Model paths ────────────────────────────────────
    nlp_model_path: str = "../ml/weights/nlp_model"
    cv_model_path: str = "../ml/weights/cv_model"

    # ── Score fusion ──────────────────────────────────────
    nlp_weight: float = Field(default=0.6, ge=0.0, le=1.0)
    cv_weight: float = Field(default=0.4, ge=0.0, le=1.0)

    # ── Auth ──────────────────────────────────────────────
    admin_api_key: str = "dev-secret-change-me"
    jwt_secret: str = "super-secret-key-change-me"


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings singleton."""
    return Settings()
