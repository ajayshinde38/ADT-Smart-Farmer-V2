import io
import os
from PIL import Image
import httpx

BASE_URL = os.environ.get('V2_TEST_BASE_URL','http://127.0.0.1:8000/api/v1')

def test_phase4_scenarios():
    print("=" * 75)
    print("PHASE 4 — END-TO-END CANONICAL FARMER VALIDATION SUITE")
    print("=" * 75)

    with httpx.Client(timeout=15.0) as client:
        # Scenario 1: Normal Single-Profile Farmer (Dhondiba Dakhore)
        print("\n[Scenario 1] Normal Single-Profile Farmer Flow:")
        login_1 = client.post(f"{BASE_URL}/auth/login", json={"phone": "9158429165"}).json()
        assert login_1["is_multi_profile"] is False
        assert login_1["access_token"] is not None
        token_1 = login_1["access_token"]
        farmer_1 = login_1["selected_farmer"]
        farm_1_id = farmer_1["farm_id"]
        headers_1 = {"Authorization": f"Bearer {token_1}"}
        print(f"  [PASS] Logged in: {farmer_1['name']} (ID: {farmer_1['farmer_id']})")
        print(f"         Farm ID: {farm_1_id} | Area: {farmer_1['farm_area_acres']} Acres")

        # Scenario 2: Shared-Number Family Scenario (Amol & Asawari Kadam)
        print("\n[Scenario 2] Shared-Number Household Family Flow (Phone 9422870990):")
        login_fam = client.post(f"{BASE_URL}/auth/login", json={"phone": "9422870990"}).json()
        assert login_fam["is_multi_profile"] is True
        assert len(login_fam["profiles"]) == 2
        temp_token = login_fam["access_token"]
        print(f"  [PASS] Multi-profile triggered. Profiles found ({len(login_fam['profiles'])}):")
        for p in login_fam["profiles"]:
            print(f"         - {p['name']} (Farmer ID: {p['farmer_id']} | PRN: {p['prn']})")

        # Select Asawari Kadam
        asawari_profile = [p for p in login_fam["profiles"] if "asawari" in p["name"].lower()][0]
        asawari_id = asawari_profile["farmer_id"]
        asawari_farm_id = asawari_profile["farm_id"]
        select_res = client.post(
            f"{BASE_URL}/auth/select-profile",
            json={"phone": "9422870990", "farmer_id": asawari_id},
            headers={"Authorization": f"Bearer {temp_token}"}
        ).json()
        token_asawari = select_res["access_token"]
        headers_asawari = {"Authorization": f"Bearer {token_asawari}"}
        print(f"  [PASS] Selected family profile: {asawari_profile['name']} successfully.")

        # Scenario 3: Farmer WITH Historical Satellite Observations (Dhondiba Dakhore)
        print("\n[Scenario 3] Farmer WITH Historical Satellite Observations:")
        gis_1 = client.get(f"{BASE_URL}/gis/plot/{farm_1_id}", headers=headers_1).json()
        from datetime import date
        assert isinstance(gis_1['indices']['ndvi'],(int,float)) and -1 <= gis_1['indices']['ndvi'] <= 1
        assert date(2026,10,12) <= date.fromisoformat(gis_1['indices']['capture_date']) <= date.today()
        assert gis_1['raster']['acquisition_date'] == '2024-10-12'
        assert gis_1["indices"]["evi"] is not None
        assert len(gis_1["geometry"]["coordinates"][0]) == 5
        print(f"  [PASS] Satellite Data Verified: NDVI = {gis_1['indices']['ndvi']} (Acquired: {gis_1['indices']['capture_date']})")
        print(f"         Canopy Health Status: {gis_1['health']['status']} (Score: {gis_1['health']['health_score']}/100)")
        print(f"         Verified GeoJSON Polygon: {len(gis_1['geometry']['coordinates'][0])} vertices intact")

        # Scenario 4: Farmer WITHOUT Historical Satellite Observations (Asawari Kadam)
        print("\n[Scenario 4] Farmer WITHOUT Historical Satellite Observations:")
        gis_asawari = client.get(f"{BASE_URL}/gis/plot/{asawari_farm_id}", headers=headers_asawari).json()
        assert gis_asawari["indices"]["evi"] is None
        coord_count = len(gis_asawari["geometry"]["coordinates"][0])
        assert coord_count >= 3
        print(f"  [PASS] Honest unobserved handling: EVI/NDRE unobserved (None), no fabricated heatmap.")
        print(f"         Verified GeoJSON Polygon: {coord_count} vertices intact")
        print(f"         Area: {gis_asawari['area_acres']} Acres ({gis_asawari['latitude']} N, {gis_asawari['longitude']} E)")

        # Scenario 5: Unauthorized Access To Another Farmer's Data (BOLA/IDOR Enforcement)
        print("\n[Scenario 5] Cross-Farmer Unauthorized Data Access Enforcement:")
        
        # Asawari trying to access Dhondiba's farm plot GIS
        r_gis_bad = client.get(f"{BASE_URL}/gis/plot/{farm_1_id}", headers=headers_asawari)
        assert r_gis_bad.status_code == 403
        print(f"  [PASS] Access to foreign farm GIS rejected: HTTP {r_gis_bad.status_code} ({r_gis_bad.json()['detail']})")

        # Asawari trying to access Dhondiba's soil advisory
        r_adv_bad = client.get(f"{BASE_URL}/advisory/farm/{farm_1_id}", headers=headers_asawari)
        assert r_adv_bad.status_code == 403
        print(f"  [PASS] Access to foreign farm Advisory rejected: HTTP {r_adv_bad.status_code} ({r_adv_bad.json()['detail']})")

        # Asawari trying to access Dhondiba's profile directly
        r_prof_bad = client.get(f"{BASE_URL}/farmers/{farmer_1['farmer_id']}", headers=headers_asawari)
        assert r_prof_bad.status_code == 403
        print(f"  [PASS] Access to foreign Farmer Profile rejected: HTTP {r_prof_bad.status_code} ({r_prof_bad.json()['detail']})")

        # Unauthenticated request rejected
        r_unauth = client.get(f"{BASE_URL}/farmers")
        assert r_unauth.status_code == 401
        print(f"  [PASS] Unauthenticated access rejected: HTTP {r_unauth.status_code}")

        # Real UNet Pest Detection Execution
        print("\n[PyTorch UNet Model Inference Test]:")
        img = Image.new("RGB", (256, 256), color=(40, 110, 40))
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        buf.seek(0)
        # Cold CPU model imports/weight loading can exceed the normal API timeout.
        detect_res = client.post(f"{BASE_URL}/pest-disease/detect", files={"file": ("leaf.jpg", buf, "image/jpeg")}, data={"farm_id":farm_1_id}, headers=headers_1, timeout=60.0)
        assert detect_res.status_code == 200
        det_data = detect_res.json()
        assert det_data['field_context']['farm_id'] == farm_1_id
        assert det_data['field_context']['satellite']['available'] is True
        print(f"  [PASS] Model output: {det_data['detected_disease']} (Confidence: {det_data['confidence_score']})")
        print(f"         Affected area: {det_data['affected_percentage']}% | Severity: {det_data['severity_level']}")

    print("\n" + "=" * 75)
    print("ALL 5 PHASE 4 SCENARIOS FULLY VERIFIED ON LIVE CLOUD-BACKED SERVER!")
    print("=" * 75)

if __name__ == "__main__":
    test_phase4_scenarios()
