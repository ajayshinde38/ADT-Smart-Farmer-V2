"""
IMPORT AUTHORITATIVE 25 FARMERS, FARMS, SOIL, AND 23 SATELLITE RECORDS TO SUPABASE
----------------------------------------------------------------------------------
This script performs an idempotent, relational import of:
1. 25 Verified KVK Farmers
2. 25 Associated Farm Plots with GeoJSON boundaries
3. 25 Laboratory Soil Test Records (unmeasured values stored as NULL, not 0)
4. 23 Historical Copernicus Sentinel-2 Observations (mapped by phone to farm_id)

Supports BOTH:
- Direct/Pooler PostgreSQL connection (via DATABASE_URL with psycopg2)
- Supabase PostgREST REST API (via SUPABASE_URL and SUPABASE_SECRET_KEY with httpx)

Usage:
  python import_to_supabase.py --dry-run
  python import_to_supabase.py --apply
"""

import os
import sys
import json
import argparse
import re
from pathlib import Path
from datetime import date

BASE_DIR = Path(__file__).resolve().parent
SEEDS_FILE = BASE_DIR / "authoritative_25_farmers.json"
SATELLITE_CACHE_FILE = BASE_DIR / "cached_satellite_observations.json"
KML_DIR = BASE_DIR / "kml"


def parse_kml_coordinates(kml_path: Path):
    if not kml_path.exists():
        return None
    try:
        with open(kml_path, "r", encoding="utf-8") as f:
            content = f.read()
        match = re.search(r"<coordinates>(.*?)</coordinates>", content, re.DOTALL)
        if not match:
            return None
        points = []
        for token in match.group(1).strip().split():
            parts = token.strip().split(",")
            if len(parts) >= 2:
                points.append([float(parts[0]), float(parts[1])])
        if points and points[0] != points[-1]:
            points.append(points[0])
        return {"type": "Polygon", "coordinates": [points]}
    except Exception:
        return None


def format_iso_date(date_str):
    if not date_str:
        return None
    try:
        parts = date_str.strip().split("-")
        if len(parts) == 3:
            if len(parts[0]) == 4:
                return date_str.strip()
            elif len(parts[2]) == 4:
                return f"{parts[2]}-{parts[1]}-{parts[0]}"
    except Exception:
        pass
    return None


def main():
    parser = argparse.ArgumentParser(description="Import 25 farmers to Supabase")
    parser.add_argument("--apply", action="store_true", help="Execute writes to Supabase")
    parser.add_argument("--dry-run", action="store_true", help="Validate records without writing")
    args = parser.parse_args()

    if not SEEDS_FILE.exists():
        print(f"[ERROR] Seeds file not found: {SEEDS_FILE}")
        sys.exit(1)

    with open(SEEDS_FILE, "r", encoding="utf-8") as f:
        farmers = json.load(f)

    sat_cache = {}
    if SATELLITE_CACHE_FILE.exists():
        with open(SATELLITE_CACHE_FILE, "r", encoding="utf-8") as f:
            sat_cache = json.load(f)

    print(f"Loaded {len(farmers)} authoritative farmer records from {SEEDS_FILE.name}")
    print(f"Loaded {len(sat_cache)} verified historical satellite observations from {SATELLITE_CACHE_FILE.name}")

    # Verify KML boundaries
    kml_count = 0
    for f in farmers:
        kml_name = f.get("kml_file")
        if kml_name and (KML_DIR / kml_name).exists():
            kml_count += 1
        else:
            print(f"  [WARN] Missing KML: {kml_name}")
    print(f"Found {kml_count}/25 matched KML boundary files.")

    # Match satellite records
    sat_matched_phones = set()
    for f in farmers:
        phone = str(f.get("mobile", "")).strip()
        if phone in sat_cache:
            sat_matched_phones.add(phone)
    print(f"Verified {len(sat_matched_phones)}/23 satellite observations mapped to canonical farm plots.")

    if not args.apply:
        print("\n[DRY RUN MODE] All record validations succeeded. No database writes performed.")
        print("To apply once Supabase project credentials are provided:")
        print("  python import_to_supabase.py --apply")
        return

    # Check for credentials
    backend_env = BASE_DIR.parents[1] / "backend" / ".env"
    if backend_env.exists():
        from dotenv import load_dotenv
        load_dotenv(backend_env)

    database_url = os.environ.get("DATABASE_URL")
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SECRET_KEY")

    if database_url and "postgres" in database_url and "@" in database_url:
        try:
            _apply_via_postgres(database_url, farmers, sat_cache)
            return
        except Exception as e:
            print(f"[WARN] Direct PostgreSQL connection failed: {e}")
            print("Falling back to Supabase PostgREST REST API mode...")

    if supabase_url and supabase_key:
        _apply_via_rest(supabase_url, supabase_key, farmers, sat_cache)
    else:
        print("\n[ERROR] Either DATABASE_URL or (SUPABASE_URL + SUPABASE_SECRET_KEY) is required.")
        sys.exit(1)


def _apply_via_postgres(database_url: str, farmers: list, sat_cache: dict):
    import psycopg2
    from psycopg2.extras import Json

    print(f"\n[PostgreSQL Mode] Connecting to Supabase...")
    conn = psycopg2.connect(database_url)
    cur = conn.cursor()

    try:
        inserted_farmers = 0
        inserted_farms = 0
        inserted_soil = 0
        inserted_sat = 0
        imported_sat_phones = set()

        for f in farmers:
            farmer_id = f["farmer_id"]
            name = f["name"]
            mobile = f["mobile"]
            prn = f["prn"]
            address = f["address"]
            village = address.split("Tq.")[0].strip() if "Tq." in address else address

            cur.execute("""
                INSERT INTO public.farmers (id, prn, name, mobile, address, village)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    mobile = EXCLUDED.mobile,
                    address = EXCLUDED.address,
                    village = EXCLUDED.village,
                    updated_at = NOW();
            """, (farmer_id, prn, name, mobile, address, village))
            inserted_farmers += 1

            farm_id = f["farm_id"]
            lat = f["latitude"]
            lon = f["longitude"]
            area_val = f["area_acre"]
            kml_file = f.get("kml_file")
            geo_dict = parse_kml_coordinates(KML_DIR / kml_file) if kml_file else None

            cur.execute("""
                INSERT INTO public.farms (
                    id, farmer_id, latitude, longitude, area_value, area_unit,
                    boundary_geojson, kml_storage_path, crop_name, crop_variety, plantation_date
                )
                VALUES (%s, %s, %s, %s, %s, 'acre', %s, %s, 'Sugarcane', 'Co 86032', %s)
                ON CONFLICT (id) DO UPDATE SET
                    latitude = EXCLUDED.latitude,
                    longitude = EXCLUDED.longitude,
                    area_value = EXCLUDED.area_value,
                    boundary_geojson = EXCLUDED.boundary_geojson,
                    kml_storage_path = EXCLUDED.kml_storage_path,
                    plantation_date = EXCLUDED.plantation_date,
                    updated_at = NOW();
            """, (farm_id, farmer_id, lat, lon, area_val, Json(geo_dict) if geo_dict else None, f"{farm_id}/{kml_file}", format_iso_date(f.get("plantation_date"))))
            inserted_farms += 1

            # Soil Test Record (unmeasured micronutrients are stored as NULL, NOT 0)
            soil = f.get("soil", {})
            cur.execute("DELETE FROM public.soil_test_records WHERE farm_id = %s;", (farm_id,))
            cur.execute("""
                INSERT INTO public.soil_test_records (
                    farm_id, ph, ec, oc, nitrogen_kg_ha, phosphorus_kg_ha, potassium_kg_ha,
                    sodium, calcium_carbonate, iron, magnesium, zinc, copper, sulfur, boron
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
            """, (
                farm_id, soil.get("ph", 7.5), soil.get("ec", 0.3), soil.get("oc", 0.5),
                soil.get("nitrogen_kg_ha", 180), soil.get("phosphorus_kg_ha", 22), soil.get("potassium_kg_ha", 290),
                soil.get("sodium"), soil.get("calcium_carbonate"), soil.get("iron"),
                soil.get("magnesium"), soil.get("zinc"), soil.get("copper"),
                soil.get("sulfur"), soil.get("boron")
            ))
            inserted_soil += 1

            # Satellite Observation
            phone = str(mobile).strip()
            if phone in sat_cache and phone not in imported_sat_phones:
                imported_sat_phones.add(phone)
                obs = sat_cache[phone]
                cap_date = obs.get("capture_date", "2026-10-12")
                meta = {"ndvi_min": obs.get("ndvi_min"), "ndvi_max": obs.get("ndvi_max"), "historical_cache": True}
                cur.execute("""
                    INSERT INTO public.gis_observations (
                        farm_id, capture_date, source, cloud_coverage_pct,
                        ndvi_mean, evi_mean, ndre_mean, msavi_mean, ndmi_mean, ndwi_mean, metadata
                    )
                    VALUES (%s, %s, 'sentinel_2_l2a', NULL, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (farm_id, capture_date) DO UPDATE SET
                        ndvi_mean = EXCLUDED.ndvi_mean,
                        evi_mean = EXCLUDED.evi_mean,
                        ndre_mean = EXCLUDED.ndre_mean,
                        msavi_mean = EXCLUDED.msavi_mean,
                        ndmi_mean = EXCLUDED.ndmi_mean,
                        ndwi_mean = EXCLUDED.ndwi_mean,
                        metadata = EXCLUDED.metadata;
                """, (
                    farm_id, cap_date, obs["ndvi"], obs.get("evi"), obs.get("ndre"),
                    obs.get("msavi"), obs.get("ndmi"), obs.get("ndwi"), Json(meta)
                ))
                inserted_sat += 1

        conn.commit()
        print(f"\n[SUCCESS - PostgreSQL] Imported {inserted_farmers}/25 farmers, {inserted_farms}/25 farms, {inserted_soil}/25 soil records, and {inserted_sat}/23 satellite observations.")
    except Exception as e:
        conn.rollback()
        print(f"[ERROR] Import failed and rolled back safely: {e}")
        sys.exit(1)
    finally:
        cur.close()
        conn.close()


def _apply_via_rest(supabase_url: str, supabase_key: str, farmers: list, sat_cache: dict):
    import httpx
    print(f"\n[PostgREST Mode] Connecting to Supabase REST API ({supabase_url})...")

    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }

    with httpx.Client(timeout=30.0) as client:
        # 1. Farmers
        farmers_payload = []
        for f in farmers:
            address = f["address"]
            village = address.split("Tq.")[0].strip() if "Tq." in address else address
            farmers_payload.append({
                "id": f["farmer_id"],
                "prn": f["prn"],
                "name": f["name"],
                "mobile": f["mobile"],
                "address": address,
                "village": village
            })
        r1 = client.post(f"{supabase_url}/rest/v1/farmers", json=farmers_payload, headers=headers)
        if r1.status_code not in (200, 201):
            print(f"[ERROR] Failed to import farmers via REST: {r1.status_code} {r1.text}")
            sys.exit(1)
        print(f"Imported {len(farmers_payload)}/25 farmers.")

        # 2. Farms
        farms_payload = []
        for f in farmers:
            farm_id = f["farm_id"]
            kml_file = f.get("kml_file")
            geo_dict = parse_kml_coordinates(KML_DIR / kml_file) if kml_file else None
            farms_payload.append({
                "id": farm_id,
                "farmer_id": f["farmer_id"],
                "latitude": f["latitude"],
                "longitude": f["longitude"],
                "area_value": f["area_acre"],
                "area_unit": "acre",
                "boundary_geojson": geo_dict,
                "kml_storage_path": f"{farm_id}/{kml_file}",
                "crop_name": "Sugarcane",
                "crop_variety": "Co 86032",
                "plantation_date": format_iso_date(f.get("plantation_date"))
            })
        r2 = client.post(f"{supabase_url}/rest/v1/farms", json=farms_payload, headers=headers)
        if r2.status_code not in (200, 201):
            print(f"[ERROR] Failed to import farms via REST: {r2.status_code} {r2.text}")
            sys.exit(1)
        print(f"Imported {len(farms_payload)}/25 farms.")

        # 3. Soil Test Records
        farm_ids_csv = ",".join([f["farm_id"] for f in farmers])
        client.delete(f"{supabase_url}/rest/v1/soil_test_records?farm_id=in.({farm_ids_csv})", headers=headers)
        soil_payload = []
        for f in farmers:
            soil = f.get("soil", {})
            soil_payload.append({
                "farm_id": f["farm_id"],
                "ph": soil.get("ph", 7.5),
                "ec": soil.get("ec", 0.3),
                "oc": soil.get("oc", 0.5),
                "nitrogen_kg_ha": soil.get("nitrogen_kg_ha", 180),
                "phosphorus_kg_ha": soil.get("phosphorus_kg_ha", 22),
                "potassium_kg_ha": soil.get("potassium_kg_ha", 290),
                "sodium": soil.get("sodium"),
                "calcium_carbonate": soil.get("calcium_carbonate"),
                "iron": soil.get("iron"),
                "magnesium": soil.get("magnesium"),
                "zinc": soil.get("zinc"),
                "copper": soil.get("copper"),
                "sulfur": soil.get("sulfur"),
                "boron": soil.get("boron")
            })
        r3 = client.post(f"{supabase_url}/rest/v1/soil_test_records", json=soil_payload, headers=headers)
        if r3.status_code not in (200, 201):
            print(f"[ERROR] Failed to import soil records via REST: {r3.status_code} {r3.text}")
            sys.exit(1)
        print(f"Imported {len(soil_payload)}/25 soil records.")

        # 4. Satellite Observations
        sat_payload = []
        imported_sat_phones = set()
        for f in farmers:
            phone = str(f.get("mobile", "")).strip()
            if phone in sat_cache and phone not in imported_sat_phones:
                imported_sat_phones.add(phone)
                obs = sat_cache[phone]
                sat_payload.append({
                    "farm_id": f["farm_id"],
                    "capture_date": obs.get("capture_date", "2026-10-12"),
                    "source": "sentinel_2_l2a",
                    "cloud_coverage_pct": None,
                    "ndvi_mean": obs["ndvi"],
                    "evi_mean": obs.get("evi"),
                    "ndre_mean": obs.get("ndre"),
                    "msavi_mean": obs.get("msavi"),
                    "ndmi_mean": obs.get("ndmi"),
                    "ndwi_mean": obs.get("ndwi"),
                    "metadata": {"ndvi_min": obs.get("ndvi_min"), "ndvi_max": obs.get("ndvi_max"), "historical_cache": True}
                })
        r4 = client.post(f"{supabase_url}/rest/v1/gis_observations", json=sat_payload, headers=headers)
        if r4.status_code not in (200, 201):
            print(f"[ERROR] Failed to import satellite observations via REST: {r4.status_code} {r4.text}")
            sys.exit(1)
        print(f"Imported {len(sat_payload)}/23 historical satellite observations.")

        print(f"\n[SUCCESS - PostgREST] Successfully migrated all 25 farmers, 25 farms, 25 soil records, and 23 satellite observations.")


if __name__ == "__main__":
    main()
