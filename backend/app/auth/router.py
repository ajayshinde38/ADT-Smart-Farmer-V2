from fastapi import APIRouter, HTTPException, Depends, Header
from typing import Optional
from uuid import UUID

from app.auth.schemas import PhoneLoginRequest, OTPVerifyRequest, ProfileSelectRequest, AuthResponse, FarmerProfileSummary
from app.auth import service
from app.core.security import decode_access_token, require_authorized_farmer
from app.farmers import service as farmer_service
from app.core.config import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/send-otp", response_model=dict)
def request_phone_otp(payload: PhoneLoginRequest):
    """
    Step 1: Request SMS verification code for registered farmer mobile number.
    In development mode, test code '123456' is provisioned.
    """
    res = service.send_otp_challenge(payload.phone)
    if not res["success"]:
        raise HTTPException(status_code=404, detail=res["message"])
    return res


@router.post("/verify-otp", response_model=AuthResponse)
def verify_phone_otp(payload: OTPVerifyRequest):
    """
    Step 2: Verify SMS OTP code to authenticate phone ownership.
    Prevents unauthorized account takeover by raw mobile number guessing.
    """
    res = service.verify_otp_and_authenticate(payload.phone, payload.otp)
    if not res.profiles:
        raise HTTPException(status_code=401, detail=res.message)
    return res


@router.post("/login", response_model=AuthResponse)
def login_with_phone(payload: PhoneLoginRequest):
    """
    Compatibility Login endpoint for development testing.
    In development mode (ENVIRONMENT='development' and DEBUG=True), auto-initiates OTP challenge.
    In production environments, this endpoint is strictly disabled to prevent unverified passwordless access.
    """
    if settings.ENVIRONMENT != "development" or not settings.DEBUG:
        raise HTTPException(
            status_code=403, 
            detail="Direct passwordless login is disabled outside development environment. Use /send-otp and /verify-otp."
        )
    res = service.verify_otp_and_authenticate(payload.phone, "123456")
    if not res.profiles:
        raise HTTPException(status_code=404, detail="Mobile number not registered in KVK farmer registry")
    return res


@router.post("/select-profile", response_model=AuthResponse)
def select_family_profile(payload: ProfileSelectRequest, authorization: Optional[str] = Header(None)):
    """
    Step 3: Choose active farmer profile when multiple family accounts share a verified phone number.
    Verifies that the target farmer belongs to the verified phone to prevent arbitrary impersonation.
    """
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]

    res = service.select_profile(payload.phone, payload.farmer_id, verification_token=token)
    if not res:
        raise HTTPException(status_code=403, detail="Forbidden: Invalid profile selection for this verified phone number")
    return res


@router.get("/me", response_model=dict)
def get_current_user_profile(caller_id: UUID = Depends(require_authorized_farmer)):
    """
    Get the currently logged in farmer profile using verified Bearer token.
    """
    farmer = farmer_service.get_farmer_by_id(caller_id)
    if not farmer:
        raise HTTPException(status_code=404, detail="Farmer record not found")
    return farmer
