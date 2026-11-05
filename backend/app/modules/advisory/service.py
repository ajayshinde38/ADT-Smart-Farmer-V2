from datetime import datetime, timezone
from uuid import UUID
import math
from app.farmers import service as farmer_service
from app.farmers.context import resolve_crop_context
from app.modules.advisory.schemas import AdvisoryResponse,SoilNutrientStatus,RDFRecommendation
from app.modules.advisory.stcr_engine import calculate_stcr_rdf,HA_TO_ACRE
from app.modules.advisory.fertigation import SEASON_TARGETS
from app.modules.advisory.weekly_scheduler import STAGES_SPLIT
from app.modules.advisory.fertinex import plan, season_context, SEASONS
from app.modules.advisory.fertinex_schedule import get_farm_fertigation_schedule
from app.farmers.context import as_date


def measured(value):
    if value is None or isinstance(value,bool):return None
    try:
        number=float(value)
        return number if math.isfinite(number) and number>=0 else None
    except (ValueError,TypeError):return None


def get_farm_advisory(farm_id, planning_inputs=None):
    farm=farmer_service.get_farm_by_id(farm_id)
    if not farm:return None
    if planning_inputs:
        farm={**farm,**planning_inputs}
    soil=farm.get('soil') or {}
    values={key:measured(soil.get(key)) for key in ('ph','ec','oc','nitrogen_kg_ha','phosphorus_kg_ha','potassium_kg_ha')}
    if values['ph'] is not None and values['ph']>14:values['ph']=None
    if values['oc'] is not None and values['oc']>10:values['oc']=None
    needed=('oc','nitrogen_kg_ha','phosphorus_kg_ha','potassium_kg_ha')
    missing=[key for key in needed if values[key] is None]
    crop=resolve_crop_context(farm)
    season,season_source=season_context(farm.get('crop_season'),as_date(farm.get('plantation_date')))
    recorded_target=measured(farm.get('target_yield_ton_ha'))
    target=recorded_target or (SEASONS[season][0] if season else 250.0)
    target_source='farm_record' if recorded_target else 'season_reference' if season else 'reference_assumption'
    area=float(farm['area_acre'])
    rdf=None
    totals=None
    raw=None
    assumptions=['STCR and bounded seasonal targets are adapted from the supplied FertiNex reference; local field validation is not established.',
        'Organic manure is estimated from soil organic carbon, not a recorded application.',
        'N/P/K reference output units require local agronomist confirmation of phosphorus/potassium oxide basis.',
        'FertiNex bounds 80% of raw STCR to 80–120% of its seasonal per-acre standard. Raw STCR and bounded targets are shown separately.',
        'Remaining quantities require confirmed applied N, P2O5 and K2O in kg/acre. An elapsed schedule date is never an application record.']
    if target_source=='reference_assumption':assumptions.append('250 t/ha is a reference yield scenario, not a recorded farm target.')
    if not missing:
        raw=calculate_stcr_rdf(values['oc'],values['nitrogen_kg_ha'],values['phosphorus_kg_ha'],values['potassium_kg_ha'],expected_yield_ton_ha=target)
        values['organic_manure_ton_ha']=raw['organic_manure_ton_ha']
        values['organic_manure_ton_acre']=raw['organic_manure_ton_acre']
        rdf=RDFRecommendation(**{key:value for key,value in raw.items() if key in ('expected_yield_ton_ha','rdf_n_kg_ha','rdf_p_kg_ha','rdf_k_kg_ha','rdf_n_kg_acre','rdf_p_kg_acre','rdf_k_kg_acre')})
        totals={key:round(getattr(rdf,'rdf_'+key.lower()+'_kg_acre')*area,2) for key in ('N','P','K')}
    fertinex=plan(farm,raw,measured)
    fertigation_schedule=get_farm_fertigation_schedule(farm)
    from app.modules.weather.service import get_cached_farm_weather
    weather=get_cached_farm_weather(farm_id)
    from app.farmers.context import build_field_context
    weather_context=build_field_context(farm,weather=weather)['weather']
    rain=weather.forecast_7_day[0].rainfall_mm if weather and weather.forecast_7_day and weather_context['fresh'] else None
    return AdvisoryResponse(farm_id=UUID(str(farm['farm_id'])),farmer_id=UUID(str(farm['farmer_id'])),farmer_name=farm['name'],area_acres=area,
        soil_status=SoilNutrientStatus(**values),rdf=rdf,weekly_schedules=[],
        schedule=fertigation_schedule,
        planning={
        'generated_at':datetime.now(timezone.utc).isoformat(),'status':'reference_estimate' if rdf else 'missing_inputs',
        'missing_inputs':missing+(['plantation_date'] if not crop['plantation_date'] else []), 'crop':crop,
        'target_yield_ton_ha':target,'target_source':target_source,'nutrient_totals_kg':totals,'assumptions':assumptions,
        'fertinex':fertinex,
        'fertigation_schedule':fertigation_schedule,
        'product_prescription_available':bool(fertinex['schedule']),'application_history_available':fertinex['application_history_available'],
        'reference_stage_splits':[{'stage':s['stage_name'],'days':s['days_range'],'N_percent':s['n_pct']*100,'P_percent':s['p_pct']*100,'K_percent':s['k_pct']*100} for s in STAGES_SPLIT],
        'calendar_schedule_available':bool(fertinex['schedule']),'rainfall_today_forecast_mm':rain,
        'weather_guidance':'Review application timing with an agronomist; forecast rain may affect field access and nutrient losses.' if rain is not None and rain>=10 else 'Check local soil moisture and rainfall before any application.',
        'weather_note':'Forecast is used only as a field-work timing cue. Nutrient totals are not arbitrarily reduced by rainfall or satellite indices.'})
