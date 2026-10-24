from fastapi import APIRouter, HTTPException, Path, Depends
from uuid import UUID

from app.modules.weather.schemas import WeatherOverviewResponse, IrrigationAdvisory
from app.modules.weather import service
from app.farmers import service as farmer_service
from app.core.security import require_authorized_farmer, verify_farm_ownership

router = APIRouter(prefix="/weather", tags=["Weather & Forecast"])


@router.get("/overview/{farm_id}", response_model=WeatherOverviewResponse)
async def get_farm_weather_overview(farm_id: UUID, caller_id: UUID = Depends(require_authorized_farmer)):
    """
    Get current weather metrics, 7-day forecast, ET0, VPD, sugarcane GDD,
    and single-Kc deterministic irrigation recommendations.
    Protected by farm ownership authorization.
    """
    farm = farmer_service.get_farm_by_id(farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail="Farm location not found")
    if caller_id and not verify_farm_ownership(farm, caller_id):
        raise HTTPException(status_code=403, detail="Forbidden: You are not authorized to view this farm's weather advisory")

    try:
        data = await service.get_farm_weather_overview(farm_id)
    except Exception:
        raise HTTPException(status_code=503, detail='Weather is temporarily unavailable. Please try again.')
    if not data:
        raise HTTPException(status_code=404, detail="Weather data could not be computed for this farm")
    return data
