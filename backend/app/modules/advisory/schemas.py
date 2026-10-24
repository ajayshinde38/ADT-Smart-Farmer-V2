from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from uuid import UUID


class SoilNutrientStatus(BaseModel):
    ph: float
    ec: float
    oc: float
    nitrogen_kg_ha: float
    phosphorus_kg_ha: float
    potassium_kg_ha: float
    organic_manure_ton_ha: float
    organic_manure_ton_acre: float


class BasalDoseBreakdown(BaseModel):
    fertilizer_selected: str
    organic_manure_ton_acre: float
    basal_n_kg_acre: float
    basal_p_kg_acre: float
    basal_k_kg_acre: float
    items: Dict[str, Any]


class RDFRecommendation(BaseModel):
    expected_yield_ton_ha: float = 250.0
    rdf_n_kg_ha: float
    rdf_p_kg_ha: float
    rdf_k_kg_ha: float
    rdf_n_kg_acre: float
    rdf_p_kg_acre: float
    rdf_k_kg_acre: float
    basal_dose: BasalDoseBreakdown
    final_fertigation_n_kg_acre: float
    final_fertigation_p_kg_acre: float
    final_fertigation_k_kg_acre: float


class WeeklyStageScheduleItem(BaseModel):
    stage_name: str
    days_range: str
    duration_days: int
    target_n_kg_acre: float
    target_p_kg_acre: float
    target_k_kg_acre: float
    fertilizers_recommended: List[Dict[str, Any]]
    dose_per_day: str
    status: str = "Matched"


class AdvisoryResponse(BaseModel):
    farm_id: UUID
    farmer_id: UUID
    farmer_name: str
    area_acres: float
    soil_status: SoilNutrientStatus
    rdf: RDFRecommendation
    weekly_schedules: List[WeeklyStageScheduleItem] = []
