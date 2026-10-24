"""Genuine cloud-masked field averages; never substitutes synthetic observations."""
import json
import math
from datetime import datetime, timedelta, timezone, date
from pathlib import Path
import httpx
from .sentinel import get_cdse_token

CACHE_DIR = Path(__file__).resolve().parents[3] / '.cache' / 'satellite'
KEYS = ('ndvi', 'evi', 'ndre', 'msavi', 'ndmi', 'ndwi')

def cached_observation(farm_id):
    try:
        data = json.loads((CACHE_DIR / f'{farm_id}.json').read_text(encoding='utf-8'))
        if data.get('source') != 'copernicus_statistics' or not data.get('capture_date'):
            return None
        if date.fromisoformat(data['capture_date']) > datetime.now(timezone.utc).date():
            return None
        return data
    except (OSError, ValueError, TypeError):
        return None


def select_observation(payload):
    for row in sorted(payload.get('data', []), key=lambda x: x.get('interval', {}).get('from', ''), reverse=True):
        captured = row.get('interval', {}).get('from', '')[:10]
        try:
            if date.fromisoformat(captured) > datetime.now(timezone.utc).date():
                continue
        except ValueError:
            continue
        values = {}
        for key in KEYS:
            stats = row.get('outputs', {}).get(key.upper(), {}).get('bands', {}).get('B0', {}).get('stats', {})
            value = stats.get('mean')
            valid = stats.get('sampleCount', 0) - stats.get('noDataCount', 0)
            if valid >= 10 and isinstance(value, (float, int)) and math.isfinite(value) and -1 <= value <= 1:
                values[key] = round(value, 4)
        if values.get('ndvi') is not None:
            return {**{key: values.get(key) for key in KEYS}, 'capture_date': captured,
                    'cloud_coverage_pct': None, 'source': 'copernicus_statistics',
                    'last_checked_at': datetime.now(timezone.utc).isoformat()}
    return None


async def refresh_observation(farm):
    previous = cached_observation(farm['farm_id'])
    if previous and (datetime.now(timezone.utc) - datetime.fromisoformat(previous['last_checked_at'])).total_seconds() < 900:
        return previous
    token = await get_cdse_token()
    if not token:
        raise RuntimeError('Satellite connection is unavailable. Existing observations are preserved.')
    geometry = farm.get('boundary_geojson')
    if not geometry:
        raise ValueError('The farm boundary is unavailable.')
    now = datetime.now(timezone.utc)
    evalscript = """//VERSION=3
function setup() { return { input: [{bands: ['B02','B04','B05','B08','B11','SCL','dataMask']}],
 output: ['NDVI','EVI','NDRE','MSAVI','NDMI','NDWI'].map(id => ({id:id,bands:1,sampleType:'FLOAT32'})).concat([{id:'dataMask',bands:1}]) }; }
function evaluatePixel(s) {
 const valid = s.dataMask === 1 && ![0,1,3,8,9,10,11].includes(s.SCL);
 const ratio = (a,b) => a+b !== 0 ? (a-b)/(a+b) : NaN;
 const ndvi=ratio(s.B08,s.B04), ndre=ratio(s.B08,s.B05), ndmi=ratio(s.B08,s.B11);
 const evi=2.5*(s.B08-s.B04)/(s.B08+6*s.B04-7.5*s.B02+1);
 const root=Math.pow(2*s.B08+1,2)-8*(s.B08-s.B04);
 const msavi=root>=0 ? (2*s.B08+1-Math.sqrt(root))/2 : NaN;
 return {NDVI:[ndvi],EVI:[evi],NDRE:[ndre],MSAVI:[msavi],NDMI:[ndmi],NDWI:[ndmi],
 dataMask:[valid && [ndvi,evi,ndre,msavi,ndmi].every(Number.isFinite) ? 1 : 0]}; }
"""
    payload = {'input': {'bounds': {'geometry': geometry, 'properties': {'crs': 'http://www.opengis.net/def/crs/EPSG/0/4326'}},
              'data': [{'type': 'sentinel-2-l2a', 'dataFilter': {'mosaickingOrder': 'leastCC'}}]},
              'aggregation': {'timeRange': {'from': (now-timedelta(days=90)).strftime('%Y-%m-%dT00:00:00Z'),
                              'to': now.strftime('%Y-%m-%dT%H:%M:%SZ')},
                              'aggregationInterval': {'of': 'P1D'}, 'evalscript': evalscript, 'resx': 0.0001, 'resy': 0.0001}}
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post('https://sh.dataspace.copernicus.eu/statistics/v1',
            headers={'Authorization': f'Bearer {token}'}, json=payload)
    if response.status_code != 200:
        raise RuntimeError(f'Satellite provider unavailable (HTTP {response.status_code}). Existing observations are preserved.')
    observation = select_observation(response.json())
    if observation:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        target = CACHE_DIR / f"{farm['farm_id']}.json"
        temporary = target.with_suffix('.tmp')
        temporary.write_text(json.dumps(observation), encoding='utf-8')
        temporary.replace(target)
    return observation
