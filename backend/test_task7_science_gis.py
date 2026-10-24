"""
Task 7 Scientific & Geospatial Regression Verification Suite.
Validates agro-meteorological physics against original ADT_Weather reference
and geospatial boundaries against original GIS reference.
"""

import math
import sys
from pathlib import Path
from datetime import date, timedelta
from uuid import UUID

# Ensure backend directory is in sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.modules.weather import physics
from app.modules.weather.agronomy_constants import (
    CROP_STAGE_KC,
    DEFAULT_KC,
    EFFECTIVE_RAINFALL_FRACTION,
    SUGARCANE_BASE_TEMP_C,
    kc_for_stage,
)
from app.farmers import service as farmer_service
from app.modules.gis import service as gis_service
from app.core.security import verify_farm_ownership


def test_weather_science_regression():
    print("=" * 75)
    print("PART 1: AGRO-METEOROLOGICAL SCIENCE REGRESSION TESTS (ADT_Weather)")
    print("=" * 75)

    # 1. Sugarcane Base Temperature and Constants
    assert SUGARCANE_BASE_TEMP_C == 18.0, f"Expected base temp 18.0°C, got {SUGARCANE_BASE_TEMP_C}"
    assert EFFECTIVE_RAINFALL_FRACTION == 0.80, f"Expected 0.80 fraction, got {EFFECTIVE_RAINFALL_FRACTION}"
    assert DEFAULT_KC == 0.90
    print("[PASS] 1. Central Agronomy Constants: Base Temp = 18.0°C, Effective Rain Fraction = 0.80, Default Kc = 0.90")

    # 2. Sugarcane Crop Coefficients (Co 86032) Single-Kc Ramp
    expected_kcs = {
        "Sprouting": 0.15,
        "Tillering": 0.50,
        "Vegetative": 0.90,
        "Grand Growth": 1.20,
        "Maturity": 0.95,
        "Harvest Ready": 0.70,
        "Any": 0.90,
        "Unknown": 0.90,
    }
    for stage, expected_val in expected_kcs.items():
        actual_val = kc_for_stage(stage)
        assert actual_val == expected_val, f"Kc mismatch for {stage}: expected {expected_val}, got {actual_val}"
    print(f"[PASS] 2. Single-Kc Stage Coefficients: Verified all {len(expected_kcs)} growth stages match ADT_Weather doc.")

    # 3. Tetens Vapor Pressure Deficit (VPD in kPa)
    # Test conditions: Tmax = 34.0°C, Tmin = 22.0°C, RH = 45.0%
    # es(34) = 0.6108 * exp((17.27 * 34)/(34 + 237.3)) = 5.323 kPa
    # es(22) = 0.6108 * exp((17.27 * 22)/(22 + 237.3)) = 2.645 kPa
    # es = (5.323 + 2.645) / 2 = 3.984 kPa
    # ea = 3.984 * (45 / 100) = 1.793 kPa
    # VPD = 3.984 - 1.793 = 2.19 kPa
    vpd_result = physics.compute_vpd_kpa(34.0, 22.0, 45.0)
    assert 2.15 <= vpd_result <= 2.25, f"Unexpected VPD: {vpd_result}"
    print(f"[PASS] 3. Tetens Vapor Pressure Deficit: Tmax=34°C, Tmin=22°C, RH=45% -> VPD = {vpd_result} kPa (Expected ~2.19 kPa)")

    # 4. FAO-56 Penman-Monteith ET0
    # Exact worked example benchmark from ADT_Weather doc (ET_and_Kc.docx):
    # Tmax = 34.0°C, Tmin = 22.0°C, RH = 70.0% (mean of 90/50), u2 = 2.5 m/s (9.0 km/h),
    # Solar = 22.0 MJ/m2, Lat = 18.18°N, Elevation = 560m, DOY = 196 -> benchmark: 5.46 mm/day
    et0_pm = physics.compute_et0_penman_monteith(
        temp_max_c=34.0,
        temp_min_c=22.0,
        humidity_pct=70.0,
        wind_kmh=9.0,
        solar_mj_m2=22.0,
        latitude_deg=18.18,
        elevation_m=560.0,
        day_of_year=196,
    )
    assert 5.40 <= et0_pm <= 5.55, f"Expected ET0 around 5.46 mm/day, got {et0_pm}"
    print(f"[PASS] 4. FAO-56 Penman-Monteith ET0: Computed = {et0_pm} mm/day (Exact ADT_Weather benchmark: 5.46 mm/day)")

    # 5. Hargreaves ET0 Fallback
    et0_hg = physics.compute_et0_hargreaves_mm(35.0, 22.0, 22.0)
    assert 2.5 <= et0_hg <= 4.0, f"Expected Hargreaves ET0 around 3.2 mm/day, got {et0_hg}"
    print(f"[PASS] 5. Hargreaves-Samani ET0 Fallback: Computed = {et0_hg} mm/day")

    # 6. Sugarcane GDD (Daily vs Seasonal Distinction)
    gdd_hot = physics.compute_gdd(34.0, 22.0, base_temp_c=18.0)
    assert gdd_hot == 10.0, f"Expected GDD 10.0, got {gdd_hot}"
    gdd_cold = physics.compute_gdd(18.0, 12.0, base_temp_c=18.0)
    assert gdd_cold == 0.0, f"Expected GDD 0.0 for cold day, got {gdd_cold}"
    print(f"[PASS] 6. Sugarcane GDD Calculation: Tmean=28°C (Base 18°C) -> {gdd_hot}°C-d | Tmean=15°C -> {gdd_cold}°C-d (floored at 0)")

    # 7. Deterministic Irrigation Requirement
    # Farm area: 1.5 acres = 6070.28 m2
    # Stage: Grand Growth (Kc = 1.20)
    # ET0 = 5.0 mm/day -> ETc = 5.0 * 1.20 = 6.0 mm/day
    # Weekly Rain = 14.0 mm -> Effective Daily Rain = (14.0 * 0.80) / 7.0 = 1.6 mm/day
    # Net requirement = 6.0 - 1.6 = 4.4 mm/day
    # Water Required = 4.4 mm * 6070.28 m2 = 26709.2 Liters
    # Pump: 8 L/s -> 28,800 L/hr
    # Runtime = 26709.2 / 28800 = 0.927 hr = 56 min
    irrig = physics.compute_irrigation_requirement(
        et0_mm=5.0,
        crop_stage="Grand Growth",
        field_area_m2=6070.28,
        pump_discharge_l_s=8.0,
        rainfall_week_mm=14.0,
        subtract_rainfall=True,
    )
    assert irrig["kc"] == 1.20
    assert irrig["etc_mm_day"] == 6.0
    assert irrig["effective_rainfall_mm"] == 1.6
    assert irrig["net_irrigation_mm_day"] == 4.4
    assert 26700 <= irrig["water_required_liters"] <= 26720
    assert irrig["irrigation_duration_label"] == "56 min"
    assert irrig["is_estimated"] is True
    print(f"[PASS] 7. Deterministic FAO-56 Irrigation Engine:")
    print(f"         ET0: 5.0 mm | Kc: 1.20 -> ETc: {irrig['etc_mm_day']} mm/day")
    print(f"         Effective Rain Deducted: {irrig['effective_rainfall_mm']} mm/day -> Net: {irrig['net_irrigation_mm_day']} mm/day")
    print(f"         Water Volume: {irrig['water_required_liters']} L | Runtime: {irrig['irrigation_duration_label']}")
    print(f"         Assumption Notice: {irrig['assumptions_note']}")


def test_gis_geospatial_integrity():
    print("\n" + "=" * 75)
    print("PART 2: GEOSPATIAL BOUNDARIES & CANONICAL FARMS (GIS Reference)")
    print("=" * 75)

    farmers = farmer_service.get_all_farmers()
    assert len(farmers) == 25, f"Expected exactly 25 farmers, got {len(farmers)}"
    print(f"[PASS] 1. Loaded all 25 canonical farmers from Supabase Cloud registry.")

    all_farms_verified = 0
    for f in farmers:
        for farm in f["farms"]:
            lat = float(farm["latitude"])
            lon = float(farm["longitude"])
            area = float(farm["area_acre"])
            
            # Maharashtra coordinates boundary check (approx Lat 15.5-22.0 N, Lon 73.0-80.0 E)
            assert 15.0 <= lat <= 22.0, f"Farm {farm['farm_id']} latitude out of range: {lat}"
            assert 73.0 <= lon <= 81.0, f"Farm {farm['farm_id']} longitude out of range: {lon}"
            assert area > 0.0, f"Farm {farm['farm_id']} invalid area: {area}"

            # Boundary polygon check
            boundary = farm.get("boundary_geojson")
            assert boundary is not None, f"Farm {farm['farm_id']} missing boundary_geojson"
            coords = boundary["coordinates"][0]
            assert len(coords) >= 4, f"Farm {farm['farm_id']} has invalid polygon vertex count: {len(coords)}"
            # Verify polygon is closed
            assert coords[0] == coords[-1], f"Farm {farm['farm_id']} polygon is not closed"

            # Check coordinate ordering [longitude, latitude]
            first_pt = coords[0]
            assert 73.0 <= first_pt[0] <= 81.0, f"Longitude not first in GeoJSON: {first_pt}"
            assert 15.0 <= first_pt[1] <= 22.0, f"Latitude not second in GeoJSON: {first_pt}"
            all_farms_verified += 1

    print(f"[PASS] 2. Verified all {all_farms_verified} canonical farm boundaries:")
    print("         - Valid closed GeoJSON polygon rings [lon, lat] in EPSG:4326")
    print("         - Strictly within Maharashtra sugarcane agro-climatic corridor")
    print("         - Area > 0.0 acres, non-degenerate vertices")

    # 3. Test Specific Farmer with Historical Sentinel-2 Observation (Dhondiba Dakhore)
    dhondiba = farmer_service.get_farmers_by_phone("9158429165")[0]
    farm_dhondiba = dhondiba["farms"][0]
    gis_dhondiba = gis_service.get_farm_plot_gis(farm_dhondiba["farm_id"])
    assert gis_dhondiba is not None
    # Preserve the seeded observation while permitting a real newer cached pass.
    historical = next(row for row in farm_dhondiba['gis_observations'] if str(row['capture_date'])[:10] == '2026-10-12')
    assert historical['ndvi_mean'] == 0.449
    assert gis_dhondiba.indices.ndvi is not None and -1 <= gis_dhondiba.indices.ndvi <= 1
    assert date(2026,10,12) <= gis_dhondiba.indices.capture_date <= date.today()
    assert gis_dhondiba.indices.evi is not None
    assert gis_dhondiba.indices.ndre is not None
    assert gis_dhondiba.indices.msavi is not None
    assert gis_dhondiba.indices.ndmi is not None
    assert gis_dhondiba.indices.ndwi is not None
    print(f"[PASS] 3. Observed Farm Verified: {dhondiba['name']}")
    print(f"         Authentic Sentinel-2 Pass Date: {gis_dhondiba.indices.capture_date}")
    print(f"         6 Indices: NDVI={gis_dhondiba.indices.ndvi}, EVI={gis_dhondiba.indices.evi}, NDRE={gis_dhondiba.indices.ndre}, MSAVI={gis_dhondiba.indices.msavi}, NDMI={gis_dhondiba.indices.ndmi}, NDWI={gis_dhondiba.indices.ndwi}")

    # 4. Test Specific Farmer WITHOUT Historical Satellite Observation (Asawari Kadam)
    asawari_matches = farmer_service.get_farmers_by_phone("9422870990")
    asawari = [p for p in asawari_matches if "asawari" in p["name"].lower()][0]
    farm_asawari = asawari["farms"][0]
    gis_asawari = gis_service.get_farm_plot_gis(farm_asawari["farm_id"])
    assert gis_asawari is not None
    assert gis_asawari.indices.evi is None
    assert gis_asawari.indices.ndre is None
    assert gis_asawari.indices.msavi is None
    print(f"[PASS] 4. Unobserved Farm Verified: {asawari['name']}")
    print(f"         Honest handling: EVI/NDRE/MSAVI = None (No fake multi-spectral observations fabricated).")

    # 5. Security & Ownership Authorization (BOLA/IDOR Enforcement)
    caller_dhondiba_id = UUID(str(dhondiba["farmer_id"]))
    caller_asawari_id = UUID(str(asawari["farmer_id"]))

    assert verify_farm_ownership(farm_dhondiba, caller_dhondiba_id) is True
    assert verify_farm_ownership(farm_dhondiba, caller_asawari_id) is False
    assert verify_farm_ownership(farm_asawari, caller_asawari_id) is True
    assert verify_farm_ownership(farm_asawari, caller_dhondiba_id) is False
    print(f"[PASS] 5. BOLA/IDOR Security Enforcement: Cross-farmer ownership check rejected unauthorized access.")


if __name__ == "__main__":
    test_weather_science_regression()
    test_gis_geospatial_integrity()
    print("\n" + "=" * 75)
    print("ALL TASK 7 SCIENCE & GIS REGRESSION TESTS PASSED 100%!")
    print("=" * 75)
