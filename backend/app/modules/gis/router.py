from fastapi import APIRouter, HTTPException, Path, Depends, Response
from uuid import UUID

from app.modules.gis.schemas import GISPlotResponse
from app.modules.gis import service
from app.farmers import service as farmer_service
from app.core.security import require_authorized_farmer, verify_farm_ownership

router = APIRouter(prefix="/gis", tags=["GIS & Satellite Crop Health"])


@router.get("/plot/{farm_id}", response_model=GISPlotResponse)
def get_plot_gis_data(farm_id: UUID, caller_id: UUID = Depends(require_authorized_farmer)):
    """
    Get farm polygon boundary from KML and current Copernicus Sentinel-2
    vegetation indices (NDVI, EVI, NDRE, MSAVI, NDMI, NDWI) and canopy health status.
    Protected by farm ownership authorization.
    """
    farm = farmer_service.get_farm_by_id(farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    if caller_id and not verify_farm_ownership(farm, caller_id):
        raise HTTPException(status_code=403, detail="Forbidden: You are not authorized to view this farm's satellite observations")

    data = service.get_farm_plot_gis(farm_id)
    if not data:
        raise HTTPException(status_code=404, detail="Farm geometry or GIS data not found")
    return data


@router.get("/plot/{farm_id}/raster/{index_name}.png")
def get_plot_raster_png(farm_id: UUID, index_name: str, caller_id: UUID = Depends(require_authorized_farmer)):
    """
    Returns authentic Sentinel-2 per-pixel index raster image for authorized pilot farm parcel.
    """
    farm = farmer_service.get_farm_by_id(farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    if caller_id and not verify_farm_ownership(farm, caller_id):
        raise HTTPException(status_code=403, detail="Forbidden: You are not authorized to view this farm's raster data")

    png_bytes = service.get_raster_png_bytes(farm_id, index_name)
    if not png_bytes:
        raise HTTPException(status_code=404, detail="Raster overlay not available for this plot")

    return Response(
        content=png_bytes,
        media_type="image/png",
        headers={"Cache-Control": "private, max-age=86400"}
    )



@router.post('/plot/{farm_id}/refresh', response_model=GISPlotResponse)
async def refresh_plot_observation(farm_id: UUID, caller_id: UUID = Depends(require_authorized_farmer)):
    farm = farmer_service.get_farm_by_id(farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail='Farm not found')
    if not verify_farm_ownership(farm, caller_id):
        raise HTTPException(status_code=403, detail='Forbidden: You are not authorized to update this farm')
    from .satellite_refresh import refresh_observation
    try:
        await refresh_observation(farm)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error))
    except Exception:
        raise HTTPException(status_code=503, detail='Satellite update unavailable. Existing observations are preserved.')
    return service.get_farm_plot_gis(farm_id)
