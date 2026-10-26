import csv
import io
from collections import Counter
from starlette.concurrency import run_in_threadpool
from datetime import date
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import BaseModel, Field
from app.admin.security import login_admin, require_admin
from app.admin import service
from app.core.operations import record_event
from app.core.records import read_records
from app.farmers import service as farmers
from app.modules.gis import service as gis
from app.modules.weather.service import get_farm_weather_overview
from app.modules.advisory.service import get_farm_advisory
from app.modules.advisory.router import CompositionRequest

router=APIRouter(prefix='/admin',tags=['Administrator'])


class AdminLogin(BaseModel):
    email:str=Field(min_length=3,max_length=254)
    password:str=Field(min_length=1,max_length=256)


@router.post('/auth/login')
async def login(payload:AdminLogin,request:Request):
    return await login_admin(payload.email.strip(),payload.password,request.client.host if request.client else 'unknown')


@router.get('/me')
async def me(admin=Depends(require_admin)):
    return admin


@router.get('/overview')
async def overview(admin=Depends(require_admin)):
    return await service.overview()


@router.get('/gis/farms')
def gis_registry(admin=Depends(require_admin)):
    return [service.admin_plot(gis.get_farm_plot_gis(farm['farm_id'])) for farmer in farmers.get_all_farmers() for farm in farmer.get('farms',[]) if farm.get('boundary_geojson')]


@router.get('/farmers')
async def directory(q:str='',village:str='',satellite:str='all',sort:str='name',page:int=Query(1,ge=1),page_size:int=Query(25,ge=1,le=100),admin=Depends(require_admin)):
    rows=await run_in_threadpool(service.directory)
    activity=await read_records('pest_disease_records',limit=1000)
    counts=Counter(str(row.get('farmer_id')) for row in activity['items'])
    for row in rows:
        row['scan_count']=counts[row['farmer_id']] if activity['available'] else None
    if q:
        query=q.casefold().strip()
        rows=[row for row in rows if query in ' '.join(str(row.get(key) or '') for key in ('name','mobile','farmer_id','prn')).casefold()]
    if village:
        rows=[row for row in rows if village.casefold() in row['village'].casefold()]
    if satellite in ('available','missing'):
        rows=[row for row in rows if any(f['context']['satellite']['available'] for f in row['farms']) == (satellite=='available')]
    descending=sort.startswith('-')
    key=sort.lstrip('-')
    if key not in ('name','area_acres','village'):
        raise HTTPException(422,'Unsupported sort field')
    rows.sort(key=lambda row:row[key].casefold() if isinstance(row[key],str) else row[key],reverse=descending)
    return {'items':rows[(page-1)*page_size:page*page_size],'total':len(rows),'page':page,'page_size':page_size}


@router.get('/farmers/{farmer_id}')
async def farmer_detail(farmer_id:UUID,admin=Depends(require_admin)):
    result=await service.farmer_detail(farmer_id)
    if not result:
        raise HTTPException(404,'Farmer not found')
    record_event('admin_view','Farmer detail accessed through authorized admin API',200)
    return result


def require_farm(farm_id):
    farm=farmers.get_farm_by_id(farm_id)
    if not farm:
        raise HTTPException(404,'Farm not found')
    return farm


@router.get('/farms/{farm_id}/gis')
def farm_gis(farm_id:UUID,admin=Depends(require_admin)):
    require_farm(farm_id)
    return service.admin_plot(gis.get_farm_plot_gis(farm_id))


@router.get('/farms/{farm_id}/raster/{index}.png')
def raster(farm_id:UUID,index:str,admin=Depends(require_admin)):
    require_farm(farm_id)
    data=gis.get_raster_png_bytes(farm_id,index)
    if data is None:
        raise HTTPException(404,'Raster not available')
    return Response(data,media_type='image/png',headers={'Cache-Control':'private, max-age=300','Vary':'Authorization'})


@router.get('/farms/{farm_id}/weather')
async def weather(farm_id:UUID,admin=Depends(require_admin)):
    require_farm(farm_id)
    return await get_farm_weather_overview(farm_id)


@router.get('/farms/{farm_id}/advisory')
def advisory(farm_id:UUID,admin=Depends(require_admin)):
    require_farm(farm_id)
    return get_farm_advisory(farm_id)


@router.get('/scans')
async def scans(farmer_id:UUID|None=None,farm_id:UUID|None=None,prediction:str='',status:str='',date_from:date|None=None,date_to:date|None=None,admin=Depends(require_admin)):
    result=await read_records('pest_disease_records',farmer_id=farmer_id,farm_id=farm_id,limit=1000)
    result['items']=[row for row in result['items'] if
        (not prediction or prediction.casefold() in row['detected_disease'].casefold()) and
        (not status or row.get('status')==status) and
        (not date_from or str(row.get('created_at',''))[:10]>=str(date_from)) and
        (not date_to or str(row.get('created_at',''))[:10]<=str(date_to))]
    return result


@router.post('/farms/{farm_id}/product-composition')
def product_composition(farm_id:UUID,payload:CompositionRequest,admin=Depends(require_admin)):
    from app.modules.advisory.fertigation import product_nutrients
    farm=require_farm(farm_id)
    try:
        return product_nutrients(payload.product,payload.quantity,payload.unit,float(farm['area_acre']))
    except ValueError as error:
        raise HTTPException(422,str(error))


@router.get('/scans/{record_id}/image')
async def scan_image(record_id:UUID,admin=Depends(require_admin)):
    from app.modules.pest_disease.history import image_bytes
    data=await image_bytes(record_id,admin_authorized=True)
    if data is None:
        raise HTTPException(404,'Recorded image is unavailable')
    return Response(data,media_type='image/jpeg',headers={'Cache-Control':'private, no-store'})


@router.get('/operations')
def operations(admin=Depends(require_admin)):
    return service.operations()


@router.get('/reports/farmers.csv')
def report(admin=Depends(require_admin)):
    stream=io.StringIO(newline='')
    writer=csv.writer(stream)
    writer.writerow(['Farmer ID','Name','Mobile','Village','Area (acres)','Farm count','Satellite observations available','Farm IDs','Crops','Latest observation','Advisory soil inputs ready'])
    def cell(value):
        value=str(value)
        return "'"+value if value.lstrip().startswith(('=','+','-','@')) or value.startswith(('\t','\r')) else value
    for row in service.directory():
        writer.writerow([cell(value) for value in (row['farmer_id'],row['name'],row['mobile'],row['village'],row['area_acres'],len(row['farms']),any(f['context']['satellite']['available'] for f in row['farms']),'; '.join(f['farm_id'] for f in row['farms']),'; '.join(f.get('crop_name') or 'Not recorded' for f in row['farms']),max((f['context']['satellite']['observed_on'] or '' for f in row['farms']),default=''),all(f.get('advisory_inputs_ready',False) for f in row['farms']) if row['farms'] else False)])
    record_event('admin_export','Authorized farmer directory CSV export',200)
    return Response(stream.getvalue(),media_type='text/csv',headers={'Content-Disposition':'attachment; filename="verified-farmers.csv"','Cache-Control':'no-store'})
