import io
import hashlib
from typing import Optional
from uuid import UUID, uuid4, uuid5, NAMESPACE_URL
import httpx
from PIL import Image
from fastapi import HTTPException
from app.core.config import settings
from app.core.database import supabase_storage
from app.core.operations import record_event

BUCKET = 'disease-images'


def headers():
    key = settings.SUPABASE_SECRET_KEY or settings.SUPABASE_KEY
    return {'apikey': key, 'Authorization': 'Bearer ' + key, 'Prefer': 'return=representation'} if key else None


def scan_identifier(farm_id, request_id: str, image_bytes: bytes) -> UUID:
    hash_val = hashlib.sha256(image_bytes).hexdigest()
    return uuid5(NAMESPACE_URL, f"adt-scan:dual-v1:{farm_id}:{request_id}:{hash_val}")


async def saved_scan(identifier: UUID, farm_id: UUID) -> Optional[dict]:
    auth = headers()
    if not auth or not settings.SUPABASE_URL:
        return None
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
                settings.SUPABASE_URL.rstrip('/') + '/rest/v1/pest_disease_records',
                headers=auth,
                params={
                    'id': f'eq.{str(identifier)}',
                    'farm_id': f'eq.{str(farm_id)}',
                    'limit': 1
                }
            )
        if resp.status_code != 200:
            raise RuntimeError('Private scan history is unavailable')
        rows = resp.json()
        return rows[0] if rows else None


async def save_scan(farm, data, result, identifier=None):
    auth = headers()
    if not auth:
        return None
    if identifier is None:
        identifier = uuid4()
    elif isinstance(identifier, str):
        identifier = UUID(identifier)
    path = f"{farm['farm_id']}/{identifier}.jpg"
    try:
        image = Image.open(io.BytesIO(data)).convert('RGB')
        image.thumbnail((1600, 1600))
        buffer = io.BytesIO()
        image.save(buffer, format='JPEG', quality=85)
        async with httpx.AsyncClient(timeout=30) as client:
            uploaded = await client.post(
                settings.SUPABASE_URL.rstrip('/') + f'/storage/v1/object/{BUCKET}/{path}',
                headers={**auth, 'Content-Type': 'image/jpeg', 'x-upsert': 'true'},
                content=buffer.getvalue(),
            )
        if uploaded.status_code not in (200, 201):
            record_event('scan_storage', 'Private scan image upload failed')
            return None
        # Private sidecar preserves both model outputs and the segmentation overlay
        # without adding unapproved columns to the existing records table.
        async with httpx.AsyncClient(timeout=30) as client:
            evidence=await client.post(
                settings.SUPABASE_URL.rstrip('/')+f'/storage/v1/object/{BUCKET}/{farm["farm_id"]}/{identifier}.analysis.json',
                headers={**auth,'Content-Type':'application/json','x-upsert':'true'},
                json={'farm_id':str(farm['farm_id']),'record_id':str(identifier),
                      'analysis':result.model_dump(mode='json',exclude={'field_context','record_id','record_saved','history_note'})})
        if evidence.status_code not in (200,201):
            record_event('scan_storage','Dual-model evidence could not be saved')
            return None
        row = {
            'id': str(identifier),
            'farm_id': str(farm['farm_id']),
            'farmer_id': str(farm['farmer_id']),
            'image_storage_path': path,
            'detected_disease': result.detected_disease,
            'confidence_score': result.confidence_score,
            'affected_percentage': result.affected_percentage,
            'severity_level': result.severity_level,
            'status': result.status,
            'treatment_summary': result.disease_details.prevention if result.disease_details else None
        }
        async with httpx.AsyncClient(timeout=12) as client:
            response = await client.post(
                settings.SUPABASE_URL.rstrip('/') + '/rest/v1/pest_disease_records',
                headers={**auth, 'Prefer': 'resolution=ignore-duplicates,return=representation'},
                params={'on_conflict': 'id'},
                json=row
            )
        if response.status_code not in (200, 201):
            record_event('scan_storage', 'Private image saved, but scan history record could not be written')
            return None
        if await saved_scan(identifier, farm['farm_id']) is None:
            return None
        record_event('scan_completed', 'A farm-associated image analysis was recorded', 200)
        return identifier
    except (httpx.HTTPError, OSError, ValueError):
        record_event('scan_storage', 'Scan history could not be saved')
        return None


async def load_analysis(row):
    auth=headers()
    if not auth:return None
    farm_id=str(UUID(str(row['farm_id'])))
    record_id=str(UUID(str(row['id'])))
    async with httpx.AsyncClient(timeout=12) as client:
        response=await client.get(settings.SUPABASE_URL.rstrip('/')+
            f'/storage/v1/object/authenticated/{BUCKET}/{farm_id}/{record_id}.analysis.json',headers=auth)
    if response.status_code in (400,404): return None  # Older records have no sidecar.
    if response.status_code!=200: raise RuntimeError('Stored model evidence is unavailable')
    if len(response.content)>2_000_000: raise RuntimeError('Stored evidence exceeds the expected size')
    payload=response.json()
    if payload.get('farm_id')!=farm_id or payload.get('record_id')!=record_id:
        raise RuntimeError('Stored model evidence does not match this record')
    return payload.get('analysis')


async def image_bytes(record_id, caller_id=None, admin_authorized=False):
    auth = headers()
    if not auth:
        return None
    async with httpx.AsyncClient(timeout=12) as client:
        response = await client.get(
            settings.SUPABASE_URL.rstrip('/') + '/rest/v1/pest_disease_records',
            headers=auth,
            params={'id': 'eq.' + str(UUID(str(record_id))), 'select': 'farm_id,image_storage_path', 'limit': 1}
        )
        if response.status_code != 200 or not response.json():
            return None
        row = response.json()[0]
        if not admin_authorized:
            from app.farmers.service import get_farm_by_id
            from app.core.security import verify_farm_ownership
            if caller_id is None or not verify_farm_ownership(get_farm_by_id(row['farm_id']), caller_id):
                raise HTTPException(403, 'This recorded image does not belong to your account')
        path = row['image_storage_path']
        if '..' in path or '://' in path or path.startswith('/'):
            return None
        signed = await supabase_storage.get_signed_url(BUCKET, path, expires_in=60)
        if not signed or not signed.startswith(settings.SUPABASE_URL.rstrip('/') + '/'):
            return None
        image = await client.get(signed)
        return image.content if image.status_code == 200 else None
