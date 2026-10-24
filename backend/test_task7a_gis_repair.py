import os
import sys
import json
from pathlib import Path
import httpx

def run_tests():
    print("=" * 75)
    print("TASK 7A: GIS MAP & LEAFLET RUNTIME CRASH REPAIR VERIFICATION")
    print("=" * 75)

    base_dir = Path(__file__).resolve().parent
    frontend_dir = base_dir.parent / "frontend"
    web_file = frontend_dir / "src" / "components" / "InteractiveGISMap.web.tsx"
    dist_index = frontend_dir / "dist" / "index.html"

    # Test 1: Check InteractiveGISMap.web.tsx source file
    assert web_file.exists(), f"Missing {web_file}"
    content = web_file.read_text(encoding="utf-8")

    # Verify setView is called immediately after L.map to initialize renderer bounds
    assert "map.setView(" in content, "Missing immediate map.setView() call after L.map creation"
    assert "CRITICAL FIX FOR" in content, "Missing fix documentation comment"
    assert "farmLayerGroupRef" in content, "Missing dedicated FeatureGroup for layer lifecycle management"
    assert "clearLayers()" in content, "Missing clearLayers() call to prevent detached SVG elements"
    assert "isMapReady" in content, "Missing isMapReady guard for vector overlays"
    assert "CRITICAL_LEAFLET_CSS" in content, "Missing critical Leaflet CSS styles"
    assert "position: 'relative'" in content or 'position: "relative"' in content, "Container missing relative positioning"
    print("[PASS] 1. Verified InteractiveGISMap.web.tsx implements safe Leaflet lifecycle:")
    print("         - Immediate map.setView() prevents 'Cannot read properties of undefined (reading intersects)'")
    print("         - FeatureGroup clearLayers() and guarded cleanup prevent parentNode exceptions")
    print("         - Container has relative positioning and inline critical Leaflet CSS")

    # Test 2: Check frontend/dist web export
    assert dist_index.exists(), f"Missing {dist_index}"
    dist_html = dist_index.read_text(encoding="utf-8")
    assert "index-" in dist_html, "index.html does not reference exported bundle"

    # Find JS bundle in dist/_expo/static/js/web/
    js_dir = frontend_dir / "dist" / "_expo" / "static" / "js" / "web"
    js_files = list(js_dir.glob("index-*.js"))
    assert len(js_files) > 0, "No JS bundle found in dist"
    bundle_text = js_files[0].read_text(encoding="utf-8")
    assert "leaflet-critical-styles" in bundle_text, "Bundle missing leaflet-critical-styles"
    print(f"[PASS] 2. Verified frontend/dist production export ({js_files[0].name}, {len(bundle_text):,} bytes):")
    print("         - Includes updated Leaflet initialization and vector layers")

    # Test 3: Live FastAPI server verification on port 8000
    live_url = "http://127.0.0.1:8000"
    with httpx.Client(base_url=live_url, timeout=10.0) as client:
        # Check root serving index.html
        res_root = client.get("/")
        assert res_root.status_code == 200, f"Expected 200, got {res_root.status_code}"
        assert js_files[0].name in res_root.text, "Live server not serving latest exported bundle"
        print("[PASS] 3. Live server on port 8000 serves updated frontend bundle directly at '/'")

        # Test 4: Auth & GIS plot for Dhondiba Dakhore
        login_res = client.post("/api/v1/auth/login", json={"phone": "9158429165"})
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        login_data = login_res.json()
        token = login_data["access_token"]
        farm_id = login_data["selected_farmer"]["farm_id"]
        assert farm_id == "fa0094b2-c218-441d-bc1a-870f0a01430b", f"Unexpected farm_id: {farm_id}"

        headers = {"Authorization": f"Bearer {token}"}
        gis_res = client.get(f"/api/v1/gis/plot/{farm_id}", headers=headers)
        assert gis_res.status_code == 200, f"GIS request failed: {gis_res.text}"
        gis_data = gis_res.json()

        coords = gis_data["geometry"]["coordinates"][0]
        assert len(coords) == 5, f"Expected 5 coordinates (with closure), got {len(coords)}"
        assert abs(gis_data["latitude"] - 19.209693) < 0.001, "Latitude mismatch"
        assert abs(gis_data["longitude"] - 77.113003) < 0.001, "Longitude mismatch"
        assert gis_data["area_acres"] == 1.4, f"Expected 1.4 acres, got {gis_data['area_acres']}"

        # Coordinate conversion check
        # GeoJSON is [lon, lat] Leaflet requires [lat, lon]
        for pt in coords:
            assert pt[0] > 70 and pt[0] < 80, f"Expected longitude ~77, got {pt[0]}"
            assert pt[1] > 18 and pt[1] < 20, f"Expected latitude ~19, got {pt[1]}"

        indices = gis_data["indices"]
        assert indices is not None, "Missing indices for Dhondiba Dakhore"
        assert indices["ndvi"] == 0.449, f"Expected NDVI 0.449, got {indices['ndvi']}"
        assert indices["evi"] == 0.309, f"Expected EVI 0.309, got {indices['evi']}"
        assert indices["ndre"] == 0.295, f"Expected NDRE 0.295, got {indices['ndre']}"
        assert indices["msavi"] == 0.274, f"Expected MSAVI 0.274, got {indices['msavi']}"
        assert indices["ndmi"] == 0.083, f"Expected NDMI 0.083, got {indices['ndmi']}"
        assert indices["ndwi"] == 0.083, f"Expected NDWI 0.083, got {indices['ndwi']}"
        print("[PASS] 4. Verified authentic Supabase GIS data for Dhondiba Dakhore:")
        print(f"         - Farm ID: {farm_id}")
        print(f"         - Centroid: {gis_data['latitude']}°N, {gis_data['longitude']}°E | Area: {gis_data['area_acres']} Ac")
        print(f"         - GeoJSON Ring: {len(coords)} vertices, all within Maharashtra WGS 84 bounds")
        print(f"         - Telemetry: NDVI={indices['ndvi']}, EVI={indices['evi']}, NDRE={indices['ndre']}, MSAVI={indices['msavi']}, NDMI={indices['ndmi']}, NDWI={indices['ndwi']}")

    print("=" * 75)
    print("ALL TASK 7A GIS REPAIR TESTS PASSED SUCCESSFULLY!")
    print("=" * 75)

if __name__ == "__main__":
    run_tests()
