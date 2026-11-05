"""Offline tests: no Supabase or Copernicus credentials required."""
from io import BytesIO
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.main import app
from app.core.security import require_authorized_farmer
from app.modules.gis import router as gis_router
from app.modules.gis import service as gis_service
from app.modules.gis.satellite_refresh import (
    _raster_evalscript, _polygon_pixel_count, STATS_EVALSCRIPT,
    KEYS, ALGORITHM_VERSION,
)
from app.modules.gis.vra import ndvi_vra_zones, PALETTE_CLASSES

FARM_ID = UUID('00000000-0000-4000-8000-000000000111')
FARMER_ID = UUID('00000000-0000-4000-8000-000000000222')


def _test_image():
    image = Image.new('RGBA', (2, 2))
    image.putdata([
        (102, 0, 0, 255),      # palette class 0 -> check
        (129, 199, 132, 255),  # palette class 13 -> monitor
        (46, 125, 50, 255),    # palette class 17 -> strong
        (0, 0, 0, 0),          # NoData remains transparent
    ])
    data = BytesIO()
    image.save(data, 'PNG')
    return data.getvalue()


def test_vra_preserves_real_data_and_nodata():
    png, meta = ndvi_vra_zones(_test_image())
    with Image.open(BytesIO(png)) as image:
        assert image.mode == 'RGBA'
        pix = list(image.getdata())
        assert pix[0] == (230, 78, 70, 255)
        assert pix[1] == (245, 180, 59, 255)
        assert pix[2] == (39, 171, 127, 255)
        assert pix[3][3] == 0
    assert meta['counts'] == {'check': 1, 'monitor': 1, 'strong': 1, 'no_data': 1}
    assert meta['valid_pixel_count'] == 3
    assert 'no fertilizer' in meta['disclaimer'].lower()


def test_all_six_indices_and_ndwi_formula_are_distinct():
    assert len(KEYS) == 6
    for index in KEYS:
        script = _raster_evalscript(index)
        assert 'ORBIT' in script
        assert f"values['{index}']" in script
        assert 'B03' in script
        assert 'continue' in script
    assert 'const ndwi=ratio(s.B03,s.B08)' in _raster_evalscript('ndwi')
    assert 'const ndmi=ratio(s.B08,s.B11)' in _raster_evalscript('ndmi')
    assert 'NDWI:[ndwi]' in STATS_EVALSCRIPT
    assert 'B03' in STATS_EVALSCRIPT
    assert ALGORITHM_VERSION


def test_polygon_area_does_not_count_entire_bounding_rectangle():
    geometry = {
        'type': 'Polygon',
        'coordinates': [[[0, 0], [1, 0], [0, 1], [0, 0]]],
    }
    count = _polygon_pixel_count(geometry, [0, 0, 1, 1], (100, 100))
    assert 4000 < count < 5500


def test_vra_requires_farmer_authentication():
    app.dependency_overrides.clear()
    response = TestClient(app).get(f'/api/v1/gis/plot/{FARM_ID}/vra/summary')
    assert response.status_code == 401


def test_vra_private_route_respects_ownership(monkeypatch):
    app.dependency_overrides[require_authorized_farmer] = lambda: FARMER_ID
    monkeypatch.setattr(gis_router.farmer_service, 'get_farm_by_id', lambda fid: {'farm_id': str(fid), 'farmer_id': str(FARMER_ID)})
    monkeypatch.setattr(gis_router, 'verify_farm_ownership', lambda farm, caller: True)
    monkeypatch.setattr(gis_service, 'get_raster_png_bytes', lambda fid, idx: _test_image() if idx == 'ndvi' else None)
    try:
        client = TestClient(app)
        summary = client.get(f'/api/v1/gis/plot/{FARM_ID}/vra/summary')
        assert summary.status_code == 200
        assert summary.json()['valid_pixel_count'] == 3
        image = client.get(f'/api/v1/gis/plot/{FARM_ID}/raster/vra.png')
        assert image.status_code == 200
        assert image.headers['content-type'] == 'image/png'
        assert image.content.startswith(b'\x89PNG\r\n\x1a\n')
        monkeypatch.setattr(gis_router, 'verify_farm_ownership', lambda farm, caller: False)
        assert client.get(f'/api/v1/gis/plot/{FARM_ID}/raster/vra.png').status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_leaflet_native_assets_are_served_locally():
    response = TestClient(app).get('/map/leaflet.js')
    assert response.status_code == 200
    assert b'Leaflet' in response.content[:1000]
    assert response.headers['x-content-type-options'] == 'nosniff'
