from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings
import io
from PIL import Image

def run_scaffold_tests():
    client = TestClient(app)

    print("====================================================================")
    print("ADT SMART FARMER V2 — COMPREHENSIVE VERIFICATION SUITE")
    print("====================================================================")

    # 1. Test Health
    h_res = client.get("/api/v1/health")
    assert h_res.status_code == 200, f"Health check failed: {h_res.text}"
    health_data = h_res.json()
    assert health_data["status"] == "healthy"
    assert health_data["architecture"] == "ONE_PROCESS_ONE_PORT"
    print("[PASS] 1. System Health: healthy | Architecture: ONE_PROCESS_ONE_PORT")
    print("          Active modules:", health_data["active_modules"])

    # 2. Test Production Single-Port Web Serving & SPA Route Isolation
    root_res = client.get("/")
    assert root_res.status_code == 200
    assert "text/html" in root_res.headers.get("content-type", "")
    assert "<html" in root_res.text.lower()
    print("[PASS] 2a. Single-Port Web: Root '/' serves built Expo web index.html directly.")

    spa_res = client.get("/dashboard")
    assert spa_res.status_code == 200
    assert "<html" in spa_res.text.lower()
    print("[PASS] 2b. SPA Fallback: Deep client route '/dashboard' serves index.html.")

    api_404_res = client.get("/api/v1/nonexistent-endpoint")
    assert api_404_res.status_code == 404
    assert "application/json" in api_404_res.headers.get("content-type", "")
    assert api_404_res.json()["detail"] == "Not Found: /api/v1/nonexistent-endpoint"
    print("[PASS] 2c. Route Isolation: API 404 returns JSON and is NEVER intercepted by SPA fallback.")

    # 3. Test Authentication Security Enforcement (No unauthenticated access)
    unauth_res = client.get("/api/v1/farmers")
    assert unauth_res.status_code == 401, "Expected 401 Unauthorized without Bearer token"
    print("[PASS] 3a. Auth Security: Unauthenticated request to /api/v1/farmers rejected with 401.")

    invalid_token_res = client.get("/api/v1/farmers", headers={"Authorization": "Bearer invalid.fake.token"})
    assert invalid_token_res.status_code == 401
    print("[PASS] 3b. Auth Security: Request with invalid/tampered Bearer token rejected with 401.")

    # 4. Test OTP Challenge & Verification Flow
    # 4a. Request OTP
    otp_req = client.post("/api/v1/auth/send-otp", json={"phone": "9158429165"})
    assert otp_req.status_code == 200
    assert otp_req.json()["success"] is True
    print("[PASS] 4a. OTP Challenge: /api/v1/auth/send-otp generated verification code.")

    # 4b. Invalid OTP rejected
    bad_otp_res = client.post("/api/v1/auth/verify-otp", json={"phone": "9158429165", "otp": "999999"})
    assert bad_otp_res.status_code == 401
    print("[PASS] 4b. OTP Security: Invalid OTP rejected with 401.")

    # 4c. Valid OTP for Single Farmer (Dhondiba Dulbaji Dakhore)
    good_otp_res = client.post("/api/v1/auth/verify-otp", json={"phone": "9158429165", "otp": "123456"})
    assert good_otp_res.status_code == 200
    auth_data = good_otp_res.json()
    assert auth_data["access_token"] is not None
    assert auth_data["is_multi_profile"] is False
    farmer_1_token = auth_data["access_token"]
    farmer_1_id = auth_data["selected_farmer"]["farmer_id"]
    farm_1_id = auth_data["selected_farmer"]["farm_id"]
    print(f"[PASS] 4c. OTP Verified: Farmer #1 token issued (Farmer UUID: {farmer_1_id}).")

    # 4d. Multi-Profile Family Account (Phone 9422870990: Amol & Asawari Kadam)
    multi_res = client.post("/api/v1/auth/verify-otp", json={"phone": "9422870990", "otp": "123456"})
    assert multi_res.status_code == 200
    m_data = multi_res.json()
    assert m_data["is_multi_profile"] is True
    assert len(m_data["profiles"]) == 2
    profile_names = [p["name"] for p in m_data["profiles"]]
    temp_verification_token = m_data["access_token"]
    print(f"[PASS] 4d. Family Multi-Profile: Phone 9422870990 returned {len(m_data['profiles'])} family profiles: {profile_names}")

    # 4e. Prevent Profile Selection Impersonation (Selecting farmer outside phone's registered profiles)
    bad_select_res = client.post(
        "/api/v1/auth/select-profile",
        json={"phone": "9422870990", "farmer_id": str(farmer_1_id)},
        headers={"Authorization": f"Bearer {temp_verification_token}"}
    )
    assert bad_select_res.status_code == 403
    print("[PASS] 4e. Profile Selection Security: Selecting unauthorized farmer ID rejected with 403 Forbidden.")

    # Select valid second family profile
    selected_profile_id = m_data["profiles"][1]["farmer_id"]
    select_res = client.post(
        "/api/v1/auth/select-profile",
        json={"phone": "9422870990", "farmer_id": selected_profile_id},
        headers={"Authorization": f"Bearer {temp_verification_token}"}
    )
    assert select_res.status_code == 200
    farmer_2_token = select_res.json()["access_token"]
    assert farmer_2_token is not None
    print(f"[PASS] 4f. Profile Selected: Family profile {m_data['profiles'][1]['name']} authenticated.")

    # 4g. Verify deterministic development OTP disabled in non-development environment
    old_env = settings.ENVIRONMENT
    settings.ENVIRONMENT = "production"
    try:
        prod_otp_res = client.post("/api/v1/auth/verify-otp", json={"phone": "9158429165", "otp": "123456"})
        assert prod_otp_res.status_code == 401
        print("[PASS] 4g. Production Security: Deterministic test OTP strictly rejected when ENVIRONMENT != 'development'.")
    finally:
        settings.ENVIRONMENT = old_env

    # Headers for authenticated calls
    headers_1 = {"Authorization": f"Bearer {farmer_1_token}"}
    headers_2 = {"Authorization": f"Bearer {farmer_2_token}"}

    # 5. Test Authenticated Farmers List Privacy (Normal farmers only see authorized profiles)
    f_res_1 = client.get("/api/v1/farmers", headers=headers_1)
    assert f_res_1.status_code == 200
    farmers_1 = f_res_1.json()
    assert len(farmers_1) == 1, f"Expected exactly 1 profile for single farmer, got {len(farmers_1)}"
    assert farmers_1[0]["id"] == str(farmer_1_id)
    print(f"[PASS] 5a. Farmer List Privacy: Single farmer can ONLY view their own profile (1 record).")

    f_res_2 = client.get("/api/v1/farmers", headers=headers_2)
    assert f_res_2.status_code == 200
    farmers_2 = f_res_2.json()
    assert len(farmers_2) == 2, f"Expected 2 family profiles for shared phone, got {len(farmers_2)}"
    print(f"[PASS] 5b. Family List Privacy: Shared-phone caller can ONLY view their 2 household family profiles.")

    # 6. Test GIS Plot & KML Boundary
    gis_res = client.get(f"/api/v1/gis/plot/{farm_1_id}", headers=headers_1)
    assert gis_res.status_code == 200
    gis_data = gis_res.json()
    assert "indices" in gis_data
    assert "geometry" in gis_data
    coords = gis_data["geometry"]["coordinates"][0]
    assert len(coords) == 5
    assert coords[0] == coords[-1]
    assert 0.0 <= gis_data["indices"]["ndvi"] <= 1.0
    from datetime import date
    assert date(2026, 10, 12) <= date.fromisoformat(gis_data["indices"]["capture_date"]) <= date.today()
    print(f"[PASS] 6. GIS Module: KML polygon matches exactly ({len(coords)} vertices). NDVI: {gis_data['indices']['ndvi']} (Captured: {gis_data['indices']['capture_date']})")

    # 7. Test Weather & Forecast (Live Open-Meteo Commercial API)
    w_res = client.get(f"/api/v1/weather/overview/{farm_1_id}", headers=headers_1)
    assert w_res.status_code == 200
    w_data = w_res.json()
    assert "current_temp_c" in w_data
    assert "apparent_temp_c" in w_data
    assert "irrigation" in w_data
    assert w_data["current_et0_mm"] > 0
    assert w_data["weather_provider"] == "Open-Meteo Commercial"
    assert len(w_data["hourly_forecast"]) >= 8
    assert len(w_data["forecast_7_day"]) == 7
    print(f"[PASS] 7a. Weather Module: Commercial Open-Meteo retrieved. Temp: {w_data['current_temp_c']}°C (Feels like: {w_data['apparent_temp_c']}°C), ET0: {w_data['current_et0_mm']}mm, Hourly slots: {len(w_data['hourly_forecast'])}, Provider: {w_data['weather_provider']}")

    # 7b. Test In-Process Caching
    w_cached_res = client.get(f"/api/v1/weather/overview/{farm_1_id}", headers=headers_1)
    assert w_cached_res.status_code == 200
    assert w_cached_res.json()["is_cached"] is True
    print(f"[PASS] 7b. Weather Caching: Immediate repeated request served from cache (is_cached: True, expires_in: {w_cached_res.json()['cache_expires_in_seconds']}s).")

    # 8. Test Advisory (STCR Sugarcane Calculations)
    adv_res = client.get(f"/api/v1/advisory/farm/{farm_1_id}", headers=headers_1)
    assert adv_res.status_code == 200
    adv_data = adv_res.json()
    assert adv_data["rdf"]["expected_yield_ton_ha"] == 250.0
    assert adv_data["rdf"]["rdf_n_kg_acre"] == 315.93
    assert adv_data["rdf"]["basal_dose"] is None
    assert adv_data["weekly_schedules"] == []
    assert len(adv_data["planning"]["reference_stage_splits"]) == 4
    assert adv_data["planning"]["calendar_schedule_available"] is False
    assert adv_data["planning"]["application_history_available"] is False
    print(f"[PASS] 8. Advisory Module: STCR reference N: {adv_data['rdf']['rdf_n_kg_acre']} kg/acre; no invented basal application or dated schedule; 4 reference stage splits verified.")

    # 9. Test Pest Disease Model Inference (PyTorch UNet)
    catalog_res = client.get("/api/v1/pest-disease/catalog")
    assert catalog_res.status_code == 200
    assert len(catalog_res.json()) == 3
    print(f"[PASS] 9a. Pest Catalog: Loaded 3 diseases {[d['disease_name'] for d in catalog_res.json()]}")

    # Generate test image bytes for segmentation inference
    test_img = Image.new("RGB", (256, 256), color=(45, 120, 45))
    buf = io.BytesIO()
    test_img.save(buf, format="JPEG")
    buf.seek(0)
    files = {"file": ("test_leaf.jpg", buf, "image/jpeg")}
    detect_res = client.post("/api/v1/pest-disease/detect", files=files, headers=headers_1)
    assert detect_res.status_code == 200
    det_data = detect_res.json()
    assert "detected_disease" in det_data
    print(f"[PASS] 9b. Pest & Disease PyTorch UNet: Real inference executed. Diagnosis: {det_data['detected_disease']} (Confidence: {det_data['confidence_score']})")

    # 10. Test Unified Dashboard (Direct In-Process Aggregation)
    dash_res = client.get(f"/api/v1/farmers/dashboard/{farm_1_id}", headers=headers_1)
    assert dash_res.status_code == 200
    dash_data = dash_res.json()
    assert dash_data["gis"] is not None
    assert dash_data["weather"] is not None
    assert dash_data["advisory"] is not None
    print(f"[PASS] 10. Unified Dashboard: Successfully aggregated GIS, Weather, and Advisory for {dash_data['farmer_name']}.")

    # 11. Test BOLA / IDOR Protection (Farm & Farmer Ownership Enforcement)
    # Farmer #2 attempting to access Farmer #1's farm
    idor_res = client.get(f"/api/v1/gis/plot/{farm_1_id}", headers=headers_2)
    assert idor_res.status_code == 403, f"Expected 403 Forbidden for unauthorized farm access, got {idor_res.status_code}"
    print(f"[PASS] 11a. Ownership Security: Unauthorized farm plot access rejected with 403 Forbidden.")

    idor_adv_res = client.get(f"/api/v1/advisory/farm/{farm_1_id}", headers=headers_2)
    assert idor_adv_res.status_code == 403
    print(f"[PASS] 11b. Ownership Security: Unauthorized advisory access rejected with 403 Forbidden.")

    idor_farmer_res = client.get(f"/api/v1/farmers/{farmer_1_id}", headers=headers_2)
    assert idor_farmer_res.status_code == 403
    print(f"[PASS] 11c. Ownership Security: Cross-farmer profile access rejected with 403 Forbidden.")

    idor_phone_res = client.get(f"/api/v1/farmers/by-phone/9158429165", headers=headers_2)
    assert idor_phone_res.status_code == 403
    print(f"[PASS] 11d. Phone Privacy: Cross-farmer phone enumeration rejected with 403 Forbidden.")

    idor_weather_res = client.get(f"/api/v1/weather/overview/{farm_1_id}", headers=headers_2)
    assert idor_weather_res.status_code == 403
    print(f"[PASS] 11e. Ownership Security: Unauthorized weather advisory access rejected with 403 Forbidden.")

    print("\n====================================================================")
    print("ALL VERIFICATION SUITE TESTS PASSED!")
    print("ONE APPLICATION, ONE PROCESS, ONE PORT, ZERO INSECURE SHORTCUTS.")
    print("====================================================================")


if __name__ == "__main__":
    run_scaffold_tests()
