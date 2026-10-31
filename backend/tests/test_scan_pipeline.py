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
        yield client, {'Authorization': 'Bearer '+create_access_token(uuid4())}

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
    assert data['record_saved'] is False and data['record_id'] is None
    assert unet_classifier.load_unet_model() is unet_classifier._model
