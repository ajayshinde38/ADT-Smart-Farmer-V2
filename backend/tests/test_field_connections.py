import asyncio
import io
import threading
from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import UUID

import pytest
from fastapi import HTTPException, UploadFile
from PIL import Image
from app.farmers import context, dashboard
from app.modules.pest_disease import router as scans
from app.modules.pest_disease.schemas import DiseaseDetectionResponse
from app.modules.gis.sentinel import classify_crop_health

FARM = 'fa0094b2-c218-441d-bc1a-870f0a01430b'
OWNER = 'c54094b2-c218-441d-bc1a-870f0a01430b'


def test_crop_stage_uses_record_or_real_date_with_explicit_provenance():
    assert context.resolve_crop_context({}, date(2026, 10, 24))['stage'] is None
    inferred = context.resolve_crop_context({'plantation_date': '2026-09-01'}, date(2026, 10, 24))
    assert inferred == {'stage': 'Tillering', 'stage_source': 'planting_date_estimate',
                        'plantation_date': '2026-09-01', 'age_days': 53}
    recorded = context.resolve_crop_context({'growth_stage': 'Grand Growth', 'plantation_date': '2026-09-01'}, date(2026, 10, 24))
    assert recorded['stage'] == 'Grand Growth' and recorded['stage_source'] == 'recorded'
    assert context.resolve_crop_context({'plantation_date': '2999-01-01'})['age_days'] is None


def test_history_contains_only_measured_dated_values_and_never_fills_gaps():
    farm = {'gis_observations': [{'capture_date':'2020-01-01','ndvi_mean':0.4},
            {'capture_date':'2022-01-01','ndvi_mean':float('nan')},
            {'capture_date':'2999-01-01','ndvi_mean':0.9}, {'capture_date':'bad','ndvi_mean':0.7}]}
    history = context.observation_history(farm)
    assert history == [{'date':'2020-01-01','ndvi':0.4,'ndre':None,'ndmi':None}]


def test_context_rejects_mixed_farms_and_stale_or_future_weather():
    farm = {'farm_id':FARM}
    with pytest.raises(ValueError):
        context.build_field_context(farm, weather={'farm_id':OWNER})
    for delta in (-20, 20):
        stamp = datetime.now(timezone.utc) + timedelta(minutes=delta)
        result = context.build_field_context(farm, weather={'farm_id':FARM,'last_updated_utc':stamp.isoformat(),
            'current_vpd_kpa':3,'crop_watch':[{'score':100,'criteria_tested':2}]})
        assert result['weather']['fresh'] is False
        assert result['watch_count'] == 0
        assert 'drying_demand' not in [item['code'] for item in result['next_steps']]
        assert result['analysis_readiness']['biomass_tonnes'] is False


def test_context_combines_clues_without_diagnosing_nutrient_or_disease():
    now = datetime.now(timezone.utc).isoformat()
    farm = {'farm_id':FARM,'soil':{'nitrogen':100}}
    result = context.build_field_context(farm, weather={'farm_id':FARM,'last_updated_utc':now,'current_vpd_kpa':3,
        'crop_watch':[{'score':100,'criteria_tested':2,'stage_eligible':True}]})
    assert result['soil']['available'] and result['weather']['fresh']
    assert result['satellite']['available'] is False
    assert result['watch_count'] == 1
    assert {'drying_demand','scout_crop','satellite_missing'} <= {item['code'] for item in result['next_steps']}
    assert result['analysis_readiness']['nutrient_confirmation_required'] is True


def test_weather_outage_preserves_dashboard_map_and_soil(monkeypatch):
    farm = {'farm_id':FARM,'farmer_id':OWNER,'name':'Test','mobile':'0000000000','address':'Test','area_acre':1}
    monkeypatch.setattr(dashboard.farmer_service,'get_farm_by_id',lambda _:farm)
    saved_plot = {'farm_id':FARM,'indices':{'capture_date':'2020-01-01','ndvi':0.4}}
    plot = SimpleNamespace(dict=lambda:saved_plot,model_dump=lambda **_:saved_plot)
    monkeypatch.setattr(dashboard.gis_service,'get_farm_plot_gis',lambda _:plot)
    monkeypatch.setattr(dashboard.advisory_service,'get_farm_advisory',lambda _:SimpleNamespace(dict=lambda:{'available':True}))
    async def unavailable(_):
        raise TimeoutError('provider unavailable')
    monkeypatch.setattr(dashboard.weather_service,'get_farm_weather_overview',unavailable)
    result = asyncio.run(dashboard.get_unified_farm_dashboard(FARM))
    assert result['weather'] is None and result['advisory'] == {'available':True}
    assert result['gis'] == saved_plot
    assert result['field_context']['weather']['fresh'] is False


def test_ndvi_does_not_assign_crop_stage_or_prescribe_nitrogen():
    assert classify_crop_health(0.449).status == 'Moderate greenness'
    assert 'top-up' not in classify_crop_health(0.55).recommendation
    assert 'next clear orbital pass' not in classify_crop_health(None).recommendation


def test_cross_farm_scan_is_rejected_before_inference(monkeypatch):
    monkeypatch.setattr('app.farmers.service.get_farm_by_id',lambda _: {'farmer_id':OWNER})
    monkeypatch.setattr('app.core.security.verify_farm_ownership',lambda *_:False)
    def unexpected(_):
        raise AssertionError('Inference must not run')
    monkeypatch.setattr(scans.service,'diagnose_leaf_image',unexpected)
    with pytest.raises(HTTPException) as error:
        asyncio.run(scans.detect_leaf_disease(UploadFile(file=io.BytesIO(b'invalid')),UUID(FARM),UUID(OWNER)))
    assert error.value.status_code == 403


def test_bound_scan_runs_in_worker_and_survives_missing_gis(monkeypatch):
    farm = {'farm_id':FARM,'farmer_id':OWNER}
    monkeypatch.setattr('app.farmers.service.get_farm_by_id',lambda _:farm)
    monkeypatch.setattr('app.modules.weather.service.get_cached_farm_weather',lambda _:None)
    def missing(_):
        raise RuntimeError('unavailable')
    monkeypatch.setattr('app.modules.gis.service.get_farm_plot_gis',missing)
    main_thread = threading.get_ident()
    def infer(_):
        assert threading.get_ident() != main_thread
        return DiseaseDetectionResponse(detected_disease='No supported disease detected',marathi_name='',
            confidence_score=0,affected_percentage=0,severity_level='None',status='not_detected')
    monkeypatch.setattr(scans.service,'diagnose_leaf_image',infer)
    data = io.BytesIO()
    Image.new('RGB',(16,16)).save(data,format='PNG')
    data.seek(0)
    result = asyncio.run(scans.detect_leaf_disease(UploadFile(file=data),UUID(FARM),UUID(OWNER)))
    assert result.field_context['farm_id'] == FARM
    assert result.disease_details is None
