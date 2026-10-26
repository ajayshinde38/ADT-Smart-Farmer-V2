import asyncio
import math
from datetime import datetime,timezone
from uuid import uuid4
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from app.main import app
from app.admin import security,service as admin_service
from app.core.security import create_access_token
from app.modules.advisory import service as advisory
from app.modules.advisory.fertigation import product_nutrients
from app.modules.advisory.stcr_engine import calculate_stcr_rdf,HA_TO_ACRE

OWNER='c54094b2-c218-441d-bc1a-870f0a01430b'
FARM='fa0094b2-c218-441d-bc1a-870f0a01430b'


@pytest.mark.parametrize('path',['/overview','/farmers','/farmers/'+OWNER,'/gis/farms','/farms/'+FARM+'/gis',
    '/farms/'+FARM+'/weather','/farms/'+FARM+'/advisory','/farms/'+FARM+'/raster/ndvi.png',
    '/scans','/scans/'+OWNER+'/image','/operations','/reports/farmers.csv','/me'])
def test_all_admin_apis_reject_farmer_or_absent_token(path):
    client=TestClient(app)
    assert client.get('/api/v1/admin'+path).status_code==401
    assert client.get('/api/v1/admin'+path,headers={'Authorization':'Bearer '+create_access_token(OWNER)}).status_code==403


def test_user_editable_admin_metadata_is_rejected():
    with pytest.raises(HTTPException) as error:
        security.authorize_user({'id':OWNER,'user_metadata':{'role':'admin'},'app_metadata':{}})
    assert error.value.status_code==403
    assert security.authorize_user({'id':OWNER,'app_metadata':{'roles':['admin']}})['role']=='admin'


def test_admin_authority_is_verified_on_every_request(monkeypatch):
    calls=[]
    async def provider(method,path,**kwargs):
        calls.append((method,path,kwargs['token']))
        return {'id':OWNER,'email':'contract-test@example.invalid','app_metadata':{'role':'admin'}}
    monkeypatch.setattr(security,'provider_request',provider)
    client=TestClient(app)
    headers={'Authorization':'Bearer independent-provider-token'}
    assert client.get('/api/v1/admin/me',headers=headers).status_code==200
    assert client.get('/api/v1/admin/me',headers=headers).status_code==200
    assert len(calls)==2 and all(row[:2]==('GET','user') for row in calls)
    async def expired(*args,**kwargs):
        raise HTTPException(401,'Expired')
    monkeypatch.setattr(security,'provider_request',expired)
    assert client.get('/api/v1/admin/me',headers=headers).status_code==401


def test_authorized_directory_keeps_household_members_separate_and_escapes_csv(monkeypatch):
    async def provider(*args,**kwargs):return {'id':OWNER,'app_metadata':{'role':'admin'}}
    monkeypatch.setattr(security,'provider_request',provider)
    rows=[{'farmer_id':str(uuid4()),'name':name,'mobile':'9999999999','village':'Village','area_acres':area,'farms':[],'prn':'1'} for name,area in [('First',1),('Second',2),(' =formula',3)]]
    monkeypatch.setattr(admin_service,'directory',lambda:rows.copy())
    async def empty_history(*args,**kwargs):return {'available':True,'items':[]}
    monkeypatch.setattr('app.admin.router.read_records',empty_history)
    client=TestClient(app);headers={'Authorization':'Bearer provider-verified-token'}
    data=client.get('/api/v1/admin/farmers?q=9999999999&sort=-area_acres&page_size=2',headers=headers).json()
    assert data['total']==3 and len(data['items'])==2
    assert data['items'][0]['area_acres']==3
    assert data['items'][0]['farmer_id']!=data['items'][1]['farmer_id']
    csv=client.get('/api/v1/admin/reports/farmers.csv',headers=headers)
    assert csv.status_code==200 and "' =formula" in csv.text
    assert 'no-store' in csv.headers['cache-control']


def test_admin_login_checks_role_after_provider_authentication(monkeypatch):
    security._attempts.clear()
    async def provider(method,path,**kwargs):
        return {'access_token':'provider-token','expires_in':300} if path.startswith('token?') else {'id':OWNER,'app_metadata':{'role':'farmer'}}
    monkeypatch.setattr(security,'provider_request',provider)
    response=TestClient(app).post('/api/v1/admin/auth/login',json={'email':'test@example.invalid','password':'dummy-contract-test'})
    assert response.status_code==403 and 'access_token' not in response.json()


def test_missing_soil_never_produces_a_fertilizer_prescription(monkeypatch):
    farm={'farm_id':FARM,'farmer_id':OWNER,'name':'Contract fixture','area_acre':1.9,'soil':{}}
    monkeypatch.setattr(advisory.farmer_service,'get_farm_by_id',lambda _:farm)
    monkeypatch.setattr('app.modules.weather.service.get_cached_farm_weather',lambda _:None)
    data=advisory.get_farm_advisory(FARM)
    assert data.rdf is None and data.soil_status.nitrogen_kg_ha is None
    assert data.planning['nutrient_totals_kg'] is None
    assert data.planning['calendar_schedule_available'] is False
    assert data.weekly_schedules==[]


def test_reference_arithmetic_scales_area_and_keeps_applied_inputs_unknown(monkeypatch):
    farm={'farm_id':FARM,'farmer_id':OWNER,'name':'Contract fixture','area_acre':1.9,
          'soil':{'oc':0.5,'nitrogen_kg_ha':180,'phosphorus_kg_ha':22,'potassium_kg_ha':290}}
    monkeypatch.setattr(advisory.farmer_service,'get_farm_by_id',lambda _:farm)
    monkeypatch.setattr('app.modules.weather.service.get_cached_farm_weather',lambda _:None)
    data=advisory.get_farm_advisory(FARM)
    assert data.rdf.basal_dose is None
    assert data.rdf.final_fertigation_n_kg_acre is None
    assert data.planning['nutrient_totals_kg']['N']==round(data.rdf.rdf_n_kg_acre*1.9,2)
    assert data.planning['target_source']=='reference_assumption'
    raw=calculate_stcr_rdf(.5,180,22,290)
    assert raw['organic_manure_ton_acre']==round(raw['organic_manure_ton_ha']/HA_TO_ACRE,2)
    assert data.rdf.expected_yield_ton_ha==250


def test_product_mass_and_nutrients_are_distinct_and_liquid_density_is_not_invented():
    large=product_nutrients('Urea',100,'kg',2)
    grams=product_nutrients('Urea',100000,'g',2)
    assert large['nutrients_kg']==grams['nutrients_kg']=={'N':46,'P2O5':0,'K2O':0}
    assert large['nutrients_kg_per_acre']['N']==23
    assert product_nutrients('10:26:26',50,'kg',1)['nutrients_kg']=={'N':5,'P2O5':13,'K2O':13}
    for args in [('Urea',1,'ml',1),('Urea',float('nan'),'kg',1),('Urea',1,'kg',0),('Unverified product',1,'kg',1)]:
        with pytest.raises(ValueError):product_nutrients(*args)


def test_family_selection_requires_a_verified_household_token():
    assert TestClient(app).post('/api/v1/auth/select-profile',json={'phone':'9999999999','farmer_id':OWNER}).status_code==403


def test_static_files_cannot_escape_the_export_directory():
    response=TestClient(app).get('/%2e%2e/%2e%2e/backend/.env')
    assert response.status_code==404


def test_private_scan_image_checks_ownership_before_signing(monkeypatch):
    from app.modules.pest_disease import history
    from app.farmers import service as farmers
    class Client:
        async def __aenter__(self):return self
        async def __aexit__(self,*args):pass
        async def get(self,*args,**kwargs):
            return history.httpx.Response(200,json=[{'farm_id':FARM,'image_storage_path':FARM+'/private.jpg'}])
    monkeypatch.setattr(history.httpx,'AsyncClient',lambda **kwargs:Client())
    monkeypatch.setattr(history,'headers',lambda:{'Authorization':'unit-test-only'})
    monkeypatch.setattr(farmers,'get_farm_by_id',lambda _: {'farmer_id':OWNER,'mobile':'1111111111'})
    monkeypatch.setattr(farmers,'get_farmer_by_id',lambda _: {'mobile':'2222222222'})
    signed=[]
    async def sign(*args,**kwargs):signed.append(True);return None
    monkeypatch.setattr(history.supabase_storage,'get_signed_url',sign)
    with pytest.raises(HTTPException) as error:
        asyncio.run(history.image_bytes(uuid4(),caller_id=uuid4()))
    assert error.value.status_code==403 and signed==[]


def test_admin_product_composition_uses_shared_mass_logic_and_requires_role(monkeypatch):
    from app.admin import router
    client=TestClient(app)
    url='/api/v1/admin/farms/'+FARM+'/product-composition'
    payload={'product':'Urea','quantity':1000,'unit':'g'}
    assert client.post(url,json=payload).status_code==401
    assert client.post(url,json=payload,headers={'Authorization':'Bearer '+create_access_token(OWNER)}).status_code==403
    async def provider(*args,**kwargs):return {'id':OWNER,'app_metadata':{'role':'admin'}}
    monkeypatch.setattr(security,'provider_request',provider)
    monkeypatch.setattr(router,'require_farm',lambda _: {'area_acre':2})
    result=client.post(url,json=payload,headers={'Authorization':'Bearer provider-verified-token'})
    assert result.status_code==200
    assert result.json()['nutrients_kg']['N']==0.46
    assert result.json()['nutrients_kg_per_acre']['N']==0.23


def test_history_never_exposes_private_storage_paths(monkeypatch):
    from app.core import records
    class Client:
        async def __aenter__(self):return self
        async def __aexit__(self,*args):pass
        async def get(self,*args,**kwargs):
            assert kwargs['params']['farm_id']=='eq.'+FARM
            return records.httpx.Response(200,json=[{'id':str(uuid4()),'image_storage_path':'private/image.jpg','overlay_storage_path':'private/overlay.png'}])
    monkeypatch.setattr(records.httpx,'AsyncClient',lambda **kwargs:Client())
    data=asyncio.run(records.read_records('pest_disease_records',farm_id=FARM))
    assert data['available'] and data['items'][0]['has_image']
    assert 'image_storage_path' not in data['items'][0] and 'overlay_storage_path' not in data['items'][0]
