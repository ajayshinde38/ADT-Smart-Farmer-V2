from fastapi import APIRouter, HTTPException, UploadFile, File, Depends, Form
from typing import List, Optional
from uuid import UUID
from starlette.concurrency import run_in_threadpool
from app.core.security import require_authorized_farmer
from PIL import Image, UnidentifiedImageError
import io
import logging
import httpx

from app.modules.pest_disease.schemas import DiseaseDetectionResponse, DiseaseDetail
from app.modules.pest_disease import service
from app.modules.pest_disease import history as scan_history

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
async def detect_leaf_disease(file: UploadFile = File(...), farm_id: Optional[UUID] = Form(None), caller_id=Depends(require_authorized_farmer), save_history:bool=Form(True), request_id: str = Form(None, max_length=120)):
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
    if farm is None:
        raise HTTPException(422, 'Select a farm before scanning; private history requires a farm.')
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
        identifier = scan_history.scan_identifier(farm_id, request_id if isinstance(request_id, str) and request_id else 'legacy', image_bytes)
        existing = await scan_history.saved_scan(identifier, farm_id)
        if existing:
            evidence=await scan_history.load_analysis(existing)
            if evidence:
                return DiseaseDetectionResponse(**{**evidence,'record_id':existing['id'],'record_saved':True,
                    'history_note':'Previously saved dual-model analysis recovered; no duplicate created.'})
            raise RuntimeError('The saved dual-model evidence is unavailable')
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
            # Saving is mandatory; legacy save_history=false cannot opt out.
            result.record_id=await scan_history.save_scan(farm,image_bytes,result,identifier=identifier)
            result.record_saved=result.record_id is not None
            result.history_note=None if result.record_saved else 'Analysis is not complete: private history could not be saved. Retry the same photo.'
        if not result.record_saved:
            raise HTTPException(503, 'Analysis could not be saved to private history. Retry the same photo; duplicate records will not be created.')
        return result
    except (RuntimeError, httpx.HTTPError, ValueError):
        from app.core.operations import record_event
        record_event('scan_failed','Image model inference was unavailable',503)
        raise HTTPException(status_code=503, detail='Scan or private-history service is unavailable. Retry the same photo shortly.')


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


@router.get('/history/{farm_id}/analysis/{record_id}')
async def history_analysis(farm_id:UUID,record_id:UUID,caller_id=Depends(require_authorized_farmer)):
    from app.farmers.service import get_farm_by_id
    from app.core.security import verify_farm_ownership
    farm=await run_in_threadpool(get_farm_by_id,farm_id)
    if not farm: raise HTTPException(404,'Farm not found')
    if not verify_farm_ownership(farm,caller_id): raise HTTPException(403,'This farm does not belong to your account')
    try:
        row=await scan_history.saved_scan(record_id,farm_id)
        if not row: raise HTTPException(404,'Scan record not found for this farm')
        evidence=await scan_history.load_analysis(row)
        return {'available':evidence is not None,'analysis':evidence,
            'reason':None if evidence else 'This older scan has no saved dual-model evidence.'}
    except (RuntimeError,httpx.HTTPError,ValueError):
        raise HTTPException(503,'Stored model evidence is currently unavailable')


@router.get('/history-image/{record_id}')
async def history_image(record_id:UUID,caller_id=Depends(require_authorized_farmer)):
    from app.modules.pest_disease.history import image_bytes
    from fastapi import Response
    data=await image_bytes(record_id,caller_id=caller_id)
    if data is None:
        raise HTTPException(404,'Recorded image unavailable')
    return Response(data,media_type='image/jpeg',headers={'Cache-Control':'private, no-store'})
