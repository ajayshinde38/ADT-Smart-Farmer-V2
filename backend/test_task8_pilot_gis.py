import sys
import httpx
from uuid import UUID

from app.core.config import settings
from app.core.security import create_access_token
from app.farmers.service import get_farm_by_id

PILOT_FARM_ID = "fa0094b2-c218-441d-bc1a-870f0a01430b"
PILOT_FARMER_ID = "c54094b2-c218-441d-bc1a-870f0a01430b"

def run_task8_tests():
    print("=" * 75)
    print("TASK 8: DUAL-PROJECT PORT ISOLATION & SATELLITE RASTER PILOT TEST")
    print("=" * 75)

    # 1. Port Isolation
    print("\n[1] Verifying Dual-Project Port Isolation...")
    # Port 8000 - V2
    v2_h = httpx.get("http://127.0.0.1:8000/api/v1/health")
    assert v2_h.status_code == 200, f"V2 port 8000 failed: {v2_h.status_code}"
    v2_data = v2_h.json()
    assert v2_data["version"] == "2.0.0"
    assert v2_data["architecture"] == "ONE_PROCESS_ONE_PORT"
    assert v2_data["active_modules"]["gis"] == "loaded"
    assert v2_data["active_modules"]["weather"] == "loaded"
    print("  [PASS] Port 8000: ADT Smart Farmer V2 (version 2.0.0, ONE_PROCESS_ONE_PORT, healthy)")

    # Port 8005 - Original GIS Backend
    orig_b = httpx.get("http://127.0.0.1:8005/")
    assert orig_b.status_code == 200, f"Original GIS backend port 8005 failed: {orig_b.status_code}"
    assert "KVK GeoAI API is running" in orig_b.text
    print("  [PASS] Port 8005: Original KVK GIS FastAPI backend live (HTTP 200)")

    # Port 5173 - Original GIS Frontend
    orig_f = httpx.get("http://127.0.0.1:5173/")
    assert orig_f.status_code == 200, f"Original GIS frontend port 5173 failed: {orig_f.status_code}"
    print("  [PASS] Port 5173: Original KVK GIS Vite frontend live (HTTP 200)")

    # 2. V2 Plot GIS API for Pilot Farm
    print("\n[2] Verifying Pilot Farm GIS API with Raster Info...")
    token = create_access_token(PILOT_FARMER_ID)
    headers = {"Authorization": f"Bearer {token}"}
    plot_res = httpx.get(f"http://127.0.0.1:8000/api/v1/gis/plot/{PILOT_FARM_ID}", headers=headers)
    assert plot_res.status_code == 200, f"Plot GIS returned {plot_res.status_code}"
    plot_data = plot_res.json()
    assert plot_data["farmer_name"] == "Dhondiba Dulbaji Dakhore"
    assert plot_data["area_acres"] == 1.4

    # Verify RasterOverlayInfo is attached for pilot farm
    raster = plot_data.get("raster")
    assert raster is not None, "Expected raster overlay info for pilot farm"
    assert raster["is_available"] is True
    assert raster["scene_id"] == "S2B_MSIL2A_20241012T051649_N0511_R062_T43QGB_20241012T082350"
    assert raster["resolution_meters"] == 10.0
    assert raster["bounds"] == [[19.209149, 77.112733], [19.210312, 77.113232]]
    print(f"  [PASS] Pilot farm: Scene {raster['scene_id']} (10m Sentinel-2 L2A)")
    print(f"  [PASS] Geographic Bounds: {raster['bounds']}")

    # 3. Check all 6 genuine raster PNG endpoints
    print("\n[3] Verifying 6 Authentic Sentinel-2 Index Raster PNGs...")
    indices = ["ndvi", "evi", "ndre", "msavi", "ndmi", "ndwi"]
    for idx in indices:
        png_url = f"http://127.0.0.1:8000/api/v1/gis/plot/{PILOT_FARM_ID}/raster/{idx}.png"
        png_res = httpx.get(png_url, headers=headers)
        assert png_res.status_code == 200, f"Failed to get {idx}.png: {png_res.status_code}"
        assert png_res.headers["content-type"] == "image/png"
        assert len(png_res.content) > 100, f"{idx}.png too small: {len(png_res.content)} bytes"
        assert png_res.content[:8] == b"\x89PNG\r\n\x1a\n", f"Invalid PNG magic bytes for {idx}"
        print(f"  [PASS] {idx.upper()} raster PNG: HTTP 200, {len(png_res.content)} bytes, Valid PNG format")

    # 4. Verify Supabase Storage 'satellite-tiff' Bucket
    print("\n[4] Verifying Supabase Storage 'satellite-tiff' Bucket...")
    list_url = f"{settings.SUPABASE_URL}/storage/v1/object/list/satellite-tiff"
    s_headers = {
        "apikey": settings.SUPABASE_SECRET_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SECRET_KEY}",
        "Content-Type": "application/json"
    }
    s_res = httpx.post(list_url, json={"prefix": f"rasters/{PILOT_FARM_ID}/", "limit": 100}, headers=s_headers)
    assert s_res.status_code == 200
    names = [o["name"] for o in s_res.json()]
    assert "20241012_s2b_l2a_indices.tif" in names
    assert "20241012_ndvi.png" in names
    assert "20241012_evi.png" in names
    print(f"  [PASS] Verified {len(names)} authentic raster assets in private Supabase bucket 'satellite-tiff'")

    # 5. Verify Unobserved Farm Handling (Mode A only, no fake data)
    print("\n[5] Verifying Unobserved Farm Handling...")
    unobs_farm_id = "fa005c48-1cd3-4611-857a-5ab071c218e3"  # Asawari Kadam's farm
    unobs_farmer_id = "778e5c48-1cd3-4611-857a-5ab071c218e3"
    u_token = create_access_token(unobs_farmer_id)
    u_res = httpx.get(f"http://127.0.0.1:8000/api/v1/gis/plot/{unobs_farm_id}", headers={"Authorization": f"Bearer {u_token}"})
    assert u_res.status_code == 200, f"Unobserved plot returned {u_res.status_code}"
    u_data = u_res.json()
    assert u_data["indices"]["ndvi"] is None, "Expected unobserved NDVI to be None"
    assert u_data["raster"] is None, "Expected raster to be None for unobserved farm"
    assert "Awaiting Satellite Pass" in u_data["health"]["status"]
    print("  [PASS] Unobserved farm cleanly reports Mode A fallback with no fabricated heatmaps")

    # 6. Verify Ownership Security
    print("\n[6] Verifying Ownership Security...")
    # Attempt cross-access to pilot farm with unauthorized token
    unauth_res = httpx.get(f"http://127.0.0.1:8000/api/v1/gis/plot/{PILOT_FARM_ID}", headers={"Authorization": f"Bearer {u_token}"})
    assert unauth_res.status_code == 403, f"Expected 403 on cross-access, got {unauth_res.status_code}"
    # Attempt unauthenticated access to raster PNG
    no_auth_png = httpx.get(f"http://127.0.0.1:8000/api/v1/gis/plot/{PILOT_FARM_ID}/raster/ndvi.png")
    assert no_auth_png.status_code == 401, f"Expected 401 on unauthenticated PNG access, got {no_auth_png.status_code}"
    print("  [PASS] Security verified: Cross-access 403 Forbidden, Unauthenticated 401 Unauthorized")

    print("\n" + "=" * 75)
    print("ALL TASK 8 PORT ISOLATION & RASTER PILOT TESTS PASSED 100%!")
    print("=" * 75)

if __name__ == "__main__":
    run_task8_tests()
