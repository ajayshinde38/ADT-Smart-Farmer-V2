from fastapi import APIRouter, HTTPException, UploadFile, File, Depends, Form
from typing import List, Optional
from uuid import UUID
from starlette.concurrency import run_in_threadpool
from app.core.security import require_authorized_farmer
from PIL import Image, UnidentifiedImageError
import io
import logging

from app.modules.pest_disease.schemas import DiseaseDetectionResponse, DiseaseDetail
from app.modules.pest_disease import service

router = APIRouter(prefix="/pest-disease", tags=["Pest & Disease Detection"])


@router.get("/catalog", response_model=List[DiseaseDetail])
def list_disease_catalog():
    """Get the sugarcane disease and pest advisory catalog."""
    return service.get_all_diseases()


@router.get("/catalog/{disease_name}", response_model=DiseaseDetail)
def get_disease_detail(disease_name: str):
    """Get symptoms, causes, prevention, and chemical recommendations for a disease."""
    item = service.get_disease_by_name(disease_name)
    if not item:
        raise HTTPException(status_code=404, detail="Disease not found in catalog")
    return item


@router.post("/detect", response_model=DiseaseDetectionResponse)
async def detect_leaf_disease(file: UploadFile = File(...), farm_id: Optional[UUID] = Form(None), caller_id=Depends(require_authorized_farmer), save_history:bool=Form(False)):
    """
    Upload crop leaf photo for AI-powered UNet segmentation, disease diagnosis,
    and recommended chemical treatment.
    """
    farm = None
    if farm_id:
        from app.farmers.service import get_farm_by_id
        from app.core.security import verify_farm_ownership
        farm = await run_in_threadpool(get_farm_by_id, farm_id)
        if farm is None:
            raise HTTPException(status_code=404, detail='Farm not found')
        if not verify_farm_ownership(farm, caller_id):
            raise HTTPException(status_code=403, detail='This farm does not belong to your account')
    image_bytes = await file.read(8 * 1024 * 1024 + 1)
    if not image_bytes:
        raise HTTPException(status_code=400, detail='Empty image file received')
    if len(image_bytes) > 8 * 1024 * 1024:
        raise HTTPException(status_code=413, detail='Choose an image smaller than 8 MB')
    try:
        with Image.open(io.BytesIO(image_bytes)) as image:
            if image.format not in ('JPEG', 'PNG', 'WEBP') or image.width * image.height > 20_000_000:
                raise ValueError('Unsupported image')
            image.verify()
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        raise HTTPException(status_code=422, detail='Choose a valid JPEG, PNG or WebP image under 20 megapixels')
    try:
        result = await run_in_threadpool(service.diagnose_leaf_image, image_bytes)
        if farm is not None:
            from app.farmers.context import build_field_context
            from app.modules.gis.service import get_farm_plot_gis
            from app.modules.weather.service import get_cached_farm_weather
            try:
                plot = await run_in_threadpool(get_farm_plot_gis, farm_id)
            except Exception as error:
                logging.getLogger(__name__).warning('Scan satellite context unavailable: %s', type(error).__name__)
                plot = None
            result.field_context = build_field_context(farm, plot, get_cached_farm_weather(farm_id))
            if save_history is True:
                from app.modules.pest_disease.history import save_scan
                result.record_id=await save_scan(farm,image_bytes,result)
                result.record_saved=result.record_id is not None
                result.history_note=None if result.record_saved else 'Analysis completed, but private history could not be saved.'
        return result
    except RuntimeError:
        from app.core.operations import record_event
        record_event('scan_failed','Image model inference was unavailable',503)
        raise HTTPException(status_code=503, detail='Image analysis is unavailable. Please try again with a clear leaf photo.')


@router.get('/history/{farm_id}')
async def history(farm_id:UUID,caller_id=Depends(require_authorized_farmer)):
    from app.farmers.service import get_farm_by_id
    from app.core.security import verify_farm_ownership
    from app.core.records import read_records
    farm=await run_in_threadpool(get_farm_by_id,farm_id)
    if not farm:
        raise HTTPException(404,'Farm not found')
    if not verify_farm_ownership(farm,caller_id):
        raise HTTPException(403,'This farm does not belong to your account')
    return await read_records('pest_disease_records',farm_id=farm_id)


@router.get('/history-image/{record_id}')
async def history_image(record_id:UUID,caller_id=Depends(require_authorized_farmer)):
    from app.modules.pest_disease.history import image_bytes
    from fastapi import Response
    data=await image_bytes(record_id,caller_id=caller_id)
    if data is None:
        raise HTTPException(404,'Recorded image unavailable')
    return Response(data,media_type='image/jpeg',headers={'Cache-Control':'private, no-store'})
