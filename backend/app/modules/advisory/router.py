from fastapi import APIRouter, HTTPException, Path, Depends
from uuid import UUID
from pydantic import BaseModel, Field
from datetime import date
from typing import Optional, Literal, Dict, Any

from app.modules.advisory.schemas import AdvisoryResponse
from app.modules.advisory import service, compliance
from app.modules.advisory.fertinex_schedule import get_farm_fertigation_schedule
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


@router.get("/farm/{farm_id}/schedule")
def get_fertigation_schedule_endpoint(farm_id: UUID, caller_id: UUID = Depends(require_authorized_farmer)):
    """
    Returns the full FertiNex DAP schedule for this farm, including active dose and farmer visible doses.
    """
    farm = farmer_service.get_farm_by_id(farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    if caller_id and not verify_farm_ownership(farm, caller_id):
        raise HTTPException(status_code=403, detail="Forbidden")
    return get_farm_fertigation_schedule(farm)


class ConfirmScheduleRequest(BaseModel):
    period: str
    applied: bool = True
    notes: Optional[str] = None


@router.post("/farm/{farm_id}/schedule/confirm")
def confirm_schedule_dose(
    farm_id: UUID,
    payload: ConfirmScheduleRequest,
    caller_id: UUID = Depends(require_authorized_farmer)
):
    """
    Marks a scheduled fertigation dose as applied or pending.
    """
    farm = farmer_service.get_farm_by_id(farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    if caller_id and not verify_farm_ownership(farm, caller_id):
        raise HTTPException(status_code=403, detail="Forbidden")

    record = compliance.set_compliance_dose(
        farm_or_phone=str(farm_id),
        period=payload.period,
        applied=payload.applied,
        notes=payload.notes,
    )
    if farm.get("mobile"):
        compliance.set_compliance_dose(
            farm_or_phone=str(farm["mobile"]),
            period=payload.period,
            applied=payload.applied,
            notes=payload.notes,
        )

    # Return updated schedule
    updated_schedule = get_farm_fertigation_schedule(farm)
    return {
        "status": "success",
        "record": record,
        "schedule": updated_schedule,
    }


@router.get("/farm/{farm_id}/schedule/compliance")
def get_schedule_compliance(farm_id: UUID, caller_id: UUID = Depends(require_authorized_farmer)):
    """
    Returns dose application history and compliance logs for this farm.
    """
    farm = farmer_service.get_farm_by_id(farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    if caller_id and not verify_farm_ownership(farm, caller_id):
        raise HTTPException(status_code=403, detail="Forbidden")

    logs = compliance.get_compliance_for_farm(str(farm_id))
    if not logs and farm.get("mobile"):
        logs = compliance.get_compliance_for_farm(str(farm["mobile"]))
    return {"by_period": logs}


class CompositionRequest(BaseModel):
    product: str
    quantity: float = Field(gt=0, le=100000)
    unit: str = "kg"


class AppliedNutrients(BaseModel):
    N: float = Field(ge=0, le=10000, allow_inf_nan=False)
    P2O5: float = Field(ge=0, le=10000, allow_inf_nan=False)
    K2O: float = Field(ge=0, le=10000, allow_inf_nan=False)


class PlanningInputs(BaseModel):
    applied_till_date: AppliedNutrients
    crop_season: Optional[Literal["adsali", "pre-seasonal", "suru"]] = None
    plantation_date: Optional[date] = None


@router.post("/farm/{farm_id}/plan", response_model=AdvisoryResponse)
def preview_plan(farm_id: UUID, payload: PlanningInputs, caller_id: UUID = Depends(require_authorized_farmer)):
    farm = farmer_service.get_farm_by_id(farm_id)
    if not farm:
        raise HTTPException(404, "Farm not found")
    if not verify_farm_ownership(farm, caller_id):
        raise HTTPException(403, "This farm does not belong to your account")
    from app.farmers.context import local_today
    if payload.plantation_date and payload.plantation_date > local_today():
        raise HTTPException(422, "Plantation date cannot be in the future")
    inputs = payload.model_dump(exclude_none=True)
    if inputs.get("plantation_date"):
        inputs["plantation_date"] = inputs["plantation_date"].isoformat()
    return service.get_farm_advisory(farm_id, inputs)


@router.post("/farm/{farm_id}/product-composition")
def composition(farm_id: UUID, payload: CompositionRequest, caller_id: UUID = Depends(require_authorized_farmer)):
    farm = farmer_service.get_farm_by_id(farm_id)
    if not farm:
        raise HTTPException(404, "Farm not found")
    if not verify_farm_ownership(farm, caller_id):
        raise HTTPException(403, "This farm does not belong to your account")
    from app.modules.advisory.fertigation import product_nutrients
    try:
        return product_nutrients(payload.product, payload.quantity, payload.unit, float(farm["area_acre"]))
    except ValueError as error:
        raise HTTPException(422, str(error))
