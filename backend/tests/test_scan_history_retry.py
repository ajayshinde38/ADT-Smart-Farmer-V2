"""Exercise private-save retries with an isolated HTTP provider; no database writes."""
import io
import json
from uuid import uuid4

import httpx
import pytest
from PIL import Image

from app.modules.pest_disease import history
from app.modules.pest_disease.schemas import DiseaseDetectionResponse


@pytest.mark.asyncio
async def test_retry_after_database_failure_reuses_image_and_one_record(monkeypatch):
    monkeypatch.setattr(history.settings, 'SUPABASE_URL', 'https://storage.invalid')
    monkeypatch.setattr(history, 'headers', lambda: {'apikey': 'isolated-test'})
    farm = {'farm_id': str(uuid4()), 'farmer_id': str(uuid4())}
    stream = io.BytesIO()
    Image.new('RGB', (16, 16), 'green').save(stream, 'JPEG')
    photo = stream.getvalue()
    identifier = history.scan_identifier(farm['farm_id'], 'same-attempt', photo)
    result = DiseaseDetectionResponse(detected_disease='Not detected', marathi_name='',
        confidence_score=0.4, affected_percentage=0, severity_level='Unknown', status='uncertain')
    rows, uploaded_paths, evidence = {}, [], {}
    database_attempts = 0

    def provider(request):
        nonlocal database_attempts
        if request.method=='POST' and '/storage/v1/object/' in request.url.path:
            assert request.headers['x-upsert'] == 'true'
            uploaded_paths.append(request.url.path)
            if request.url.path.endswith('.analysis.json'):
                evidence.update(json.loads(request.content))
            return httpx.Response(200, json={})
        if request.method == 'POST':
            database_attempts += 1
            assert request.url.params['on_conflict'] == 'id'
            assert 'ignore-duplicates' in request.headers['Prefer']
            if database_attempts == 1:
                return httpx.Response(503, json={})
            row = json.loads(request.content)
            rows.setdefault(row['id'], row)
            return httpx.Response(201, json=[row])
        if '/storage/v1/object/authenticated/' in request.url.path:
            return httpx.Response(200,json=evidence)
        assert request.url.params['farm_id'] == 'eq.' + farm['farm_id']
        row = rows.get(str(identifier))
        return httpx.Response(200, json=[row] if row else [])

    real_client = httpx.AsyncClient
    monkeypatch.setattr(history.httpx, 'AsyncClient', lambda **kwargs:
        real_client(transport=httpx.MockTransport(provider), **kwargs))
    assert await history.save_scan(farm, photo, result, identifier) is None
    assert await history.save_scan(farm, photo, result, identifier) == identifier
    assert await history.save_scan(farm, photo, result, identifier) == identifier
    assert len(rows) == 1
    assert len(set(uploaded_paths)) == 2  # Original JPEG and private analysis JSON.
    assert (await history.saved_scan(identifier, farm['farm_id']))['farmer_id'] == farm['farmer_id']
    loaded=await history.load_analysis(rows[str(identifier)])
    assert loaded['status']==result.status
    assert evidence['farm_id']==farm['farm_id']
