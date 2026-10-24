import logging
from pathlib import Path
from typing import Optional, Dict, Any
from uuid import UUID
from datetime import date

from app.farmers import service as farmer_service
from app.modules.gis.schemas import GISPlotResponse, VegetationIndices, GeoJSONGeometry, RasterOverlayInfo
from app.modules.gis.sentinel import classify_crop_health
from app.core.database import supabase_storage

PILOT_FARM_ID_STR = "fa0094b2-c218-441d-bc1a-870f0a01430b"
PILOT_BOUNDS = [[19.209149, 77.112733], [19.210312, 77.113232]]  # [[south, west], [north, east]]
PILOT_SCENE_ID = "S2B_MSIL2A_20241012T051649_N0511_R062_T43QGB_20241012T082350"


logger = logging.getLogger(__name__)


def get_farm_plot_gis(farm_id: UUID | str) -> Optional[GISPlotResponse]:
    """
    Resolves farm polygon geometry and satellite vegetation indices
    directly from Supabase cloud database records.
    """
    farm = farmer_service.get_farm_by_id(farm_id)
    if not farm:
        return None

    # 1. Farm Boundary Geometry directly from Supabase GeoJSON
    geometry_dict = farm.get("boundary_geojson")
    
    # Fallback to parsing local KML file if GeoJSON was not recorded
    if not geometry_dict and farm.get("kml_file"):
        from app.modules.gis.kml_parser import parse_kml_file
        kml_dir = Path(__file__).resolve().parents[4] / "database" / "seeds" / "kml"
        kml_path = kml_dir / farm["kml_file"]
        if kml_path.exists():
            geometry_dict = parse_kml_file(kml_path)

    # 2. Satellite observations directly from Supabase gis_observations table
    gis_obs_list = farm.get("gis_observations", [])
    
    from .satellite_refresh import cached_observation
    observations = []
    for raw in gis_obs_list:
        try:
            captured = date.fromisoformat(str(raw.get('capture_date', ''))[:10])
            if captured <= date.today():
                observations.append((captured, raw))
        except ValueError:
            continue
    recent = cached_observation(str(farm['farm_id']))
    if recent:
        observations.append((date.fromisoformat(recent['capture_date']), {**{f'{key}_mean': recent.get(key) for key in ('ndvi','evi','ndre','msavi','ndmi','ndwi')}, **recent}))
    latest = max(observations, key=lambda item: item[0]) if observations else None
    latest_obs = latest[1] if latest else {}
    obs_date = latest[0] if latest else None
    import math
    def measured(key):
        try:
            value = float(latest_obs.get(f'{key}_mean'))
            return value if math.isfinite(value) and -1 <= value <= 1 else None
        except (TypeError, ValueError):
            return None
    ndvi_val, evi_val, ndre_val, msavi_val, ndmi_val, ndwi_val = [measured(key) for key in ('ndvi','evi','ndre','msavi','ndmi','ndwi')]
    cloud_pct = latest_obs.get('cloud_coverage_pct')

    indices = VegetationIndices(
        ndvi=ndvi_val,
        evi=evi_val,
        ndre=ndre_val,
        msavi=msavi_val,
        ndmi=ndmi_val,
        ndwi=ndwi_val,
        capture_date=obs_date,
        cloud_coverage_pct=cloud_pct
    )

    health = classify_crop_health(ndvi_val)

    # 3. Check for genuine Sentinel-2 raster pilot data
    farm_id_str = str(farm["farm_id"]).lower()
    raster_info: Optional[RasterOverlayInfo] = None
    if farm_id_str == PILOT_FARM_ID_STR:
        raster_info = RasterOverlayInfo(
            is_available=True,
            scene_id=PILOT_SCENE_ID,
            acquisition_date="2024-10-12",
            resolution_meters=10.0,
            bounds=PILOT_BOUNDS,
            overlay_urls={
                idx: f"/api/v1/gis/plot/{farm_id_str}/raster/{idx}.png"
                for idx in ["ndvi", "evi", "ndre", "msavi", "ndmi", "ndwi"]
            },
            geotiff_path=f"rasters/{PILOT_FARM_ID_STR}/20241012_s2b_l2a_indices.tif"
        )

    result = GISPlotResponse(
        farm_id=UUID(farm["farm_id"]),
        farmer_id=UUID(farm["farmer_id"]),
        farmer_name=farm["name"],
        latitude=farm["latitude"],
        longitude=farm["longitude"],
        area_acres=farm["area_acre"],
        geometry=GeoJSONGeometry(**geometry_dict) if geometry_dict else None,
        indices=indices,
        health=health,
        raster=raster_info
    )
    from app.farmers.context import build_field_context
    result.field_context = build_field_context(farm, result)
    return result


def get_raster_png_bytes(farm_id: UUID | str, index_name: str) -> Optional[bytes]:
    """
    Retrieves genuine Sentinel-2 index PNG bytes for the authorized pilot farm parcel.
    First checks the local seed cache, then private Supabase storage.
    """
    f_id_str = str(farm_id).lower()
    idx_clean = index_name.lower().replace(".png", "")
    if idx_clean not in {"ndvi", "evi", "ndre", "msavi", "ndmi", "ndwi"}:
        return None

    # 1. Local disk cache
    base_dir = Path(__file__).resolve().parents[4] / "database" / "seeds" / "rasters" / f_id_str
    local_file = base_dir / f"20241012_{idx_clean}.png"
    if local_file.exists():
        return local_file.read_bytes()

    return None


async def get_raster_geotiff_signed_url(farm_id: UUID | str) -> Optional[str]:
    """Generates an authorized signed download URL for the authentic GeoTIFF in Supabase storage."""
    f_id_str = str(farm_id).lower()
    if f_id_str != PILOT_FARM_ID_STR:
        return None
    remote_path = f"rasters/{f_id_str}/20241012_s2b_l2a_indices.tif"
    return await supabase_storage.get_signed_url("satellite-tiff", remote_path, expires_in=3600)


async def get_kml_signed_download_url(farm_id: UUID | str) -> Optional[str]:
    """Generates an authorized signed download URL for the private KML object in Supabase storage."""
    farm = farmer_service.get_farm_by_id(farm_id)
    if not farm or not farm.get("kml_storage_path"):
        return None
    return await supabase_storage.get_signed_url("kml-storage", farm["kml_storage_path"], expires_in=3600)

