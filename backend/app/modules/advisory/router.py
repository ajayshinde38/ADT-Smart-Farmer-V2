from fastapi import APIRouter, HTTPException, Path, Depends
from uuid import UUID

from app.modules.advisory.schemas import AdvisoryResponse
from app.modules.advisory import service
from app.farmers import service as farmer_service
from app.core.security import require_authorized_farmer, verify_farm_ownership

router = APIRouter(prefix="/advisory", tags=["Soil Health & Fertilizer Advisory"])


@router.get("/farm/{farm_id}", response_model=AdvisoryResponse)
def get_farm_soil_and_fertilizer_advisory(farm_id: UUID, caller_id: UUID = Depends(require_authorized_farmer)):
    """
    Get STCR fertilizer recommendation (N, P, K), basal dose, and 4-stage
    weekly fertigation schedule for the given farm.
    Protected by farm ownership authorization.
    """
    farm = farmer_service.get_farm_by_id(farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail="Farm or soil test data not found")
    if caller_id and not verify_farm_ownership(farm, caller_id):
        raise HTTPException(status_code=403, detail="Forbidden: You are not authorized to view this farm's soil advisory")

    data = service.get_farm_advisory(farm_id)
    if not data:
        raise HTTPException(status_code=404, detail="Soil test data not found for this farm")
    return data
