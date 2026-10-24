"""Read-only real-data checks for the two Task 9 farmer cases."""
import math
import os
import httpx
import pytest
from app.core.security import create_access_token
from app.farmers import service as farmers

BASE = os.environ.get('V2_TEST_BASE_URL','http://127.0.0.1:8000/api/v1')
CASES = [
    ('778e5c48-1cd3-4611-857a-5ab071c218e3', 'fa005c48-1cd3-4611-857a-5ab071c218e3', 1.9, False),
    ('c54094b2-c218-441d-bc1a-870f0a01430b', 'fa0094b2-c218-441d-bc1a-870f0a01430b', 1.4, True),
]


@pytest.mark.parametrize('farmer_id,farm_id,area,observed', CASES)
def test_real_farmer_gis_weather_and_ownership(farmer_id, farm_id, area, observed):
    headers = {'Authorization': f'Bearer {create_access_token(farmer_id)}'}
    with httpx.Client(timeout=30) as client:
        response = client.get(f'{BASE}/gis/plot/{farm_id}', headers=headers)
        assert response.status_code == 200
        gis = response.json()
        assert gis['field_context']['farm_id'] == farm_id
        assert gis['field_context']['satellite']['available'] is observed
        assert gis['area_acres'] == area
        assert len(gis['geometry']['coordinates'][0]) >= 4
        keys = ('ndvi', 'evi', 'ndre', 'msavi', 'ndmi', 'ndwi')
        if observed:
            # Existing local refreshed observations may be newer than the seed.
            from datetime import date
            assert date(2026,10,12) <= date.fromisoformat(gis['indices']['capture_date']) <= date.today()
            assert all(math.isfinite(gis['indices'][key]) for key in keys)
            assert gis['raster']['acquisition_date'] == '2024-10-12'
            for key in keys:
                png = client.get(f'{BASE}/gis/plot/{farm_id}/raster/{key}.png', headers=headers)
                assert png.status_code == 200
                assert png.content.startswith(b'\x89PNG\r\n\x1a\n')
        else:
            assert gis['indices']['capture_date'] is None
            assert all(gis['indices'][key] is None for key in keys)
            assert gis['raster'] is None
        weather = client.get(f'{BASE}/weather/overview/{farm_id}', headers=headers)
        assert weather.status_code == 200
        data = weather.json()
        assert data['farm_id'] == farm_id
        assert abs(data['latitude'] - gis['latitude']) < 0.00001
        assert abs(data['longitude'] - gis['longitude']) < 0.00001
        assert data['forecast_timezone'] == 'Asia/Kolkata'
        assert data['last_updated_utc']
        assert len(data['forecast_7_day']) == 7
        assert data['hourly_forecast']
        assert data['field_context']['farm_id'] == farm_id
        assert data['field_context']['weather']['fresh'] is True
        assert data['field_context']['satellite']['available'] is observed
        assert len(data['crop_watch_outlook']) == 7
        for outlook, forecast in zip(data['crop_watch_outlook'], data['forecast_7_day']):
            assert outlook['date'] == forecast['date']
            assert all(check['date'] == forecast['date'] for check in outlook['checks'])
        dashboard = client.get(f'{BASE}/farmers/dashboard/{farm_id}',headers=headers)
        assert dashboard.status_code == 200
        assert dashboard.json()['field_context']['farm_id'] == farm_id
        assert dashboard.json()['field_context']['soil']['available'] is True
        assert math.isfinite(data['current_et0_mm'])
        assert math.isfinite(data['current_vpd_kpa'])
        assert math.isfinite(data['forecast_7d_gdd'])
        assert data['irrigation']['is_estimated'] is True
        for other in CASES:
            if other[1] != farm_id:
                for route in ('gis/plot', 'weather/overview'):
                    assert client.get(f'{BASE}/{route}/{other[1]}', headers=headers).status_code == 403
                assert client.get(f'{BASE}/gis/plot/{other[1]}/raster/ndvi.png', headers=headers).status_code == 403


def test_canonical_registry_unchanged():
    registry = farmers.get_all_farmers()
    assert len(registry) == 25
    farms = list(farmers._CACHE_FARMS.values())
    assert len(farms) == 25
    assert sum(len(farm.get('soil_test_records', [])) for farm in farms) == 25
    assert sum(bool(farm.get('boundary_geojson')) for farm in farms) == 25
    assert sum(len(farm.get('gis_observations', [])) for farm in farms) == 23
