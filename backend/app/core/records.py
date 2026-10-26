"""Read existing application histories without inventing tables or database records."""
from uuid import UUID
import httpx
from app.core.config import settings


async def read_records(table, *, farm_id=None, farmer_id=None, limit=200):
    if table not in ('pest_disease_records', 'advisory_results', 'weather_observations'):
        raise ValueError('Unsupported record collection')
    key = settings.SUPABASE_SECRET_KEY or settings.SUPABASE_KEY
    if not key or not settings.SUPABASE_URL:
        return {'available':False, 'items':[], 'reason':'History storage is not configured.'}
    params = {'select':'*', 'limit':min(limit,1000), 'order':('calculated_at' if table=='advisory_results' else 'observation_date' if table=='weather_observations' else 'created_at')+'.desc'}
    if farm_id:
        params['farm_id'] = 'eq.'+str(UUID(str(farm_id)))
    if farmer_id:
        params['farmer_id'] = 'eq.'+str(UUID(str(farmer_id)))
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(settings.SUPABASE_URL.rstrip('/')+'/rest/v1/'+table, params=params,
                headers={'apikey':key,'Authorization':'Bearer '+key})
        if response.status_code != 200:
            return {'available':False, 'items':[], 'reason':'Stored history is currently unavailable.'}
        rows=response.json()
        # Private image paths stay on the backend. Images are served through protected endpoints.
        for row in rows:
            row['has_image']=bool(row.get('image_storage_path'))
            row.pop('image_storage_path',None)
            row.pop('overlay_storage_path',None)
        return {'available':True, 'items':rows, 'limit':min(limit,1000), 'reason':None}
    except (httpx.HTTPError,ValueError):
        return {'available':False, 'items':[], 'reason':'Stored history is currently unavailable.'}
