
"""Persist genuine Sentinel-2 rasters in private Supabase Storage.

Only authorized GIS routes should call this module.

This module:
- Uses real, cloud-masked Sentinel-2 raster images.
- Never generates synthetic satellite observations.
- Stores private raster PNG files in Supabase Storage.
- Publishes a manifest only after the image upload succeeds.
- Handles missing manifests for farms generating their first raster.
- Preserves existing index images from the same observation date.
"""

import asyncio
import json
import logging
import math

from datetime import date, datetime, timezone
from pathlib import Path
from urllib.parse import quote
from uuid import UUID

import httpx

from app.core.config import settings
from .satellite_refresh import (
    KEYS,
    save_genuine_raster_locally,
)


logger = logging.getLogger(__name__)

BUCKET = "satellite-tiff"

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"

MAX_PNG_BYTES = 8_000_000
MAX_MANIFEST_BYTES = 50_000

# Prevent simultaneous manifest updates for the
# same farm within this Python process.
_locks: dict[str, asyncio.Lock] = {}


# ============================================================
# 1. SUPABASE SERVER-SIDE AUTHENTICATION
# ============================================================

def _credentials():
    """Get private Supabase credentials from backend settings.

    These credentials must never be included in the
    frontend or returned to the farmer application.
    """

    base = str(
        getattr(settings, "SUPABASE_URL", "") or ""
    ).rstrip("/")

    secret = str(
        getattr(settings, "SUPABASE_SECRET_KEY", "") or ""
    )

    if not base.startswith("https://") or not secret:
        raise RuntimeError(
            "Supabase private Storage is not configured. "
            "Check SUPABASE_URL and SUPABASE_SECRET_KEY."
        )

    return base, {
        "apikey": secret,
        "Authorization": f"Bearer {secret}",
    }


# ============================================================
# 2. VALIDATE GENUINE RASTER BOUNDS
# ============================================================

def _valid_bounds(value):
    """Validate geographic bounds in Leaflet format.

    Expected:
        [[south, west], [north, east]]
    """

    try:
        (south, west), (north, east) = value

        south = float(south)
        west = float(west)
        north = float(north)
        east = float(east)

        coordinates = (
            south,
            west,
            north,
            east,
        )

        return (
            all(math.isfinite(n) for n in coordinates)
            and -90 <= south < north <= 90
            and -180 <= west < east <= 180
        )

    except (
        TypeError,
        ValueError,
        IndexError,
    ):
        return False


# ============================================================
# 3. READ AN EXISTING PRIVATE RASTER MANIFEST
# ============================================================

async def _read_manifest(
    client,
    base,
    headers,
    farm_id,
):
    """Read the existing raster manifest for a farm.

    When a farm generates its first raster, manifest.json
    does not exist yet.

    Supabase Storage may report a missing object with
    HTTP 400 or HTTP 404, depending on its error response.

    Only an explicit missing-object error is treated
    as an empty manifest.

    Other errors remain visible for diagnosis.
    """

    manifest_path = (
        f"rasters/{farm_id}/manifest.json"
    )

    encoded_path = quote(
        manifest_path,
        safe="/",
    )

    url = (
        f"{base}/storage/v1/object/authenticated/"
        f"{BUCKET}/{encoded_path}"
    )

    response = await client.get(
        url,
        headers=headers,
    )

    # ----------------------------------------
    # CASE 1: Existing manifest found
    # ----------------------------------------

    if response.status_code == 200:

        if len(response.content) > MAX_MANIFEST_BYTES:
            raise RuntimeError(
                "Raster manifest is unexpectedly large."
            )

        try:
            manifest = response.json()

        except ValueError as error:
            raise RuntimeError(
                "Raster manifest contains invalid JSON."
            ) from error

        if not isinstance(manifest, dict):
            raise RuntimeError(
                "Raster manifest has an invalid format."
            )

        return manifest

    # ----------------------------------------
    # CASE 2: Supabase returned an error
    # ----------------------------------------

    try:
        error_data = response.json()

    except ValueError:
        error_data = {}

    if not isinstance(error_data, dict):
        error_data = {}

    error_code = str(
        error_data.get("code")
        or error_data.get("errorCode")
        or error_data.get("error")
        or ""
    ).lower()

    error_message = str(
        error_data.get("message")
        or ""
    ).lower()

    # Recognize a missing individual Storage object,
    # but NOT a missing bucket or permission failure.
    object_missing = (
        "object not found" in error_message
        or "no such key" in error_message
        or "resource was not found" in error_message
        or (
            error_code in {
                "nosuchkey",
                "not_found",
            }
            and "bucket" not in error_message
            and "permission" not in error_message
        )
    )

    if (
        response.status_code in (400, 404)
        and object_missing
    ):
        logger.info(
            "No raster manifest exists yet for farm %s. "
            "Creating a new manifest.",
            farm_id,
        )

        return {}

    # ----------------------------------------
    # CASE 3: Genuine Storage error
    # ----------------------------------------

    # Never log authorization headers or tokens.
    logger.error(
        "Raster manifest read failed: "
        "farm=%s, HTTP=%s, code=%s, message=%s",
        farm_id,
        response.status_code,
        error_code[:80],
        error_message[:160],
    )

    raise RuntimeError(
        "Cannot read raster manifest "
        f"(HTTP {response.status_code}; "
        f"code={error_code[:80] or 'unknown'}; "
        f"message={error_message[:160] or 'unavailable'})."
    )


# ============================================================
# 4. UPLOAD A PRIVATE SUPABASE STORAGE OBJECT
# ============================================================

async def _upload(
    client,
    base,
    headers,
    path,
    content,
    content_type,
):
    """Upload a raster PNG or JSON manifest.

    The bucket must already exist and be private.
    Only server-side credentials are used.
    """

    encoded_path = quote(
        path,
        safe="/",
    )

    url = (
        f"{base}/storage/v1/object/"
        f"{BUCKET}/{encoded_path}"
    )

    upload_headers = {
        **headers,
        "Content-Type": content_type,
        "x-upsert": "true",
        "Cache-Control": "max-age=60",
    }

    response = await client.post(
        url,
        headers=upload_headers,
        content=content,
    )

    if response.status_code in (200, 201):
        logger.info(
            "Private GIS raster object uploaded: %s",
            path,
        )

        return

    # Return useful diagnostic details without
    # exposing any private authentication tokens.
    try:
        error_data = response.json()

    except ValueError:
        error_data = {}

    if not isinstance(error_data, dict):
        error_data = {}

    error_code = str(
        error_data.get("code")
        or error_data.get("errorCode")
        or error_data.get("error")
        or "unknown"
    )

    error_message = str(
        error_data.get("message")
        or "Upload rejected"
    )

    logger.error(
        "Private raster upload failed: "
        "HTTP=%s, path=%s, code=%s, message=%s",
        response.status_code,
        path,
        error_code[:80],
        error_message[:160],
    )

    raise RuntimeError(
        "Private raster upload failed "
        f"(HTTP {response.status_code}; "
        f"code={error_code[:80]}; "
        f"message={error_message[:160]})."
    )


# ============================================================
# 5. GENERATE AND PERSIST A REAL SATELLITE RASTER
# ============================================================

async def save_genuine_raster_persistently(
    farm,
    index_name,
    capture_date,
):
    """Generate and store one authentic Sentinel-2 raster.

    This function is called explicitly by the protected
    GIS raster-generation endpoint.

    Steps:
      1. Validate farm, index and observation date.
      2. Check server-side Supabase credentials.
      3. Get a genuine Copernicus PNG or cached PNG.
      4. Read the existing private raster manifest.
      5. Upload the actual PNG to private Supabase Storage.
      6. Publish the updated manifest.
      7. Return the manifest to the GIS service.

    It does not create synthetic heatmaps and does not
    modify farmer observation records.
    """

    # ----------------------------------------
    # Validate farm ID
    # ----------------------------------------

    farm_id = str(
        UUID(str(farm["farm_id"]))
    )

    # ----------------------------------------
    # Validate satellite index
    # ----------------------------------------

    index = str(index_name).lower()

    if index not in KEYS:
        raise ValueError(
            "Unsupported satellite index."
        )

    # ----------------------------------------
    # Validate observation date
    # ----------------------------------------

    day = date.fromisoformat(
        str(capture_date)[:10]
    )

    today = datetime.now(
        timezone.utc
    ).date()

    if day > today:
        raise ValueError(
            "Cannot publish a future satellite observation."
        )

    # ----------------------------------------
    # Check Supabase BEFORE satellite processing
    # ----------------------------------------

    base, headers = _credentials()

    # Lock only this farm's manifest operations.
    lock = _locks.setdefault(
        farm_id,
        asyncio.Lock(),
    )

    async with lock:

        # ------------------------------------
        # Obtain actual cloud-masked raster
        # ------------------------------------

        metadata = await save_genuine_raster_locally(
            farm,
            index,
            day.isoformat(),
        )

        # ------------------------------------
        # Validate the returned metadata
        # ------------------------------------

        if (
            metadata.get("source")
            != "copernicus_process"
            or metadata.get("index")
            != index
            or metadata.get("acquisition_date")
            != day.isoformat()
            or not _valid_bounds(
                metadata.get("bounds")
            )
        ):
            raise RuntimeError(
                "Genuine satellite raster metadata "
                "failed validation."
            )

        # ------------------------------------
        # Load locally generated PNG
        # ------------------------------------

        image_file = Path(
            metadata["local_path"]
        )

        png_bytes = image_file.read_bytes()

        if not png_bytes.startswith(
            PNG_SIGNATURE
        ):
            raise RuntimeError(
                "Satellite raster file is not a valid PNG."
            )

        if (
            len(png_bytes) == 0
            or len(png_bytes) > MAX_PNG_BYTES
        ):
            raise RuntimeError(
                "Satellite raster PNG has an invalid size."
            )

        # ------------------------------------
        # Set private Storage paths
        # ------------------------------------

        raster_path = (
            f"rasters/{farm_id}/"
            f"{day.isoformat()}/{index}.png"
        )

        manifest_path = (
            f"rasters/{farm_id}/manifest.json"
        )

        # ------------------------------------
        # Upload and publish
        # ------------------------------------

        async with httpx.AsyncClient(
            timeout=45,
            follow_redirects=False,
        ) as client:

            # Missing manifest is normal on the
            # first raster generation.
            existing = await _read_manifest(
                client,
                base,
                headers,
                farm_id,
            )

            existing_date = str(
                existing.get("acquisition_date")
                or ""
            )

            # Avoid replacing a newer spatial
            # observation with an older one.
            if existing_date > day.isoformat():
                raise RuntimeError(
                    "A newer raster observation "
                    "is already published for this farm."
                )

            # Upload PNG FIRST.
            await _upload(
                client,
                base,
                headers,
                raster_path,
                png_bytes,
                "image/png",
            )

            previous_paths = {}

            # Preserve existing index images from
            # the same observation date and bounds.
            if (
                existing.get("source")
                == "copernicus_process"
                and existing_date
                == day.isoformat()
                and existing.get("bounds")
                == metadata["bounds"]
                and isinstance(
                    existing.get("overlay_paths"),
                    dict,
                )
            ):

                prefix = (
                    f"rasters/{farm_id}/"
                    f"{day.isoformat()}/"
                )

                previous_paths = {
                    key: path
                    for key, path in
                    existing["overlay_paths"].items()
                    if (
                        key in KEYS
                        and isinstance(path, str)
                        and path
                        == f"{prefix}{key}.png"
                    )
                }

            # ------------------------------------
            # Create the updated manifest
            # ------------------------------------

            manifest = {
                "source": "copernicus_process",
                "acquisition_date": day.isoformat(),
                "bounds": metadata["bounds"],
                "resolution_meters": metadata.get("resolution_meters", 10.0),
                "composite_start_date": metadata.get("composite_start_date"),
                "composite_end_date": metadata.get("composite_end_date"),
                "valid_pixel_coverage_pct": metadata.get("valid_pixel_coverage_pct"),
                "coverage_by_index": {
                    **(existing.get("coverage_by_index", {}) if previous_paths and isinstance(existing.get("coverage_by_index"), dict) else {}),
                    index: metadata.get("valid_pixel_coverage_pct"),
                },
                "raster_schema_version": metadata.get("raster_schema_version", 2),
                "overlay_paths": {
                    **previous_paths,
                    index: raster_path,
                },
            }

            manifest_bytes = json.dumps(
                manifest,
                ensure_ascii=False,
            ).encode("utf-8")

            if len(manifest_bytes) > MAX_MANIFEST_BYTES:
                raise RuntimeError(
                    "Raster manifest exceeds the size limit."
                )

            # Publish manifest AFTER PNG upload.
            await _upload(
                client,
                base,
                headers,
                manifest_path,
                manifest_bytes,
                "application/json",
            )

        logger.info(
            "Genuine Sentinel-2 raster stored successfully: "
            "farm=%s, index=%s, date=%s",
            farm_id,
            index,
            day.isoformat(),
        )

        return manifest
