"""Isolated HTTP tests: ephemeral signing key, no user/account/database changes."""
import io
import os
import secrets
from uuid import uuid4
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from PIL import Image
from app.core.config import settings
from app.core.security import create_access_token
from app.modules.pest_disease.router import router
from app.modules.pest_disease import service, unet_classifier

@pytest.fixture
def scan_client(monkeypatch):
    monkeypatch.setattr(settings, 'JWT_SECRET', secrets.token_urlsafe(48))
    isolated = FastAPI()
    isolated.include_router(router, prefix='/api/v1')
    with TestClient(isolated) as client:
        from app.core.security import decode_access_token
        owner=uuid4()
        farm_id=uuid4()
        monkeypatch.setattr('app.farmers.service.get_farm_by_id',lambda _: {'farm_id':str(farm_id),'farmer_id':str(owner)})
        monkeypatch.setattr('app.core.security.verify_farm_ownership',lambda farm,caller: caller==owner)
        async def no_saved(*args): return None
        async def saved(*args,**kwargs): return kwargs['identifier']
        monkeypatch.setattr('app.modules.pest_disease.history.saved_scan',no_saved)
        monkeypatch.setattr('app.modules.pest_disease.history.save_scan',saved)
        monkeypatch.setattr('app.modules.gis.service.get_farm_plot_gis',lambda _:None)
        monkeypatch.setattr('app.modules.weather.service.get_cached_farm_weather',lambda _:None)
        original_post=client.post
        def post(path,**kwargs):
            kwargs['data']={**(kwargs.get('data') or {}),'farm_id':str(farm_id),'request_id':'isolated-test'}
            return original_post(path,**kwargs)
        client.post=post
        yield client, {'Authorization': 'Bearer '+create_access_token(owner)}

def photo():
    stream=io.BytesIO()
    Image.new('RGB',(256,256),(60,110,45)).save(stream,format='JPEG')
    return stream.getvalue()

def test_scan_requires_valid_authorization(scan_client):
    client,_=scan_client
    for headers in ({},{'Authorization':'Bearer invalid'}):
        assert client.post('/api/v1/pest-disease/detect',headers=headers,files={'file':('leaf.jpg',photo(),'image/jpeg')}).status_code==401

@pytest.mark.parametrize('payload,expected',[(b'',400),(b'not an image',422),(b'x'*(8*1024*1024+1),413)], ids=['empty','invalid','oversize'])
def test_invalid_upload_rejected_before_inference(scan_client,monkeypatch,payload,expected):
    client,headers=scan_client
    def unexpected(_): raise AssertionError('Invalid input must not reach model')
    monkeypatch.setattr(service,'diagnose_leaf_image',unexpected)
    assert client.post('/api/v1/pest-disease/detect',headers=headers,files={'file':('leaf.jpg',payload,'image/jpeg')}).status_code==expected

def test_unavailable_model_is_retryable(scan_client,monkeypatch):
    client,headers=scan_client
    def unavailable(_): raise RuntimeError('test-only failure')
    monkeypatch.setattr(service,'diagnose_leaf_image',unavailable)
    response=client.post('/api/v1/pest-disease/detect',headers=headers,files={'file':('leaf.jpg',photo(),'image/jpeg')})
    assert response.status_code==503 and 'test-only failure' not in response.text

def test_failed_private_save_cannot_report_scan_success(scan_client,monkeypatch):
    from app.modules.pest_disease.schemas import DiseaseDetectionResponse
    client,headers=scan_client
    monkeypatch.setattr(service,'diagnose_leaf_image',lambda _:DiseaseDetectionResponse(
        detected_disease='Not detected',marathi_name='',confidence_score=0.4,
        affected_percentage=0,severity_level='Unknown',status='uncertain'))
    async def failed(*args,**kwargs): return None
    monkeypatch.setattr('app.modules.pest_disease.history.save_scan',failed)
    response=client.post('/api/v1/pest-disease/detect',headers=headers,
        files={'file':('leaf.jpg',photo(),'image/jpeg')},data={'save_history':'false'})
    assert response.status_code==503
    assert 'could not be saved' in response.json()['detail']

def test_private_history_outage_is_retryable_before_inference(scan_client,monkeypatch):
    client,headers=scan_client
    async def unavailable(*args): raise RuntimeError('private provider details')
    monkeypatch.setattr('app.modules.pest_disease.history.saved_scan',unavailable)
    def unexpected(_): raise AssertionError('Do not infer while history is unavailable')
    monkeypatch.setattr(service,'diagnose_leaf_image',unexpected)
    response=client.post('/api/v1/pest-disease/detect',headers=headers,
        files={'file':('leaf.jpg',photo(),'image/jpeg')})
    assert response.status_code==503
    assert 'private provider details' not in response.text

@pytest.mark.skipif(os.getenv('RUN_REAL_SCAN_TEST')!='1',reason='Explicit local model smoke test')
def test_real_http_upload_inference_response(scan_client):
    import torch
    torch.set_num_threads(1)
    client,headers=scan_client
    response=client.post('/api/v1/pest-disease/detect',headers=headers,files={'file':('leaf.jpg',photo(),'image/jpeg')},data={'save_history':'false'})
    assert response.status_code==200,response.text
    data=response.json()
    assert data['status'] in ('disease_detected','not_detected','uncertain')
    assert 0<=data['confidence_score']<=1
    assert 0<=data['affected_percentage']<=100
    assert data['record_saved'] is True and data['record_id'] is not None
    assert len(data['model_results'])==2
    assert data['fusion_policy']=='dual_model_agreement_v1'
    assert unet_classifier.load_unet_model() is unet_classifier._model
