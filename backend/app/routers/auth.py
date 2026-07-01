"""Authentication router: register, login, and token verification dependency."""

from __future__ import annotations

from datetime import datetime, timedelta, UTC
from typing import Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field

from app.config import get_settings
from app.database import col_users

logger = structlog.get_logger(__name__)

# Config
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class AuthRequest(BaseModel):
    """User credentials request schema."""
    email: EmailStr = Field(..., description="User's email address")
    password: str = Field(..., min_length=6, description="User's password (min 6 characters)")


class TokenData(BaseModel):
    """Token response data schema."""
    access_token: str
    token_type: str = "bearer"


class AuthResponse(BaseModel):
    """Auth response wrapper conforming to project shape."""
    data: Optional[TokenData] = None
    error: Optional[str] = None
    status_code: int = 200


# ── Helpers ───────────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    """Hash password with bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify standard bcrypt password match."""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(email: str) -> str:
    """Generate JWT access token for email subject."""
    settings = get_settings()
    expire = datetime.now(UTC) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"sub": email, "exp": expire}
    return jwt.encode(to_encode, settings.jwt_secret, algorithm=ALGORITHM)


# ── Dependency ────────────────────────────────────────────────────────────────

async def verify_token(token: Optional[str] = Depends(oauth2_scheme)) -> dict:
    """Verify the JWT token from the Authorization header.

    Args:
        token: OAuth2 bearer token.

    Returns:
        Decoded payload dict if valid.

    Raises:
        HTTPException: 401 if invalid/missing.
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization token",
        )
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
            )
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/register", response_model=AuthResponse, status_code=201)
async def register(request: AuthRequest, response: Response) -> dict:
    """Register a new user, store in DB, and return JWT token."""
    try:
        user_col = col_users()
        existing = await user_col.find_one({"email": request.email})
        if existing:
            response.status_code = status.HTTP_400_BAD_REQUEST
            return {
                "data": None,
                "error": "Email is already registered",
                "status_code": 400
            }

        hashed = hash_password(request.password)
        user_doc = {
            "email": request.email,
            "hashed_password": hashed,
            "created_at": datetime.now(UTC),
        }
        await user_col.insert_one(user_doc)
        token = create_access_token(request.email)
        return {
            "data": {"access_token": token, "token_type": "bearer"},
            "error": None,
            "status_code": 201
        }
    except Exception as exc:
        logger.error("Registration failed", error=str(exc))
        response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        return {
            "data": None,
            "error": str(exc),
            "status_code": 500
        }


@router.post("/login", response_model=AuthResponse)
async def login(request: AuthRequest, response: Response) -> dict:
    """Authenticate credentials and return JWT token."""
    try:
        user_col = col_users()
        user = await user_col.find_one({"email": request.email})
        if not user or not verify_password(request.password, user["hashed_password"]):
            response.status_code = status.HTTP_401_UNAUTHORIZED
            return {
                "data": None,
                "error": "Invalid email or password",
                "status_code": 401
            }

        token = create_access_token(request.email)
        return {
            "data": {"access_token": token, "token_type": "bearer"},
            "error": None,
            "status_code": 200
        }
    except Exception as exc:
        logger.error("Login failed", error=str(exc))
        response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        return {
            "data": None,
            "error": str(exc),
            "status_code": 500
        }
