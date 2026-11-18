
"""Protected GIS routes for real Sentinel-2 satellite imagery."""

import logging
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Path,
    Response,
)

from app.core.security import (
    require_authorized_farmer,
    verify_farm_ownership,
)
from app.farmers import service as farmer_service
from app.modules.gis import service
from app.modules.gis.schemas import GISPlotResponse
from app.modules.gis.satellite_refresh import (
    KEYS,
    refresh_observation,
)
from app.modules.gis.raster_storage import (
    save_genuine_raster_persistently,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/gis",
    tags=["GIS & Satellite Crop Health"],
)


def _owned_farm(farm_id: UUID, caller_id: UUID) -> dict:
    """Verify the authenticated user owns the requested farm."""

    farm = farmer_service.get_farm_by_id(farm_id)

    if not farm:
        raise HTTPException(
            status_code=404,
            detail="Farm not found",
        )

    if (
        caller_id is None
        or not verify_farm_ownership(farm, caller_id)
    ):
        raise HTTPException(
            status_code=403,
            detail="Not authorized to access this farm",
        )

    return farm


@router.get(
    "/plot/{farm_id}",
    response_model=GISPlotResponse,
)
def get_plot_gis_data(
    farm_id: UUID,
    caller_id: UUID = Depends(require_authorized_farmer),
):
    """Return farm geometry, recorded indices and raster metadata."""

    _owned_farm(farm_id, caller_id)

    result = service.get_farm_plot_gis(farm_id)

    if result is None:
        raise HTTPException(
            status_code=404,
            detail="GIS data unavailable",
        )

    return result


@router.get(
    "/plot/{farm_id}/raster/{index_name}.png",
)
def get_plot_raster_png(
    farm_id: UUID,
    index_name: str = Path(
        description="Satellite index name"
    ),
    caller_id: UUID = Depends(require_authorized_farmer),
):
    """Serve an authentic satellite raster to its authorized farmer."""

    _owned_farm(farm_id, caller_id)

    index = index_name.lower()

    if index not in (*KEYS, "vra"):
        raise HTTPException(
            status_code=422,
            detail="Unsupported satellite index",
        )

    if index == "vra":
        from app.modules.gis.vra import ndvi_vra_zones
        original = service.get_raster_png_bytes(farm_id, "ndvi")
        ndre_original = service.get_raster_png_bytes(farm_id, "ndre")
        image = ndvi_vra_zones(original, use_fertinex_palette=True, ndre_bytes=ndre_original, rvi=0.48)[0] if original else None
    else:
        image = service.get_raster_png_bytes(farm_id, index)

    if not image:
        raise HTTPException(
            status_code=404,
            detail="Satellite raster not available",
        )

    return Response(
        content=image,
        media_type="image/png",
        headers={
            "Cache-Control": "private, max-age=60",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.post(
    "/plot/{farm_id}/refresh",
    response_model=GISPlotResponse,
)
async def refresh_plot_observation(
    farm_id: UUID,
    caller_id: UUID = Depends(require_authorized_farmer),
):
    """Refresh real field averages without generating new raster images."""

    farm = _owned_farm(farm_id, caller_id)

    try:
        await refresh_observation(farm)

    except ValueError as error:
        raise HTTPException(
            status_code=422,
            detail=str(error),
        ) from error

    except Exception:
        logger.exception(
            "Satellite observation refresh failed: %s",
            farm_id,
        )

        raise HTTPException(
            status_code=503,
            detail=(
                "Satellite update unavailable. "
                "Existing observations are preserved."
            ),
        ) from None

    result = service.get_farm_plot_gis(farm_id)

    if result is None:
        raise HTTPException(
            status_code=404,
            detail="GIS data unavailable",
        )

    return result


@router.post(
    "/plot/{farm_id}/raster/{index_name}/generate",
    response_model=GISPlotResponse,
)
async def generate_plot_raster(
    farm_id: UUID,
    index_name: str = Path(
        description="NDVI, EVI, NDRE, MSAVI, NDMI or NDWI"
    ),
    caller_id: UUID = Depends(require_authorized_farmer),
):
    """Generate and privately store one genuine satellite raster.

    This endpoint must be called explicitly. It does not run when
    opening the GIS screen or refreshing field averages.
    """

    farm = _owned_farm(farm_id, caller_id)

    index = index_name.lower()

    if index not in (*KEYS, "vra"):
        raise HTTPException(
            status_code=422,
            detail="Unsupported satellite index",
        )

    if not farm.get("boundary_geojson"):
        raise HTTPException(
            status_code=422,
            detail="A valid farm boundary is required",
        )

    current = service.get_farm_plot_gis(farm_id)

    if current is None:
        raise HTTPException(
            status_code=404,
            detail="GIS data unavailable",
        )

    observation_date = current.indices.capture_date

    if observation_date is None:
        raise HTTPException(
            status_code=409,
            detail=(
                "No dated satellite observation available. "
                "Refresh field averages first."
            ),
        )

    try:
        # Generate genuine cloud-masked pixels and upload
        # the PNG plus manifest to PRIVATE Supabase Storage.
        target_index = "ndvi" if index == "vra" else index
        await save_genuine_raster_persistently(
            farm,
            target_index,
            observation_date,
        )

    except ValueError as error:
        raise HTTPException(
            status_code=422,
            detail=str(error),
        ) from error

    except Exception:
        logger.exception(
            "Persistent raster generation failed: farm=%s index=%s",
            farm_id,
            index,
        )

        raise HTTPException(
            status_code=503,
            detail=(
                "Unable to generate or store satellite imagery. "
                "Existing observations are preserved."
            ),
        ) from None

    result = service.get_farm_plot_gis(farm_id)

    if result is None:
        raise HTTPException(
            status_code=404,
            detail="GIS data unavailable after raster generation",
        )

    return result


@router.get("/plot/{farm_id}/vra/summary")
def get_vra_zone_summary(
    farm_id: UUID,
    caller_id: UUID = Depends(require_authorized_farmer),
):
    """Exploratory NDVI spatial zones with FertiNex 3-zone precision prescription."""
    farm = _owned_farm(farm_id, caller_id)
    from app.modules.gis.vra import ndvi_vra_zones, compute_vra_precision_zones
    ndvi_png = service.get_raster_png_bytes(farm_id, "ndvi")
    if not ndvi_png:
        raise HTTPException(status_code=404, detail="Generate an NDVI raster first")
    _, summary = ndvi_vra_zones(ndvi_png)
    summary["prescription"] = compute_vra_precision_zones(farm, pixel_counts=summary.get("counts"))
    return summary


@router.get("/plot/{farm_id}/vra/prescription")
def get_vra_prescription(
    farm_id: UUID,
    caller_id: UUID = Depends(require_authorized_farmer),
):
    """FertiNex 3-Zone Variable Rate Application (VRA) Precision Prescription.
    Returns targeted product prescriptions for Zone 1 (+25%), Zone 2 (100%), and Zone 3 (-25%).
    Operates dynamically from Supabase farm profile, plantation date, and satellite indices.
    """
    farm = _owned_farm(farm_id, caller_id)
    from app.modules.gis.vra import compute_vra_precision_zones, ndvi_vra_zones
    pixel_counts = None
    try:
        ndvi_png = service.get_raster_png_bytes(farm_id, "ndvi")
        if ndvi_png:
            _, summary = ndvi_vra_zones(ndvi_png)
            pixel_counts = summary.get("counts")
    except Exception:
        pixel_counts = None
    return compute_vra_precision_zones(farm, pixel_counts=pixel_counts)

