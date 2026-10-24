from typing import Optional, Dict, Any
from uuid import UUID

from app.farmers import service as farmer_service
from app.modules.advisory.schemas import AdvisoryResponse, SoilNutrientStatus, RDFRecommendation, BasalDoseBreakdown, WeeklyStageScheduleItem
from app.modules.advisory.stcr_engine import calculate_stcr_rdf, calculate_organic_manure
from app.modules.advisory.weekly_scheduler import generate_weekly_schedule


def get_farm_advisory(farm_id: UUID | str) -> Optional[AdvisoryResponse]:
    """
    Direct internal Python function calculating Sugarcane STCR fertilizer advisory
    and weekly fertigation split based on the farm's soil analysis.
    """
    farm = farmer_service.get_farm_by_id(farm_id)
    if not farm:
        return None
        
    soil = farm.get("soil", {})
    oc = float(soil.get("oc", 0.55))
    n = float(soil.get("nitrogen_kg_ha", 180.0))
    p = float(soil.get("phosphorus_kg_ha", 22.0))
    k = float(soil.get("potassium_kg_ha", 290.0))
    
    rdf_dict = calculate_stcr_rdf(oc, n, p, k)
    weekly_schedules_raw = generate_weekly_schedule(
        fert_n=rdf_dict["final_fertigation_n_kg_acre"],
        fert_p=rdf_dict["final_fertigation_p_kg_acre"],
        fert_k=rdf_dict["final_fertigation_k_kg_acre"],
    )
    
    soil_status = SoilNutrientStatus(
        ph=float(soil.get("ph", 7.5)),
        ec=float(soil.get("ec", 0.35)),
        oc=oc,
        nitrogen_kg_ha=n,
        phosphorus_kg_ha=p,
        potassium_kg_ha=k,
        organic_manure_ton_ha=rdf_dict["organic_manure_ton_ha"],
        organic_manure_ton_acre=rdf_dict["organic_manure_ton_acre"]
    )
    
    basal = BasalDoseBreakdown(**rdf_dict["basal_dose"])
    
    rdf_rec = RDFRecommendation(
        expected_yield_ton_ha=rdf_dict["expected_yield_ton_ha"],
        rdf_n_kg_ha=rdf_dict["rdf_n_kg_ha"],
        rdf_p_kg_ha=rdf_dict["rdf_p_kg_ha"],
        rdf_k_kg_ha=rdf_dict["rdf_k_kg_ha"],
        rdf_n_kg_acre=rdf_dict["rdf_n_kg_acre"],
        rdf_p_kg_acre=rdf_dict["rdf_p_kg_acre"],
        rdf_k_kg_acre=rdf_dict["rdf_k_kg_acre"],
        basal_dose=basal,
        final_fertigation_n_kg_acre=rdf_dict["final_fertigation_n_kg_acre"],
        final_fertigation_p_kg_acre=rdf_dict["final_fertigation_p_kg_acre"],
        final_fertigation_k_kg_acre=rdf_dict["final_fertigation_k_kg_acre"]
    )
    
    weekly_items = [WeeklyStageScheduleItem(**item) for item in weekly_schedules_raw]

    return AdvisoryResponse(
        farm_id=UUID(farm["farm_id"]),
        farmer_id=UUID(farm["farmer_id"]),
        farmer_name=farm["name"],
        area_acres=float(farm["area_acre"]),
        soil_status=soil_status,
        rdf=rdf_rec,
        weekly_schedules=weekly_items
    )
