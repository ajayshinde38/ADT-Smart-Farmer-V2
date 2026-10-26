from fastapi import APIRouter, HTTPException, Path, Depends
from uuid import UUID

from app.modules.advisory.schemas import AdvisoryResponse
from app.modules.advisory import service
from app.farmers import service as farmer_service
from app.core.security import require_authorized_farmer, verify_farm_ownership
from pydantic import BaseModel,Field

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


class CompositionRequest(BaseModel):
    product:str
    quantity:float=Field(gt=0,le=100000)
    unit:str='kg'


@router.post('/farm/{farm_id}/product-composition')
def composition(farm_id:UUID,payload:CompositionRequest,caller_id:UUID=Depends(require_authorized_farmer)):
    farm=farmer_service.get_farm_by_id(farm_id)
    if not farm:
        raise HTTPException(404,'Farm not found')
    if not verify_farm_ownership(farm,caller_id):
        raise HTTPException(403,'This farm does not belong to your account')
    from app.modules.advisory.fertigation import product_nutrients
    try:
        return product_nutrients(payload.product,payload.quantity,payload.unit,float(farm['area_acre']))
    except ValueError as error:
        raise HTTPException(422,str(error))
