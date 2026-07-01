"""pytest configuration and shared fixtures."""

import pytest


def pytest_configure(config):
    """Register custom pytest marks."""
    config.addinivalue_line("markers", "asyncio: mark test as async")


# pytest-asyncio configuration
pytest_plugins = ["pytest_asyncio"]
