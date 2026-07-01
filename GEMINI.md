# Project: Dark Pattern Detector for Financial Products

## Stack
- Backend: FastAPI (Python 3.11), MongoDB, Pinecone, Redis, Celery
- ML: HuggingFace Transformers, PyTorch, scikit-learn
- Frontend extension: Vanilla JS, Manifest V3 Chrome extension
- Admin UI: React + Vite

## Rules
- Always use async/await in FastAPI endpoints
- All API responses must follow { data, error, status_code } shape
- Use Pydantic v2 models for all request/response validation
- MongoDB collections: products, flags, community_reports, users, scan_history
- Environment variables must go in .env — never hardcode secrets
- Write a docstring for every function
- After building any endpoint, write a test in /backend/tests/
- Use Python type hints everywhere