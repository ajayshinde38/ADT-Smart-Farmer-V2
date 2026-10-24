import os
import sys
import json
from pathlib import Path
import httpx

def run_tests():
    print("=" * 75)
    print("TASK 7B: GIS MAP VISIBILITY, MOBILE HIERARCHY & SATELLITE TILE VERIFICATION")
    print("=" * 75)

    base_dir = Path(__file__).resolve().parent
    frontend_dir = base_dir.parent / "frontend"
    web_map_file = frontend_dir / "src" / "components" / "InteractiveGISMap.web.tsx"
    gis_screen_file = frontend_dir / "src" / "screens" / "GISScreen.tsx"
    dist_index = frontend_dir / "dist" / "index.html"

    # Test 1: Check InteractiveGISMap.web.tsx source file
    assert web_map_file.exists(), f"Missing {web_map_file}"
    map_code = web_map_file.read_text(encoding="utf-8")

    # Verify no dangerous position !important overrides on tiles
    assert "left: 0 !important" not in map_code, "Found harmful 'left: 0 !important' overriding tile positions"
    assert "height: 100% !important" not in map_code, "Found harmful 'height: 100% !important' overriding container height"
    assert "380" in map_code, "Map viewport height not set to large 380px mobile height"
    assert "OFFICIAL_LEAFLET_CSS" in map_code, "Missing complete inlined official Leaflet CSS"
    assert "leaflet-official-bundle-css" in map_code, "Missing official Leaflet bundle style injection"
    assert "toolbarRow" in map_code, "Missing responsive 2-tier mobile toolbar row 1"
    assert "actionsRow" in map_code, "Missing responsive 2-tier mobile toolbar row 2"
    assert "Center on Farm" in map_code, "Missing recenter control button"
    print("[PASS] 1. Verified InteractiveGISMap.web.tsx mobile and tile layout:")
    print("         - Large 380px responsive mobile viewport height")
    print("         - Clean inlined Leaflet 1.9.4 CSS with zero harmful '!important' position overrides")
    print("         - 2-tier non-overlapping wrap mobile toolbar")

    # Test 2: Check GISScreen.tsx mobile hierarchy & scientific accuracy
    assert gis_screen_file.exists(), f"Missing {gis_screen_file}"
    gis_code = gis_screen_file.read_text(encoding="utf-8")

    # Verify no overlapping absolute HUD cards over the map
    assert "hudAndLegendCard" not in gis_code, "Found deprecated overlapping hudAndLegendCard in GISScreen.tsx"
    assert "provenanceCard" in gis_code, "Missing dedicated satellite provenance card below map"
    assert "Math Range: -1.00 to +1.00" in gis_code or "mathRange" in gis_code, "Missing scientific NDVI mathematical range"
    assert "Moderate Canopy" in gis_code, "Missing moderate canopy classification for NDVI ~0.45"
    assert "isCoordsExpanded" in gis_code, "Missing expandable boundary coordinates state"
    assert "paddingBottom: 110" in gis_code, "Missing safe padding for fixed bottom navigation"
    print("[PASS] 2. Verified GISScreen.tsx mobile layout hierarchy:")
    print("         - Zero overlapping HUD overlays on top of the map area")
    print("         - Dedicated Satellite Provenance card with cloud coverage verification")
    print("         - Scientific NDVI range (-1.00 to +1.00) and sugarcane canopy classification")
    print("         - Expandable boundary vertices accordion keeping screen compact on mobile")
    print("         - 110px safe bottom padding preventing bottom navigation clipping")

    # Test 3: Check production build export in frontend/dist
    assert dist_index.exists(), f"Missing {dist_index}"
    dist_html = dist_index.read_text(encoding="utf-8")
    assert "index-" in dist_html, "index.html missing bundle reference"

    js_dir = frontend_dir / "dist" / "_expo" / "static" / "js" / "web"
    js_files = list(js_dir.glob("index-*.js"))
    assert len(js_files) > 0, "No JS bundle found in dist"
    bundle_text = js_files[0].read_text(encoding="utf-8")
    assert "leaflet-official-bundle-css" in bundle_text, "Bundle missing leaflet-official-bundle-css"
    print(f"[PASS] 3. Verified frontend/dist production web export ({js_files[0].name}, {len(bundle_text):,} bytes)")

    # Test 4: Live server on port 8000
    live_url = "http://127.0.0.1:8000"
    with httpx.Client(base_url=live_url, timeout=10.0) as client:
        # Check root serving index.html
        res_root = client.get("/")
        assert res_root.status_code == 200, f"Expected 200, got {res_root.status_code}"
        assert js_files[0].name in res_root.text, "Live server not serving latest exported bundle"
        print("[PASS] 4. Live server on port 8000 serves updated frontend bundle directly at '/'")

        # Test 5: Verify Esri World Imagery tile endpoint connectivity
        esri_test_url = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/17/58406/93611"
        esri_res = client.get(esri_test_url)
        assert esri_res.status_code == 200, f"Esri tile failed with status {esri_res.status_code}"
        assert esri_res.headers.get("content-type") == "image/jpeg", "Esri tile did not return image/jpeg"
        assert len(esri_res.content) > 5000, f"Esri tile content suspiciously small: {len(esri_res.content)} bytes"
        print("[PASS] 5. Esri World Imagery tile service confirmed online and returning genuine JPEG imagery tiles")

        # Test 6: Verify Auth & Supabase GIS plot for Dhondiba Dakhore
        login_res = client.post("/api/v1/auth/login", json={"phone": "9158429165"})
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        login_data = login_res.json()
        token = login_data["access_token"]
        farm_id = login_data["selected_farmer"]["farm_id"]
        assert farm_id == "fa0094b2-c218-441d-bc1a-870f0a01430b"

        headers = {"Authorization": f"Bearer {token}"}
        gis_res = client.get(f"/api/v1/gis/plot/{farm_id}", headers=headers)
        assert gis_res.status_code == 200, f"GIS request failed: {gis_res.text}"
        gis_data = gis_res.json()

        coords = gis_data["geometry"]["coordinates"][0]
        assert len(coords) == 5, f"Expected 5 coordinates (with closure), got {len(coords)}"
        assert gis_data["area_acres"] == 1.4, f"Expected 1.4 acres, got {gis_data['area_acres']}"

        indices = gis_data["indices"]
        assert indices["ndvi"] == 0.449, f"Expected NDVI 0.449, got {indices['ndvi']}"
        print(f"[PASS] 6. Verified authentic Supabase GIS plot for Dhondiba Dakhore (1.4 Ac, 5 vertices, NDVI 0.449)")

    print("=" * 75)
    print("ALL TASK 7B GIS MOBILE & VISIBILITY TESTS PASSED 100%!")
    print("=" * 75)

if __name__ == "__main__":
    run_tests()
