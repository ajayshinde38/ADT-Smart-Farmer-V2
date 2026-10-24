from typing import Optional, Dict, Any
from uuid import UUID

from app.farmers import service as farmer_service
from app.farmers.context import build_field_context
import logging
from app.modules.gis import service as gis_service
from app.modules.weather import service as weather_service
from app.modules.advisory import service as advisory_service


async def get_unified_farm_dashboard(farm_id: UUID | str) -> Optional[Dict[str, Any]]:
    """
    Direct in-process orchestration of all 4 modules:
    1. GIS Satellite Vegetation Health
    2. Weather & Irrigation Physics
    3. Soil Health & Fertilizer Advisory
    4. Pest & Disease Catalog Status
    NO HTTP calls between modules!
    """
    farm = farmer_service.get_farm_by_id(farm_id)
    if not farm:
        return None
        
    farmer_id = farm["farmer_id"]
    
    # In-process call to GIS
    gis_data = gis_service.get_farm_plot_gis(farm_id)
    
    # In-process call to Weather
    try:
        weather_data = await weather_service.get_farm_weather_overview(farm_id)
    except Exception as error:
        logging.getLogger(__name__).warning('Weather unavailable for dashboard: %s', type(error).__name__)
        weather_data = None
    
    # In-process call to Soil & Fertilizer Advisory
    advisory_data = advisory_service.get_farm_advisory(farm_id)
    
    return {
        "farmer_id": farmer_id,
        "farm_id": farm_id,
        "farmer_name": farm["name"],
        "mobile": farm["mobile"],
        "village": farm["address"].split("Tq.")[0].strip(),
        "area_acres": farm["area_acre"],
        "crop_name": farm.get("crop_name", "Sugarcane"),
        "crop_variety": farm.get("crop_variety"),
        "field_context": build_field_context(farm, gis_data, weather_data),
        "gis": gis_data.dict() if gis_data else None,
        "weather": weather_data.dict() if weather_data else None,
        "advisory": advisory_data.dict() if advisory_data else None,
    }
