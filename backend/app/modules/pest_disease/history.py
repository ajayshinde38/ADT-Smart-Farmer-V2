import io
from uuid import UUID, uuid4
import httpx
from PIL import Image
from fastapi import HTTPException
from app.core.config import settings
from app.core.database import supabase_storage
from app.core.operations import record_event

BUCKET='disease-images'


def headers():
    key=settings.SUPABASE_SECRET_KEY or settings.SUPABASE_KEY
    return {'apikey':key,'Authorization':'Bearer '+key,'Prefer':'return=representation'} if key else None


async def save_scan(farm,data,result):
    auth=headers()
    if not auth:
        return None
    identifier=uuid4()
    path=f"{farm['farm_id']}/{identifier}.jpg"
    try:
        image=Image.open(io.BytesIO(data)).convert('RGB')
        image.thumbnail((1600,1600))
        buffer=io.BytesIO()
        image.save(buffer,format='JPEG',quality=85)
        if not await supabase_storage.upload_file(BUCKET,path,buffer.getvalue(),'image/jpeg'):
            record_event('scan_storage','Private scan image upload failed')
            return None
        row={'id':str(identifier),'farm_id':str(farm['farm_id']),'farmer_id':str(farm['farmer_id']),
             'image_storage_path':path,'detected_disease':result.detected_disease,'confidence_score':result.confidence_score,
             'affected_percentage':result.affected_percentage,'severity_level':result.severity_level,'status':result.status,
             'treatment_summary':result.disease_details.prevention if result.disease_details else None}
        async with httpx.AsyncClient(timeout=12) as client:
            response=await client.post(settings.SUPABASE_URL.rstrip('/')+'/rest/v1/pest_disease_records',headers=auth,json=row)
        if response.status_code not in (200,201):
            record_event('scan_storage','Private image saved, but scan history record could not be written')
            return None
        record_event('scan_completed','A farm-associated image analysis was recorded',200)
        return identifier
    except (httpx.HTTPError,OSError,ValueError):
        record_event('scan_storage','Scan history could not be saved')
        return None


async def image_bytes(record_id,caller_id=None,admin_authorized=False):
    auth=headers()
    if not auth:
        return None
    async with httpx.AsyncClient(timeout=12) as client:
        response=await client.get(settings.SUPABASE_URL.rstrip('/')+'/rest/v1/pest_disease_records',headers=auth,
            params={'id':'eq.'+str(UUID(str(record_id))),'select':'farm_id,image_storage_path','limit':1})
        if response.status_code!=200 or not response.json():
            return None
        row=response.json()[0]
        if not admin_authorized:
            from app.farmers.service import get_farm_by_id
            from app.core.security import verify_farm_ownership
            if caller_id is None or not verify_farm_ownership(get_farm_by_id(row['farm_id']),caller_id):
                raise HTTPException(403,'This recorded image does not belong to your account')
        path=row['image_storage_path']
        if '..' in path or '://' in path or path.startswith('/'):
            return None
        signed=await supabase_storage.get_signed_url(BUCKET,path,expires_in=60)
        if not signed or not signed.startswith(settings.SUPABASE_URL.rstrip('/')+'/'):
            return None
        image=await client.get(signed)
        return image.content if image.status_code==200 else None
