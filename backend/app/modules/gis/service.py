
"""Farm GIS records and authenticated access to genuine satellite raster assets.

Raster availability is advertised only for the historical verified pilot scene,
valid local Copernicus Process PNGs, or a trusted private Storage manifest.
This module NEVER manufactures spatial values from field averages and does not
trigger Copernicus processing during normal GIS requests.

For new hosted imagery, place a verified manifest in the private Supabase bucket
'satellite-tiff' at rasters/<farm_uuid>/manifest.json, e.g.:
{
  "source": "copernicus_process",
  "acquisition_date": "2026-10-12",
  "bounds": [[19.20, 77.11], [19.21, 77.12]],
  "resolution_meters": 10,
  "overlay_paths": {
    "ndvi": "rasters/<farm_uuid>/2026-10-12/ndvi.png"
  }
}
Both manifest and images must be produced from actual cloud-masked Sentinel-2
observations. The private raster endpoint enforces farm ownership in router.py.
"""

import json
import logging
import math
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Optional
from urllib.parse import quote
from uuid import UUID

import httpx

from app.core.config import settings
from app.core.database import supabase_storage
from app.farmers import service as farmer_service
from app.modules.gis.schemas import (
    GISPlotResponse,
    GeoJSONGeometry,
    RasterOverlayInfo,
    VegetationIndices,
)
from app.modules.gis.sentinel import classify_crop_health
from .satellite_refresh import CACHE_DIR, KEYS, cached_observation

logger = logging.getLogger(__name__)

PILOT_FARM_ID_STR = "fa0094b2-c218-441d-bc1a-870f0a01430b"
PILOT_BOUNDS = [[19.209149, 77.112733], [19.210312, 77.113232]]
PILOT_SCENE_ID = "S2B_MSIL2A_20241012T051649_N0511_R062_T43QGB_20241012T082350"
PILOT_DATE = "2024-10-12"
STORAGE_BUCKET = "satellite-tiff"
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def _farm_uuid(farm_id: UUID | str) -> str:
    return str(UUID(str(farm_id)))


def _date(value: Any) -> Optional[date]:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value)[:10])
    except (TypeError, ValueError):
        return None


def _measurement(
    observation: dict[str, Any],
    key: str,
) -> Optional[float]:
    value = observation.get(
        f"{key}_mean",
        observation.get(key),
    )

    try:
        number = float(value)
    except (ValueError, TypeError):
        return None

    return number if math.isfinite(number) and -1 <= number <= 1 else None


def _valid_bounds(value: Any) -> bool:
    """Leaflet bounds: [[south, west], [north, east]]."""

    try:
        south, west = (float(x) for x in value[0])
        north, east = (float(x) for x in value[1])

        return (
            all(math.isfinite(x) for x in (south, west, north, east))
            and -90 <= south < north <= 90
            and -180 <= west < east <= 180
        )
    except (TypeError, ValueError, IndexError):
        return False


def _private_storage_bytes(
    path: str,
    *,
    max_bytes: int = 8_000_000,
) -> Optional[bytes]:
    """Read a private Supabase object using server-side credentials."""

    secret = getattr(settings, "SUPABASE_SECRET_KEY", None)
    base = getattr(settings, "SUPABASE_URL", None)

    if not secret or not base or not path.startswith("rasters/"):
        return None

    url = (
        f"{str(base).rstrip('/')}/storage/v1/object/authenticated/"
        f"{STORAGE_BUCKET}/{quote(path, safe='/')}"
    )

    try:
        with httpx.Client(
            timeout=8,
            follow_redirects=False,
        ) as client:
            with client.stream(
                "GET",
                url,
                headers={
                    "apikey": secret,
                    "Authorization": f"Bearer {secret}",
                },
            ) as response:

                if response.status_code != 200:
                    return None

                chunks: list[bytes] = []
                total = 0

                for chunk in response.iter_bytes():
                    total += len(chunk)

                    if total > max_bytes:
                        logger.warning(
                            "GIS private object too large: %s",
                            path,
                        )
                        return None

                    chunks.append(chunk)

                return b"".join(chunks)

    except httpx.HTTPError as error:
        logger.warning(
            "GIS private Storage read failed (%s): %s",
            path,
            type(error).__name__,
        )
        return None


def _validated_cloud_manifest(
    farm_id: str,
) -> Optional[dict[str, Any]]:

    raw = _private_storage_bytes(
        f"rasters/{farm_id}/manifest.json",
        max_bytes=50_000,
    )

    if not raw:
        return None

    try:
        manifest = json.loads(raw)

        captured = _date(
            manifest.get("acquisition_date")
        )

        if (
            not isinstance(manifest, dict)
            or manifest.get("source") != "copernicus_process"
            or captured is None
            or captured > datetime.now(timezone.utc).date()
            or not _valid_bounds(manifest.get("bounds"))
        ):
            return None

        paths = manifest.get("overlay_paths")

        if not isinstance(paths, dict):
            return None

        # The manifest can only reference this farm's private rasters.
        prefix = f"rasters/{farm_id}/"

        valid = {
            key: path
            for key, path in paths.items()
            if key in KEYS
            and isinstance(path, str)
            and path.startswith(prefix)
            and path.endswith(
                f"/{captured.isoformat()}/{key}.png"
            )
            and ".." not in path
        }

        if not valid:
            return None

        manifest["overlay_paths"] = valid
        return manifest

    except (ValueError, TypeError, AttributeError):
        return None


def _local_raster_manifest(
    farm_id: str,
) -> Optional[dict[str, Any]]:
    """Discover real rasters saved by save_genuine_raster_locally()."""

    root = CACHE_DIR / farm_id

    if not root.is_dir():
        return None

    today = datetime.now(timezone.utc).date()

    for folder in sorted(
        root.iterdir(),
        key=lambda x: x.name,
        reverse=True,
    ):
        captured = _date(folder.name)

        if (
            not folder.is_dir()
            or not captured
            or captured > today
        ):
            continue

        available: dict[str, str] = {}
        bounds = None

        for key in KEYS:
            png = folder / f"{key}.png"
            info = folder / f"{key}.json"

            if not png.is_file() or not info.is_file():
                continue

            try:
                meta = json.loads(
                    info.read_text(encoding="utf-8")
                )

                if (
                    meta.get("source") != "copernicus_process"
                    or meta.get("index") != key
                    or str(meta.get("acquisition_date"))
                    != captured.isoformat()
                    or not _valid_bounds(meta.get("bounds"))
                ):
                    continue

                with png.open("rb") as stream:
                    if stream.read(8) != PNG_SIGNATURE:
                        continue

                if bounds is None:
                    bounds = meta["bounds"]

                if meta["bounds"] != bounds:
                    continue

                available[key] = str(png)

            except (OSError, TypeError, ValueError):
                continue

        if available and bounds is not None:
            return {
                "source": "copernicus_process",
                "acquisition_date": captured.isoformat(),
                "resolution_meters": 10.0,
                "bounds": bounds,
                "local_paths": available,
            }

    return None


def _raster_metadata(
    farm_id: str,
) -> tuple[
    Optional[RasterOverlayInfo],
    Optional[dict[str, Any]],
]:
    local = _local_raster_manifest(farm_id)
    cloud = _validated_cloud_manifest(farm_id)

    options = [
        value for value in (local, cloud) if value
    ]

    if options:
        chosen = max(
            options,
            key=lambda value: str(
                value["acquisition_date"]
            ),
        )

        indexes = (
            chosen.get("local_paths")
            or chosen.get("overlay_paths")
            or {}
        )

        info = RasterOverlayInfo(
            is_available=True,
            scene_id=chosen.get("scene_id"),
            acquisition_date=chosen["acquisition_date"],
            resolution_meters=chosen.get(
                "resolution_meters",
                10.0,
            ),
            bounds=chosen["bounds"],
            overlay_urls={
                key: (
                    f"/api/v1/gis/plot/"
                    f"{farm_id}/raster/{key}.png"
                )
                for key in indexes
            },
        )

        return info, chosen

    # Preserve the historical verified 2024 pilot raster.
    if farm_id == PILOT_FARM_ID_STR:
        return RasterOverlayInfo(
            is_available=True,
            scene_id=PILOT_SCENE_ID,
            acquisition_date=PILOT_DATE,
            resolution_meters=10.0,
            bounds=PILOT_BOUNDS,
            overlay_urls={
                key: (
                    f"/api/v1/gis/plot/"
                    f"{farm_id}/raster/{key}.png"
                )
                for key in KEYS
            },
            geotiff_path=(
                f"rasters/{farm_id}/"
                "20241012_s2b_l2a_indices.tif"
            ),
        ), None

    return None, None


def get_farm_plot_gis(
    farm_id: UUID | str,
) -> Optional[GISPlotResponse]:
    """Load real farm geometry, satellite averages and raster metadata."""

    farm = farmer_service.get_farm_by_id(farm_id)

    if not farm:
        return None

    farm_id_str = _farm_uuid(
        farm["farm_id"]
    )

    geometry = farm.get("boundary_geojson")

    # Existing local KML fallback.
    if not geometry and farm.get("kml_file"):
        from app.modules.gis.kml_parser import parse_kml_file

        name = str(farm["kml_file"])

        if Path(name).name == name:
            directory = (
                Path(__file__).resolve().parents[4]
                / "database"
                / "seeds"
                / "kml"
            )

            candidate = directory / name

            if candidate.is_file():
                geometry = parse_kml_file(candidate)

    observed: list[
        tuple[date, dict[str, Any]]
    ] = []

    today = datetime.now(timezone.utc).date()

    for row in farm.get("gis_observations") or []:
        if not isinstance(row, dict):
            continue

        captured = _date(
            row.get("capture_date")
        )

        if captured is not None and captured <= today:
            observed.append((captured, row))

    # Local Copernicus statistics are actual observations.
    cached = cached_observation(
        farm_id_str
    )

    if cached:
        captured = _date(
            cached.get("capture_date")
        )

        if captured and captured <= today:
            observed.append((captured, cached))

    if observed:
        latest_date, latest = max(
            observed,
            key=lambda entry: entry[0],
        )
    else:
        latest_date, latest = None, {}

    values = {
        key: _measurement(latest, key)
        for key in KEYS
    }

    indices = VegetationIndices(
        **values,
        capture_date=latest_date,
        cloud_coverage_pct=latest.get(
            "cloud_coverage_pct"
        ),
    )

    raster, _ = _raster_metadata(
        farm_id_str
    )

    result = GISPlotResponse(
        farm_id=UUID(farm_id_str),
        farmer_id=UUID(
            str(farm["farmer_id"])
        ),
        farmer_name=farm["name"],
        latitude=farm["latitude"],
        longitude=farm["longitude"],
        area_acres=farm["area_acre"],
        geometry=(
            GeoJSONGeometry(**geometry)
            if geometry
            else None
        ),
        indices=indices,
        health=classify_crop_health(
            values["ndvi"]
        ),
        raster=raster,
    )

    from app.farmers.context import build_field_context

    result.field_context = build_field_context(
        farm,
        result,
    )

    return result


def get_raster_png_bytes(
    farm_id: UUID | str,
    index_name: str,
) -> Optional[bytes]:
    """Return a real raster PNG, after caller authorization."""

    farm_id_str = _farm_uuid(
        farm_id
    )

    index = (
        str(index_name)
        .lower()
        .removesuffix(".png")
    )

    if index not in KEYS:
        return None

    _, chosen = _raster_metadata(
        farm_id_str
    )

    if chosen:
        local = chosen.get(
            "local_paths",
            {},
        ).get(index)

        if local:
            try:
                content = Path(local).read_bytes()

                if content.startswith(PNG_SIGNATURE):
                    return content

            except OSError:
                pass

        remote = chosen.get(
            "overlay_paths",
            {},
        ).get(index)

        if remote:
            content = _private_storage_bytes(remote)

            if (
                content
                and content.startswith(PNG_SIGNATURE)
            ):
                return content

        return None

    # Preserve the verified historical raster fallback.
    if farm_id_str == PILOT_FARM_ID_STR:
        local_file = (
            Path(__file__).resolve().parents[4]
            / "database"
            / "seeds"
            / "rasters"
            / farm_id_str
            / f"20241012_{index}.png"
        )

        try:
            content = local_file.read_bytes()

            if content.startswith(PNG_SIGNATURE):
                return content

        except OSError:
            pass

        # Pilot images also exist in the private cloud bucket.
        remote = (
            f"rasters/{farm_id_str}/"
            f"20241012_{index}.png"
        )

        content = _private_storage_bytes(remote)

        if (
            content
            and content.startswith(PNG_SIGNATURE)
        ):
            return content

    return None


async def get_raster_geotiff_signed_url(
    farm_id: UUID | str,
) -> Optional[str]:
    """Existing private historical pilot GeoTIFF."""

    farm_id_str = _farm_uuid(farm_id)

    if farm_id_str != PILOT_FARM_ID_STR:
        return None

    path = (
        f"rasters/{farm_id_str}/"
        "20241012_s2b_l2a_indices.tif"
    )

    return await supabase_storage.get_signed_url(
        STORAGE_BUCKET,
        path,
        expires_in=3600,
    )


async def get_kml_signed_download_url(
    farm_id: UUID | str,
) -> Optional[str]:
    """Existing private KML download."""

    farm = farmer_service.get_farm_by_id(farm_id)

    if not farm or not farm.get("kml_storage_path"):
        return None

    return await supabase_storage.get_signed_url(
        "kml-storage",
        farm["kml_storage_path"],
        expires_in=3600,
    )
