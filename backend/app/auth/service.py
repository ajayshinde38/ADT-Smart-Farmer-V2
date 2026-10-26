import logging
import httpx
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime, timezone, timedelta
from app.farmers import service as farmer_service
from app.core.security import create_access_token, decode_access_token
from app.auth.schemas import FarmerProfileSummary, AuthResponse
from app.core.config import settings

logger = logging.getLogger(__name__)

# Temporary in-memory OTP challenges for development/verification
_OTP_STORE: Dict[str, Dict[str, Any]] = {}
DEFAULT_DEV_OTP = "123456"


def send_otp_challenge(phone: str) -> Dict[str, Any]:
    """
    Step 1: Initiate Phone OTP challenge.
    When Supabase Auth is connected, triggers supabase.auth.sign_in_with_otp().
    In local/dev environment, issues a test OTP (123456).
    """
    clean_phone = phone.strip().replace(" ", "").replace("+91", "")
    farmers = farmer_service.get_farmers_by_phone(clean_phone)
    if not farmers:
        return {"success": False, "message": "Mobile number not registered in KVK farmer registry"}

    # In development mode, register the test OTP challenge
    is_dev = (settings.ENVIRONMENT == "development" and settings.DEBUG is True)
    
    if not is_dev:
        try:
            key=settings.SUPABASE_PUBLISHABLE_KEY or settings.SUPABASE_KEY
            if not key or not settings.SUPABASE_URL.startswith('https://'):
                return {'success':False,'message':'SMS authentication is not configured.'}
            response=httpx.post(settings.SUPABASE_URL.rstrip('/')+'/auth/v1/otp',headers={'apikey':key},
                json={'phone':'+91'+clean_phone,'create_user':False},timeout=12)
            if response.status_code not in (200,201):
                return {'success':False,'message':'SMS verification could not be sent. Contact ADT support.'}
        except httpx.HTTPError:
            return {'success':False,'message':'SMS identity service is unavailable.'}
    _OTP_STORE[clean_phone] = {
        "otp": DEFAULT_DEV_OTP if is_dev else None,
        'provider':'development' if is_dev else 'supabase',
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10)
    }

    logger.info('Verification challenge generated (development=%s)',is_dev)
    
    hint = "Use test OTP '123456' in development mode" if is_dev else "SMS verification code dispatched via carrier"
    return {
        "success": True,
        "phone": clean_phone,
        "message": "OTP verification code sent successfully.",
        "dev_hint": hint
    }


def verify_otp_and_authenticate(phone: str, otp: str) -> AuthResponse:
    """
    Step 2: Verify OTP code before issuing access tokens.
    Protects against unauthorized account hijacking by mobile number enumeration.
    Enforces that deterministic OTP is strictly disabled outside development environment.
    """
    clean_phone = phone.strip().replace(" ", "").replace("+91", "")
    challenge = _OTP_STORE.get(clean_phone)
    
    is_dev = (settings.ENVIRONMENT == "development" and settings.DEBUG is True)

    is_valid_otp = False
    if not is_dev and challenge and challenge.get('provider')=='supabase' and datetime.now(timezone.utc)<=challenge['expires_at']:
        try:
            response=httpx.post(settings.SUPABASE_URL.rstrip('/')+'/auth/v1/verify',headers={'apikey':settings.SUPABASE_PUBLISHABLE_KEY or settings.SUPABASE_KEY},json={'phone':'+91'+clean_phone,'token':otp,'type':'sms'},timeout=12)
            user=response.json().get('user',{}) if response.status_code==200 else {}
            is_valid_otp=str(user.get('phone','')).replace('+91','')==clean_phone
        except (httpx.HTTPError,ValueError):
            pass
    # Only allow DEFAULT_DEV_OTP if explicitly in local development environment
    if is_dev and otp == DEFAULT_DEV_OTP:
        is_valid_otp = True
    elif is_dev and challenge and challenge.get("otp") and challenge.get("otp") == otp:
        if datetime.now(timezone.utc) <= challenge.get("expires_at", datetime.min.replace(tzinfo=timezone.utc)):
            is_valid_otp = True

    if not is_valid_otp:
        return AuthResponse(
            access_token=None,
            is_multi_profile=False,
            profiles=[],
            message="Invalid or expired verification OTP."
        )

    # Clean up OTP after use
    _OTP_STORE.pop(clean_phone, None)

    farmers = farmer_service.get_farmers_by_phone(clean_phone)
    if not farmers:
        return AuthResponse(
            access_token=None,
            is_multi_profile=False,
            profiles=[],
            message="No farmer records found for this number"
        )
        
    profiles: List[FarmerProfileSummary] = []
    for f in farmers:
        profiles.append(FarmerProfileSummary(
            farmer_id=UUID(f["farmer_id"]),
            name=f["name"],
            mobile=f["mobile"],
            prn=f.get("prn"),
            village=f.get("address", "").split("Tq.")[0].strip(),
            farm_id=UUID(f["farm_id"]) if f.get("farm_id") else None,
            farm_area_acres=f.get("area_acre")
        ))
        
    if len(profiles) == 1:
        selected = profiles[0]
        token = create_access_token(subject=str(selected.farmer_id))
        return AuthResponse(
            access_token=token,
            is_multi_profile=False,
            profiles=profiles,
            selected_farmer=selected,
            message="Phone verified and logged in successfully"
        )
    else:
        # Multiple family profiles share this verified mobile phone
        # Issue a temporary selection token verifying that the phone was indeed authenticated
        select_token = create_access_token(
            subject=f"phone_verified:{clean_phone}",
            expires_delta=timedelta(minutes=15)
        )
        return AuthResponse(
            access_token=select_token,
            is_multi_profile=True,
            profiles=profiles,
            selected_farmer=None,
            message="Phone verified. Multiple family accounts found. Please choose profile."
        )


def select_profile(phone: str, farmer_id: UUID, verification_token: Optional[str] = None) -> Optional[AuthResponse]:
    """
    Step 3: Select and activate an authorized family account sharing the verified phone number.
    Strictly verifies that farmer_id belongs to the verified phone number to prevent arbitrary impersonation.
    """
    clean_phone = phone.strip().replace(" ", "").replace("+91", "")

    # If verification_token is provided, ensure it matches phone_verified
    if not verification_token:
        return None
    if verification_token:
        payload = decode_access_token(verification_token)
        if not payload or payload.get("sub") != f"phone_verified:{clean_phone}":
            logger.warning('Invalid household verification token')
            return None

    farmers = farmer_service.get_farmers_by_phone(clean_phone)
    target = None
    for f in farmers:
        if str(f["farmer_id"]) == str(farmer_id):
            target = f
            break
            
    if not target:
        # Prevent impersonation: target farmer does NOT belong to this mobile number!
        logger.warning('Unauthorized household profile selection blocked')
        return None
        
    selected = FarmerProfileSummary(
        farmer_id=UUID(target["farmer_id"]),
        name=target["name"],
        mobile=target["mobile"],
        prn=target.get("prn"),
        village=target.get("address", "").split("Tq.")[0].strip(),
        farm_id=UUID(target["farm_id"]) if target.get("farm_id") else None,
        farm_area_acres=target.get("area_acre")
    )
    token = create_access_token(subject=str(selected.farmer_id))
    return AuthResponse(
        access_token=token,
        is_multi_profile=False,
        profiles=[selected],
        selected_farmer=selected,
        message="Profile selected and authenticated"
    )
