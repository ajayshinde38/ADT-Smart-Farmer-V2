import asyncio
import io
from datetime import datetime, timedelta, timezone
from uuid import UUID

import pytest
from PIL import Image
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import create_access_token
from app.modules.gis import service as gis
from app.modules.gis.satellite_refresh import select_observation
from app.modules.pest_disease import service as scans, unet_classifier
from app.modules.pest_disease.crop_watch import build_crop_watch
from app.modules.weather import physics, service as weather
from app.modules.weather.schemas import DailyWeatherForecast

OWNER = 'c54094b2-c218-441d-bc1a-870f0a01430b'
FARM = 'fa0094b2-c218-441d-bc1a-870f0a01430b'
HEADERS = {'Authorization': f'Bearer {create_access_token(OWNER)}'}


def test_missing_and_unsorted_satellite_values_are_not_invented(monkeypatch):
    farm = {'farm_id': FARM, 'farmer_id': OWNER, 'name': 'Test', 'latitude': 19, 'longitude': 77, 'area_acre': 1,
            'gis_observations': [{'capture_date': '2020-01-01', 'ndvi_mean': 0.4},
                                 {'capture_date': '2021-01-01', 'ndvi_mean': None}]}
    monkeypatch.setattr(gis.farmer_service, 'get_farm_by_id', lambda _: farm)
    monkeypatch.setattr('app.modules.gis.satellite_refresh.cached_observation', lambda _: None)
    result = gis.get_farm_plot_gis(FARM)
    assert str(result.indices.capture_date) == '2021-01-01'
    assert result.indices.ndvi is None
    farm['gis_observations'] = [{'capture_date': 'invalid', 'ndvi_mean': 0.6}]
    assert gis.get_farm_plot_gis(FARM).indices.capture_date is None


def test_cloud_masked_statistics_reject_nodata_future_and_invalid_values():
    def row(date, value, samples=40, nodata=5):
        return {'interval': {'from': date}, 'outputs': {'NDVI': {'bands': {'B0': {'stats': {
            'mean': value, 'sampleCount': samples, 'noDataCount': nodata}}}}}}
    result = select_observation({'data': [row('2020-01-01', 0.4), row('2021-01-01', 0.8, nodata=40),
                                                  row('2999-01-01', 0.9), row('2022-01-01', float('nan'))]})
    assert result['capture_date'] == '2020-01-01'
    assert result['ndvi'] == 0.4
    assert result['evi'] is None


def test_crop_watch_does_not_invent_missing_sensor_or_rainfall_values():
    day = DailyWeatherForecast(date='2020-01-01', temp_max_c=27, temp_min_c=23,
          humidity_pct=90, rainfall_mm=100, et0_mm=4, vpd_kpa=0.5, gdd=7,
          wind_kmh=4, weather_condition='Rain', weather_icon='')
    checks = build_crop_watch(day, 'Unknown')
    assert len(checks) == 8
    assert all(item['criteria_tested'] == 2 for item in checks)
    assert all(item['stage_eligible'] is None for item in checks)
    assert all(item['leaf_wetness_measured'] is False for item in checks)
    day.humidity_pct = None
    assert all(item['criteria_tested'] == 1 for item in build_crop_watch(day, 'Unknown'))


def test_no_disease_result_has_no_brown_rust_advice(monkeypatch):
    monkeypatch.setattr(unet_classifier, 'run_inference', lambda _: {
        'disease': 'No supported disease detected', 'confidence': 0.8,
        'affected_percent': 0, 'severity': 'None', 'status': 'not_detected',
        'model_result':{'model':'UNet / ResNet34','predictions':[]}})
    monkeypatch.setattr('app.modules.pest_disease.efficientnet_classifier.run_inference',lambda _:{'status':'complete','predictions':[]})
    result = scans.diagnose_leaf_image(b'unit fixture')
    assert result.disease_details is None
    assert result.status == 'not_detected'


def test_model_failure_is_not_a_fake_diagnosis(monkeypatch):
    monkeypatch.setattr(unet_classifier, 'load_unet_model', lambda: None)
    with pytest.raises(RuntimeError):
        unet_classifier.run_inference(b'not an image')


def test_scan_auth_invalid_upload_and_service_failure(monkeypatch):
    monkeypatch.setattr('app.farmers.service.get_farm_by_id',lambda _: {'farm_id':FARM,'farmer_id':OWNER})
    async def no_saved(*args): return None
    monkeypatch.setattr('app.modules.pest_disease.history.saved_scan',no_saved)
    client = TestClient(app)
    assert client.post('/api/v1/pest-disease/detect', files={'file': ('x.png', b'bad', 'image/png')}).status_code == 401
    assert client.post('/api/v1/pest-disease/detect', headers=HEADERS,
                       files={'file': ('x.png', b'bad', 'image/png')}).status_code == 422
    data = io.BytesIO()
    Image.new('RGB', (32, 32)).save(data, format='PNG')
    def unavailable(_):
        raise RuntimeError('Unavailable')
    monkeypatch.setattr(scans, 'diagnose_leaf_image', unavailable)
    assert client.post('/api/v1/pest-disease/detect', headers=HEADERS,
                       files={'file': ('x.png', data.getvalue(), 'image/png')},data={'farm_id':FARM}).status_code == 503


def test_todays_irrigation_does_not_credit_future_rain():
    result = physics.compute_irrigation_requirement(5, 'Unknown', 1000, rainfall_week_mm=100,
                                                   rainfall_today_mm=0)
    assert result['net_irrigation_mm_day'] == 4.5


def test_weather_daily_aggregation_and_farm_cache_isolation(monkeypatch):
    today = datetime.now(timezone(timedelta(hours=5, minutes=30))).date()
    stamps = [f'{today.isoformat()}T{hour:02}:00' for hour in range(24)]
    payload = {'current': {'temperature_2m': 30, 'relative_humidity_2m': 40, 'apparent_temperature': 31,
               'wind_speed_10m': 10, 'precipitation': 0, 'weather_code': 0},
               'daily': {'time': [today.isoformat()], 'temperature_2m_max': [32], 'temperature_2m_min': [22],
               'precipitation_sum': [0], 'precipitation_probability_max': [0], 'weather_code': [0],
               'et0_fao_evapotranspiration': [5]},
               'hourly': {'time': stamps, 'relative_humidity_2m': [80] * 24, 'wind_speed_10m': [5] * 24}}
    async def fetch(*_):
        return payload
    farms = {FARM: {'farm_id': FARM, 'latitude': 19, 'longitude': 77, 'area_acre': 1, 'growth_stage': 'Unknown'},
             OWNER: {'farm_id': OWNER, 'latitude': 19, 'longitude': 77, 'area_acre': 3, 'growth_stage': 'Unknown'}}
    monkeypatch.setattr(weather.farmer_service, 'get_farm_by_id', lambda farm_id: farms[str(farm_id)])
    monkeypatch.setattr(weather, 'fetch_open_meteo', fetch)
    monkeypatch.setattr(weather, '_WEATHER_CACHE', {})
    first = asyncio.run(weather.get_farm_weather_overview(FARM))
    second = asyncio.run(weather.get_farm_weather_overview(OWNER))
    assert first.forecast_7_day[0].humidity_pct == 80
    assert first.forecast_7_day[0].wind_kmh == 5
    assert first.crop_watch_outlook[0]['date'] == today.isoformat()
    assert first.crop_watch_outlook[0]['checks'] == first.crop_watch
    assert first.field_context['farm_id'] == FARM
    assert first.field_context['crop']['stage_source'] == 'unknown'
    assert second.irrigation.water_required_liters == pytest.approx(first.irrigation.water_required_liters * 3, abs=0.2)
    assert len(weather._WEATHER_CACHE) == 2
    assert first.hourly_forecast == []  # No fabricated hourly values for missing provider columns.
    payload['current'].pop('temperature_2m')
    weather._WEATHER_CACHE.clear()
    with pytest.raises(RuntimeError):
        asyncio.run(weather.get_farm_weather_overview(FARM))
