from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime


class SoilAnalysisData(BaseModel):
    ph: float = 7.5
    ec: float = 0.35
    oc: float = 0.55
    nitrogen_kg_ha: float = 180.0
    phosphorus_kg_ha: float = 22.0
    potassium_kg_ha: float = 290.0
    calcium_carbonate_pct: Optional[float] = None
    organic_carbon_rating: Optional[str] = "Medium"


class FarmBase(BaseModel):
    id: UUID
    farmer_id: UUID
    latitude: float
    longitude: float
    area_value: float
    area_unit: str = "acre"
    area_acres: float
    boundary_geojson: Optional[Dict[str, Any]] = None
    kml_object_key: Optional[str] = None
    crop_name: str = "Sugarcane"
    crop_variety: str = "Co 86032"
    growth_stage: str = "Grand Growth"
    soil_data: Optional[SoilAnalysisData] = None


class FarmerDetail(BaseModel):
    id: UUID
    name: str
    mobile: str
    prn: Optional[str] = None
    village: Optional[str] = None
    taluka: Optional[str] = None
    district: Optional[str] = None
    factory_hub: Optional[str] = None
    farms: List[FarmBase] = []
    created_at: Optional[datetime] = None
