from fastapi import APIRouter, HTTPException, Path, Depends
from typing import List
from uuid import UUID

from app.farmers.schemas import FarmerDetail, FarmBase, SoilAnalysisData
from app.farmers import service
from app.core.security import require_authorized_farmer, verify_farm_ownership

router = APIRouter(prefix="/farmers", tags=["Farmers & Farms"])


@router.get("", response_model=List[dict])
def list_farmers(caller_id: UUID = Depends(require_authorized_farmer)):
    """
    List authorized farmer profiles for the authenticated caller.
    Privacy enforcement: Normal farmers can ONLY see their own profile
    (and family profiles sharing their verified phone number).
    Unrestricted access to all 25 records is prevented to safeguard farmer privacy.
    """
    caller_farmer = service.get_farmer_by_id(caller_id)
    if not caller_farmer:
        raise HTTPException(status_code=404, detail="Farmer profile not found")

    caller_phone = str(caller_farmer.get("mobile", "")).strip().replace(" ", "").replace("+91", "")
    if caller_phone:
        # Return profiles linked to the caller's verified mobile number (self + family members)
        authorized_profiles = service.get_farmers_by_phone(caller_phone)
        if authorized_profiles:
            return authorized_profiles

    return [caller_farmer]


@router.get("/{farmer_id}", response_model=dict)
def get_farmer(farmer_id: UUID, caller_id: UUID = Depends(require_authorized_farmer)):
    """
    Get single farmer details by canonical UUID with ownership authorization.
    Rejects cross-farmer unauthorized snooping with 403 Forbidden.
    """
    if caller_id and str(caller_id) != str(farmer_id):
        # Allow access only if caller shares the household phone number (family account)
        caller_farmer = service.get_farmer_by_id(caller_id)
        target_farmer = service.get_farmer_by_id(farmer_id)
        caller_phone = str(caller_farmer.get("mobile", "")).strip().replace(" ", "").replace("+91", "") if caller_farmer else ""
        target_phone = str(target_farmer.get("mobile", "")).strip().replace(" ", "").replace("+91", "") if target_farmer else ""
        if not (caller_phone and caller_phone == target_phone):
            raise HTTPException(status_code=403, detail="Forbidden: You can only access your own farmer profile")

    farmer = service.get_farmer_by_id(farmer_id)
    if not farmer:
        raise HTTPException(status_code=404, detail="Farmer not found")
    return farmer


@router.get("/by-phone/{phone}", response_model=List[dict])
def get_farmers_by_phone(phone: str, caller_id: UUID = Depends(require_authorized_farmer)):
    """
    Retrieve profiles associated with phone. Caller must be authenticated and own the phone number.
    Rejects unauthorized enumeration attempts.
    """
    caller_farmer = service.get_farmer_by_id(caller_id)
    if not caller_farmer:
        raise HTTPException(status_code=404, detail="Farmer profile not found")

    clean_target = phone.strip().replace(" ", "").replace("+91", "")
    clean_caller_phone = str(caller_farmer.get("mobile", "")).strip().replace(" ", "").replace("+91", "")

    if clean_target != clean_caller_phone:
        raise HTTPException(status_code=403, detail="Forbidden: You cannot query profiles for other mobile numbers")

    farmers = service.get_farmers_by_phone(clean_target)
    if not farmers:
        raise HTTPException(status_code=404, detail="No farmers registered for this mobile number")
    return farmers


@router.get("/farms/{farm_id}", response_model=dict)
def get_farm(farm_id: UUID, caller_id: UUID = Depends(require_authorized_farmer)):
    """Retrieve farm details, boundaries, and metrics with ownership authorization."""
    farm = service.get_farm_by_id(farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    if caller_id and not verify_farm_ownership(farm, caller_id):
        raise HTTPException(status_code=403, detail="Forbidden: You do not own this farm record")
    return farm


@router.get("/farms/{farm_id}/soil", response_model=dict)
def get_farm_soil(farm_id: UUID, caller_id: UUID = Depends(require_authorized_farmer)):
    """Retrieve laboratory soil test analysis results for the farm plot with authorization."""
    farm = service.get_farm_by_id(farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    if caller_id and not verify_farm_ownership(farm, caller_id):
        raise HTTPException(status_code=403, detail="Forbidden: You do not have access to this farm's soil analysis")

    soil = service.get_farmer_soil_data(farm_id)
    if not soil:
        raise HTTPException(status_code=404, detail="Soil test data not available for this farm")
    return soil


@router.get("/dashboard/{farm_id}", response_model=dict)
async def get_farm_dashboard(farm_id: UUID, caller_id: UUID = Depends(require_authorized_farmer)):
    """
    Unified Dashboard aggregating GIS, Weather, Soil Health, and Fertilizer
    via direct in-process Python calls with ownership authorization.
    """
    farm = service.get_farm_by_id(farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail="Farm record not found")
    if caller_id and not verify_farm_ownership(farm, caller_id):
        raise HTTPException(status_code=403, detail="Forbidden: You do not have access to this farm dashboard")

    from app.farmers import dashboard
    data = await dashboard.get_unified_farm_dashboard(farm_id)
    return data
