import time
import logging
from typing import List, Optional, Dict, Any
from uuid import UUID
import httpx
from fastapi import HTTPException, status

from app.core.config import settings

logger = logging.getLogger(__name__)

# In-memory synchronized cache from Supabase cloud
_CACHE_FARMERS: Dict[str, Dict[str, Any]] = {}
_CACHE_FARMS: Dict[str, Dict[str, Any]] = {}
_CACHE_BY_PHONE: Dict[str, List[Dict[str, Any]]] = {}
_LAST_SYNC_TIMESTAMP: float = 0.0
_CACHE_TTL_SECONDS: float = 60.0  # Refresh periodically from cloud


def _fetch_from_supabase(force: bool = False) -> None:
    """
    Directly query Supabase Cloud PostgREST API to populate the authoritative farmer registry.
    If Supabase is unreachable and no valid cache exists, raises HTTP 503.
    """
    global _CACHE_FARMERS, _CACHE_FARMS, _CACHE_BY_PHONE, _LAST_SYNC_TIMESTAMP

    now = time.time()
    if not force and _CACHE_FARMERS and (now - _LAST_SYNC_TIMESTAMP < _CACHE_TTL_SECONDS):
        return

    supabase_url = settings.SUPABASE_URL.rstrip("/")
    secret_key = settings.SUPABASE_SECRET_KEY or settings.SUPABASE_KEY

    if not supabase_url or not secret_key:
        logger.error("Supabase credentials not configured in backend settings.")
        if not _CACHE_FARMERS:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Cloud database configuration is missing. Cannot fetch authoritative farmer registry."
            )
        return

    headers = {
        "apikey": secret_key,
        "Authorization": f"Bearer {secret_key}",
        "Content-Type": "application/json"
    }

    endpoint = f"{supabase_url}/rest/v1/farmers?select=*,farms(*,soil_test_records(*),gis_observations(*))"

    try:
        with httpx.Client(timeout=12.0) as client:
            resp = client.get(endpoint, headers=headers)
            if resp.status_code != 200:
                logger.error(f"Supabase returned HTTP {resp.status_code} when querying farmers.")
                if not _CACHE_FARMERS:
                    raise HTTPException(
                        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                        detail=f"Supabase cloud database returned error code {resp.status_code}."
                    )
                return

            data = resp.json()

            new_farmers: Dict[str, Dict[str, Any]] = {}
            new_farms: Dict[str, Dict[str, Any]] = {}
            new_by_phone: Dict[str, List[Dict[str, Any]]] = {}

            for f in data:
                farmer_id_str = str(f["id"])
                phone = str(f.get("mobile", "")).strip()
                clean_phone = phone.replace(" ", "").replace("+91", "")

                farmer_dict: Dict[str, Any] = {
                    "id": f["id"],
                    "farmer_id": f["id"],
                    "prn": f.get("prn"),
                    "name": f["name"],
                    "mobile": phone,
                    "address": f.get("address", ""),
                    "village": f.get("village", ""),
                    "taluka": f.get("taluka"),
                    "district": f.get("district"),
                    "factory_hub": f.get("factory_hub"),
                    "farms": []
                }

                farms_list = f.get("farms", [])
                for farm in farms_list:
                    farm_id_str = str(farm["id"])
                    area_acre_val = float(farm.get("area_acres") or farm.get("area_value", 0.0))
                    
                    soil_records = farm.get("soil_test_records", [])
                    primary_soil = soil_records[0] if soil_records else {}

                    gis_obs = farm.get("gis_observations", [])

                    kml_path = farm.get("kml_storage_path") or ""
                    kml_file = kml_path.split("/")[-1] if kml_path else None

                    farm_dict: Dict[str, Any] = {
                        "id": farm["id"],
                        "farm_id": farm["id"],
                        "farmer_id": f["id"],
                        "farmer_name": f["name"],
                        "name": f["name"],
                        "mobile": phone,
                        "address": f.get("address", ""),
                        "village": f.get("village", ""),
                        "latitude": float(farm["latitude"]),
                        "longitude": float(farm["longitude"]),
                        "area_value": float(farm["area_value"]),
                        "area_unit": farm.get("area_unit", "acre"),
                        "area_acre": area_acre_val,
                        "area_acres": area_acre_val,
                        "area_hectares": float(farm["area_hectares"]) if farm.get("area_hectares") is not None else None,
                        "crop_name": farm.get("crop_name", "Sugarcane"),
                        "crop_variety": farm.get("crop_variety", "Co 86032"),
                        "plantation_date": farm.get("plantation_date"),
                        "growth_stage": farm.get("growth_stage", "Unknown"),
                        "crop_season": farm.get('crop_season'),
                        "target_yield_ton_ha": farm.get('target_yield_ton_ha'),
                        "boundary_geojson": farm.get("boundary_geojson"),
                        "boundary_source": farm.get("boundary_source", "kml"),
                        "kml_storage_path": kml_path,
                        "kml_file": kml_file,
                        "soil": primary_soil,
                        "soil_test_records": soil_records,
                        "gis_observations": gis_obs
                    }

                    farmer_dict["farms"].append(farm_dict)
                    new_farms[farm_id_str] = farm_dict

                # Populate default farm fields on farmer profile for backwards compatibility
                if farmer_dict["farms"]:
                    p_farm = farmer_dict["farms"][0]
                    farmer_dict["farm_id"] = p_farm["farm_id"]
                    farmer_dict["latitude"] = p_farm["latitude"]
                    farmer_dict["longitude"] = p_farm["longitude"]
                    farmer_dict["area_acre"] = p_farm["area_acre"]
                    farmer_dict["area_acres"] = p_farm["area_acres"]
                    farmer_dict["area_hectares"] = p_farm["area_hectares"]
                    farmer_dict["crop_name"] = p_farm["crop_name"]
                    farmer_dict["crop_variety"] = p_farm["crop_variety"]
                    farmer_dict["plantation_date"] = p_farm["plantation_date"]
                    farmer_dict["growth_stage"] = p_farm["growth_stage"]
                    farmer_dict["kml_file"] = p_farm["kml_file"]
                    farmer_dict["kml_storage_path"] = p_farm["kml_storage_path"]
                    farmer_dict["boundary_geojson"] = p_farm["boundary_geojson"]
                    farmer_dict["soil"] = p_farm["soil"]
                    farmer_dict["gis_observations"] = p_farm["gis_observations"]

                new_farmers[farmer_id_str] = farmer_dict

                if clean_phone not in new_by_phone:
                    new_by_phone[clean_phone] = []
                new_by_phone[clean_phone].append(farmer_dict)

            _CACHE_FARMERS = new_farmers
            _CACHE_FARMS = new_farms
            _CACHE_BY_PHONE = new_by_phone
            _LAST_SYNC_TIMESTAMP = now
            logger.info(f"Synchronized {len(_CACHE_FARMERS)} canonical farmers from Supabase Cloud.")

    except Exception as exc:
        logger.error(f"Error querying Supabase cloud database: {exc}")
        if not _CACHE_FARMERS:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Supabase cloud database is unreachable ({type(exc).__name__})."
            )


def get_all_farmers() -> List[Dict[str, Any]]:
    _fetch_from_supabase()
    return list(_CACHE_FARMERS.values())


def get_farmer_by_id(farmer_id: UUID | str) -> Optional[Dict[str, Any]]:
    _fetch_from_supabase()
    return _CACHE_FARMERS.get(str(farmer_id))


def get_farmers_by_phone(phone: str) -> List[Dict[str, Any]]:
    _fetch_from_supabase()
    clean_phone = phone.strip().replace(" ", "").replace("+91", "")
    return _CACHE_BY_PHONE.get(clean_phone, [])


def get_farm_by_id(farm_id: UUID | str) -> Optional[Dict[str, Any]]:
    _fetch_from_supabase()
    return _CACHE_FARMS.get(str(farm_id))


def get_farms_by_farmer_id(farmer_id: UUID | str) -> List[Dict[str, Any]]:
    _fetch_from_supabase()
    farmer = _CACHE_FARMERS.get(str(farmer_id))
    if farmer and "farms" in farmer:
        return farmer["farms"]
    return []


def get_farmer_soil_data(identifier: UUID | str) -> Optional[Dict[str, Any]]:
    """Lookup soil data by farmer_id or farm_id from Supabase-synced records."""
    _fetch_from_supabase()
    id_str = str(identifier)
    record = _CACHE_FARMS.get(id_str) or _CACHE_FARMERS.get(id_str)
    if record and "soil" in record and record["soil"]:
        return record["soil"]
    return None
