"""S3 / local filesystem storage client with automatic fallback."""

import os
import uuid
from pathlib import Path
from typing import Optional

import structlog

from app.config import get_settings

logger = structlog.get_logger(__name__)


def _ensure_local_dir(subdir: str) -> Path:
    """Create local storage subdirectory if it doesn't exist."""
    settings = get_settings()
    path = Path(settings.local_storage_dir) / subdir
    path.mkdir(parents=True, exist_ok=True)
    return path


async def upload_bytes(data: bytes, key: str, content_type: str = "application/octet-stream") -> str:
    """Upload raw bytes to S3 or local storage.

    Args:
        data: Raw bytes to store.
        key: Storage key / filename (without leading slash).
        content_type: MIME type of the object.

    Returns:
        URI string pointing to the stored object.
    """
    settings = get_settings()

    if settings.use_local_storage or not settings.aws_access_key_id:
        subdir = str(Path(key).parent)
        local_dir = _ensure_local_dir(subdir)
        file_path = local_dir / Path(key).name
        file_path.write_bytes(data)
        logger.info("Stored locally", path=str(file_path))
        return f"local://{file_path}"
    else:
        import boto3

        s3 = boto3.client(
            "s3",
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
            region_name=settings.aws_region,
        )
        s3.put_object(
            Bucket=settings.s3_bucket,
            Key=key,
            Body=data,
            ContentType=content_type,
        )
        uri = f"s3://{settings.s3_bucket}/{key}"
        logger.info("Stored on S3", uri=uri)
        return uri


async def download_bytes(uri: str) -> bytes:
    """Download bytes from a URI (local:// or s3://).

    Args:
        uri: URI returned by upload_bytes.

    Returns:
        Raw bytes of the stored object.
    """
    if uri.startswith("local://"):
        path = Path(uri[len("local://"):])
        return path.read_bytes()
    elif uri.startswith("s3://"):
        import boto3

        settings = get_settings()
        parts = uri[5:].split("/", 1)
        bucket, key = parts[0], parts[1]
        s3 = boto3.client(
            "s3",
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
            region_name=settings.aws_region,
        )
        response = s3.get_object(Bucket=bucket, Key=key)
        return response["Body"].read()
    else:
        raise ValueError(f"Unknown URI scheme: {uri}")


def generate_key(prefix: str, extension: str) -> str:
    """Generate a unique storage key.

    Args:
        prefix: Path prefix (e.g., 'screenshots', 'reports').
        extension: File extension without leading dot (e.g., 'png', 'pdf').

    Returns:
        A unique key string.
    """
    return f"{prefix}/{uuid.uuid4()}.{extension}"
