from datetime import datetime, timedelta, timezone
from typing import Optional, Any
from uuid import UUID
import jwt
from fastapi import Header, HTTPException, status
from app.core.config import settings

def create_access_token(subject: str | Any, expires_delta: Optional[timedelta] = None) -> str:
    if settings.ENVIRONMENT!='development' and (len(settings.JWT_SECRET)<32 or settings.JWT_SECRET=='adt-smart-farmer-v2-dev-secret-key-change-in-production'):
        raise HTTPException(503,'Production farmer signing key must be configured before sign-in.')
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except Exception:
        return None

def get_current_farmer_id(authorization: Optional[str] = Header(None)) -> Optional[UUID]:
    """Extract authenticated farmer UUID from Bearer token."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ")[1]
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        return None
    try:
        return UUID(payload["sub"])
    except Exception:
        return None

def require_authorized_farmer(authorization: Optional[str] = Header(None)) -> UUID:
    """Enforces authentication and returns caller farmer UUID."""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token required. Please sign in."
        )
    caller_id = get_current_farmer_id(authorization)
    if not caller_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token. Please sign in again."
        )
    return caller_id

def verify_farm_ownership(farm: dict, caller_id: UUID) -> bool:
    """
    Ensure the caller has ownership or authorization for this specific farm.
    Allows access if:
    1. caller_id matches farm.farmer_id directly, OR
    2. caller shares the same verified household mobile number (family account).
    """
    if not farm:
        return False
    farm_farmer_id = str(farm.get("farmer_id"))
    if farm_farmer_id == str(caller_id):
        return True

    # Check family household sharing by mobile number
    from app.farmers import service as farmer_service
    caller_farmer = farmer_service.get_farmer_by_id(caller_id)
    if caller_farmer and caller_farmer.get("mobile"):
        caller_mobile = str(caller_farmer["mobile"]).strip().replace(" ", "").replace("+91", "")
        farm_mobile = str(farm.get("mobile", "")).strip().replace(" ", "").replace("+91", "")
        if caller_mobile and farm_mobile and caller_mobile == farm_mobile:
            return True

    return False
