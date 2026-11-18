
"""Real cloud-masked Sentinel-2 field averages and optional spatial raster images.

The normal refresh_observation() keeps its existing behaviour. Raster generation
is an explicit separate action: no fake detail is generated from farm averages.
"""
import io
import json
import math
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from uuid import UUID

import httpx
from .sentinel import get_cdse_token

CACHE_DIR = Path(__file__).resolve().parents[3] / '.cache' / 'satellite'
KEYS = ('ndvi', 'evi', 'ndre', 'msavi', 'ndmi', 'ndwi')
PROCESS_URL = 'https://sh.dataspace.copernicus.eu/process/v1'
ALGORITHM_VERSION = '2026-11-03-pixel-centres-v3'
RASTER_SCHEMA_VERSION = 2
# A cloud-free composite can include older pixels. We disclose this date window.
COMPOSITE_LOOKBACK_DAYS = 30

# These palettes match frontend/src/utils/gisColorScale.ts.
VEG_PALETTE = (
    '#660000', '#8B0000', '#B22222', '#CD5C5C', '#FF0000',
    '#FF4500', '#FF8C00', '#FFA500', '#FFD700', '#FFFF00',
    '#E8F48C', '#D4E157', '#AED581', '#81C784', '#4CAF50',
    '#43A047', '#388E3C', '#2E7D32', '#1B5E20', '#00FF00',
)

WATER_PALETTE = (
    '#8B0000', '#B22222', '#FF0000', '#FF4500', '#FF8C00',
    '#FFA500', '#FFD700', '#FFFF00', '#FAFAD2', '#E0F7FA',
    '#B2EBF2', '#80DEEA', '#4DD0E1', '#00BCD4', '#0097A7',
    '#1E90FF', '#4169E1', '#0000FF', '#0000CD', '#00008B',
)


def cached_observation(farm_id):
    try:
        path = CACHE_DIR / f'{UUID(str(farm_id))}.json'
        data = json.loads(path.read_text(encoding='utf-8'))

        if (
            data.get('source') != 'copernicus_statistics'
            or data.get('algorithm_version') != ALGORITHM_VERSION
            or not data.get('capture_date')
        ):
            return None

        if date.fromisoformat(data['capture_date']) > datetime.now(timezone.utc).date():
            return None

        return data

    except (OSError, ValueError, TypeError):
        return None


def select_observation(payload):
    rows = sorted(
        payload.get('data', []),
        key=lambda x: x.get('interval', {}).get('from', ''),
        reverse=True,
    )

    for row in rows:
        captured = row.get('interval', {}).get('from', '')[:10]

        try:
            if date.fromisoformat(captured) > datetime.now(timezone.utc).date():
                continue
        except ValueError:
            continue

        values = {}

        for key in KEYS:
            stats = (
                row.get('outputs', {})
                .get(key.upper(), {})
                .get('bands', {})
                .get('B0', {})
                .get('stats', {})
            )

            value = stats.get('mean')
            valid = (
                stats.get('sampleCount', 0)
                - stats.get('noDataCount', 0)
            )

            if (
                valid >= 10
                and isinstance(value, (float, int))
                and math.isfinite(value)
                and -1 <= value <= 1
            ):
                values[key] = round(value, 4)

        if values.get('ndvi') is not None:
            return {
                **{key: values.get(key) for key in KEYS},
                'capture_date': captured,
                'cloud_coverage_pct': None,
                'source': 'copernicus_statistics',
                'algorithm_version': ALGORITHM_VERSION,
                'last_checked_at': datetime.now(timezone.utc).isoformat(),
            }

    return None


STATS_EVALSCRIPT = """//VERSION=3
function setup() {
  return {
    input: [{bands: ['B02','B03','B04','B05','B08','B11','SCL','dataMask']}],
    output: ['NDVI','EVI','NDRE','MSAVI','NDMI','NDWI']
      .map(id => ({id:id,bands:1,sampleType:'FLOAT32'}))
      .concat([{id:'dataMask',bands:1}])
  };
}
function evaluatePixel(s) {
  const valid = s.dataMask === 1 && ![0,1,3,8,9,10,11].includes(s.SCL);

  const ratio = (a,b) => a+b !== 0 ? (a-b)/(a+b) : NaN;

  const ndvi = ratio(s.B08,s.B04);
  const ndre = ratio(s.B08,s.B05);
  const ndmi = ratio(s.B08,s.B11);
  // McFeeters open-water NDWI: green versus near infrared.
  const ndwi = ratio(s.B03,s.B08);

  const evi = 2.5*(s.B08-s.B04)/
    (s.B08+6*s.B04-7.5*s.B02+1);

  const root = Math.pow(2*s.B08+1,2)-8*(s.B08-s.B04);
  const msavi = root>=0
    ? (2*s.B08+1-Math.sqrt(root))/2
    : NaN;

  return {
    NDVI:[ndvi],
    EVI:[evi],
    NDRE:[ndre],
    MSAVI:[msavi],
    NDMI:[ndmi],
    NDWI:[ndwi],
    dataMask:[
      valid && [ndvi,evi,ndre,msavi,ndmi,ndwi].every(Number.isFinite)
        ? 1
        : 0
    ]
  };
}
"""


async def refresh_observation(farm):
    """Update genuine cloud-masked field averages only."""

    farm_id = str(UUID(str(farm['farm_id'])))
    previous = cached_observation(farm_id)

    if previous:
        try:
            checked = datetime.fromisoformat(
                previous['last_checked_at']
            )

            if checked.tzinfo is None:
                checked = checked.replace(tzinfo=timezone.utc)

            age = (
                datetime.now(timezone.utc) - checked
            ).total_seconds()

            if age < 900:
                return previous

        except (ValueError, KeyError, TypeError):
            pass

    token = await get_cdse_token()

    if not token:
        raise RuntimeError(
            'Satellite connection unavailable. '
            'Existing observations are preserved.'
        )

    geometry = farm.get('boundary_geojson')

    if not geometry:
        raise ValueError('The farm boundary is unavailable.')

    now = datetime.now(timezone.utc)

    payload = {
        'input': {
            'bounds': {
                'geometry': geometry,
                'properties': {
                    'crs': 'http://www.opengis.net/def/crs/EPSG/0/4326'
                },
            },
            'data': [{
                'type': 'sentinel-2-l2a',
                'processing': {'upsampling': 'NEAREST', 'downsampling': 'NEAREST'},
                'dataFilter': {
                    'mosaickingOrder': 'leastCC'
                },
            }],
        },
        'aggregation': {
            'timeRange': {
                'from': (
                    now - timedelta(days=90)
                ).strftime('%Y-%m-%dT00:00:00Z'),
                'to': now.strftime('%Y-%m-%dT%H:%M:%SZ'),
            },
            'aggregationInterval': {
                'of': 'P1D'
            },
            'evalscript': STATS_EVALSCRIPT,
            'resx': 0.0001,
            'resy': 0.0001,
        },
    }

    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(
            'https://sh.dataspace.copernicus.eu/statistics/v1',
            headers={
                'Authorization': f'Bearer {token}'
            },
            json=payload,
        )

    if response.status_code != 200:
        raise RuntimeError(
            f'Satellite provider unavailable '
            f'(HTTP {response.status_code}). '
            'Existing observations are preserved.'
        )

    observation = select_observation(response.json())

    if observation:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)

        target = CACHE_DIR / f'{farm_id}.json'
        temporary = target.with_suffix('.tmp')

        temporary.write_text(
            json.dumps(observation),
            encoding='utf-8'
        )

        temporary.replace(target)

    return observation


# ==============================================================
# GENUINE SPATIAL RASTER SUPPORT
# ==============================================================

def _raster_bounds(geometry):
    """Extract accurate bounding coordinates from a GeoJSON Polygon."""

    if (
        not isinstance(geometry, dict)
        or geometry.get('type') != 'Polygon'
    ):
        raise ValueError(
            'A GeoJSON Polygon is required to generate a raster.'
        )

    rings = geometry.get('coordinates') or []

    if not rings or len(rings[0]) < 4:
        raise ValueError(
            'The farm polygon must have at least four coordinates.'
        )

    points = rings[0]

    for pt in points:
        if (
            not isinstance(pt, (list, tuple))
            or len(pt) < 2
        ):
            raise ValueError('Invalid farm polygon coordinates.')

    lon = [float(pt[0]) for pt in points]
    lat = [float(pt[1]) for pt in points]

    if any(not math.isfinite(n) for n in lon + lat):
        raise ValueError('Non-finite farm coordinates.')

    west = min(lon)
    east = max(lon)
    south = min(lat)
    north = max(lat)

    if (
        west >= east
        or south >= north
        or not (-180 <= west < east <= 180)
        or not (-90 <= south < north <= 90)
    ):
        raise ValueError('Invalid farm bounding box.')

    bbox = [west, south, east, north]

    leaflet_bounds = [
        [south, west],
        [north, east],
    ]

    return bbox, leaflet_bounds


def _raster_dimensions(bbox, resolution=10):
    """Estimate approximately 10-metre output pixels."""

    west, south, east, north = bbox

    mid_lat = (south + north) / 2

    width_m = (
        (east - west)
        * 111320
        * math.cos(math.radians(mid_lat))
    )

    height_m = (north - south) * 111320

    width = max(
        1,
        min(512, math.ceil(width_m / resolution))
    )

    height = max(
        1,
        min(512, math.ceil(height_m / resolution))
    )

    return width, height


def _raster_evalscript(index_name):
    """Calculate six independent indices from authentic, cloud-masked scenes.

    ORBIT mosaicking makes multiple real acquisitions available per pixel.
    The first cloud-free sample is selected; no missing pixel is fabricated.
    The result is a *multi-date composite*, never a single-scene snapshot.
    """
    key = index_name.lower()
    if key not in KEYS:
        raise ValueError(f'Unsupported index: {index_name}')

    palette = WATER_PALETTE if key in ('ndmi', 'ndwi') else VEG_PALETTE
    rgb_palette = [[int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)] for h in palette]
    return f"""//VERSION=3
const colors = {json.dumps(rgb_palette)};
function setup() {{
  return {{
    input: [{{bands:['B02','B03','B04','B05','B08','B11','SCL','dataMask']}}],
    mosaicking: 'ORBIT',
    output: {{id:'default',bands:4,sampleType:'UINT8'}}
  }};
}}
function evaluatePixel(samples) {{
  const ratio = (a,b) => (a+b !== 0 ? (a-b)/(a+b) : NaN);
  // Choose a real, cloud-free Sentinel-2 sample at this pixel.
  for (let i=0; i<samples.length; i++) {{
    const s=samples[i];
    if(s.dataMask !== 1 || [0,1,3,8,9,10,11].includes(s.SCL)) continue;
    const ndvi=ratio(s.B08,s.B04);
    const ndre=ratio(s.B08,s.B05);
    const ndmi=ratio(s.B08,s.B11);
    const ndwi=ratio(s.B03,s.B08); // McFeeters: water, not NDMI.
    const evi=2.5*(s.B08-s.B04)/(s.B08+6*s.B04-7.5*s.B02+1);
    const root=Math.pow(2*s.B08+1,2)-8*(s.B08-s.B04);
    const msavi=root>=0 ? (2*s.B08+1-Math.sqrt(root))/2 : NaN;
    const values={{ndvi,evi,ndre,msavi,ndmi,ndwi}};
    const v=values['{key}'];
    if(!Number.isFinite(v) || v < -1 || v > 1) continue;
    const cls=Math.min(19,Math.max(0,Math.floor(Math.round((v+1)*10*1e8)/1e8)));
    const color=colors[cls];
    return [color[0],color[1],color[2],255];
  }}
  return [0,0,0,0]; // transparent means no valid satellite observation.
}}
"""


def _field_pixel_mask(geometry, bounds, size):
    """Test actual pixel centres in the geographic grid, respecting polygon holes."""
    import numpy as np
    from shapely.geometry import shape
    from shapely import intersects_xy
    width, height = size
    west, south, east, north = bounds
    polygon = shape(geometry)
    if not polygon.is_valid or polygon.is_empty:
        raise ValueError('Invalid farm geometry')
    xs = west + (np.arange(width) + .5) * (east-west) / width
    ys = north - (np.arange(height) + .5) * (north-south) / height
    return intersects_xy(polygon, xs[None, :], ys[:, None])


def _polygon_pixel_count(geometry, bounds, size):
    return int(_field_pixel_mask(geometry, bounds, size).sum())

async def fetch_genuine_raster(
    farm,
    index_name,
    capture_date
):
    """Fetch genuine cloud-masked pixels for one index and date.

    This function is optional and is NOT called by normal
    refresh_observation().

    It uses the external Copernicus Process API and may consume
    processing quota. It does not update Supabase records.
    """

    day = date.fromisoformat(
        str(capture_date)[:10]
    )
    start_date = day - timedelta(days=COMPOSITE_LOOKBACK_DAYS)

    if day > datetime.now(timezone.utc).date():
        raise ValueError(
            'Cannot request a future satellite observation.'
        )

    geometry = farm.get('boundary_geojson')

    bbox, leaflet_bounds = _raster_bounds(geometry)

    resolution = 20 if index_name.lower() in ('ndre', 'ndmi') else 10
    width, height = _raster_dimensions(bbox, resolution)

    evalscript = _raster_evalscript(index_name)

    token = await get_cdse_token()

    if not token:
        raise RuntimeError(
            'Copernicus authentication is not configured.'
        )

    payload = {
        'input': {
            'bounds': {
                'bbox': bbox,
                'geometry': geometry,
                'properties': {
                    'crs': (
                        'http://www.opengis.net/def/'
                        'crs/EPSG/0/4326'
                    )
                },
            },
            'data': [{
                'type': 'sentinel-2-l2a',
                'processing': {'upsampling': 'NEAREST', 'downsampling': 'NEAREST'},
                'dataFilter': {
                    'timeRange': {
                        'from': (
                            f'{start_date.isoformat()}T00:00:00Z'
                        ),
                        'to': (
                            f'{day.isoformat()}T23:59:59Z'
                        ),
                    },
                    'mosaickingOrder': 'leastCC',
                },
            }],
        },
        'output': {
            'width': width,
            'height': height,
            'responses': [{
                'identifier': 'default',
                'format': {
                    'type': 'image/png'
                },
            }],
        },
        'evalscript': evalscript,
    }

    async with httpx.AsyncClient(timeout=90) as client:
        response = await client.post(
            PROCESS_URL,
            headers={
                'Authorization': f'Bearer {token}',
                'Accept': 'image/png',
            },
            json=payload,
        )

    if response.status_code != 200:
        raise RuntimeError(
            'Copernicus raster request failed: '
            f'HTTP {response.status_code}'
        )

    content = response.content

    if not content.startswith(b'\x89PNG\r\n\x1a\n'):
        raise RuntimeError(
            'Copernicus did not return a PNG image.'
        )

    # Report authentic coverage inside the field boundary, not the bounding box.
    # Do not claim missing pixels are vegetation. No smoothing/interpolation.
    from PIL import Image
    import numpy as np
    with Image.open(io.BytesIO(content)) as image:
        rgba = np.array(image.convert('RGBA'))
        inside = _field_pixel_mask(geometry, bbox, image.size)
        rgba[~inside, 3] = 0
        valid_pixels = int(np.count_nonzero((rgba[:, :, 3] > 0) & inside))
        field_pixels = int(inside.sum())
        if valid_pixels == 0 or field_pixels == 0:
            raise RuntimeError('No cloud-free Sentinel-2 pixel centres inside this farm in the requested date window.')
        coverage_pct = round(valid_pixels * 100.0 / field_pixels, 1)
        output = io.BytesIO()
        Image.fromarray(rgba).save(output, format='PNG')
        content = output.getvalue()

    return {
        'png_bytes': content,
        'index': index_name.lower(),
        'acquisition_date': day.isoformat(),
        'bounds': leaflet_bounds,
        'width': width,
        'height': height,
        'source': 'copernicus_process',
        'algorithm_version': ALGORITHM_VERSION,
        'raster_schema_version': RASTER_SCHEMA_VERSION,
        'composite_start_date': start_date.isoformat(),
        'composite_end_date': day.isoformat(),
        'valid_pixel_coverage_pct': coverage_pct,
        'resolution_meters': 20.0 if index_name.lower() in ('ndre', 'ndmi') else 10.0,
    }


async def save_genuine_raster_locally(
    farm,
    index_name,
    capture_date
):
    """Optionally save a real satellite raster in the local backend cache.

    This does not publish it or expose it to the frontend.
    """

    farm_id = str(
        UUID(str(farm['farm_id']))
    )

    key = index_name.lower()

    if key not in KEYS:
        raise ValueError(
            'Unsupported vegetation index.'
        )

    day = date.fromisoformat(
        str(capture_date)[:10]
    ).isoformat()

    destination = (
        CACHE_DIR / farm_id / day
    )

    target = destination / f'{key}.png'
    metadata_file = destination / f'{key}.json'

    if target.exists() and metadata_file.exists():
        try:
            cached = json.loads(metadata_file.read_text(encoding='utf-8'))
            if (cached.get('raster_schema_version') == RASTER_SCHEMA_VERSION
                    and cached.get('algorithm_version') == ALGORITHM_VERSION
                    and cached.get('composite_end_date') == day
                    and cached.get('local_path') == str(target)):
                return cached
        except (OSError, ValueError, TypeError):
            pass
        # Old rasters were single-date and might contain the NDWI=NDMI bug.
        # Refresh explicitly rather than silently reusing incompatible pixels.

    result = await fetch_genuine_raster(
        farm,
        key,
        day
    )

    destination.mkdir(
        parents=True,
        exist_ok=True
    )

    temporary = target.with_suffix('.tmp')

    temporary.write_bytes(
        result['png_bytes']
    )

    temporary.replace(target)

    metadata = {
        k: v
        for k, v in result.items()
        if k != 'png_bytes'
    }

    metadata['local_path'] = str(target)

    metadata_file.write_text(
        json.dumps(metadata),
        encoding='utf-8'
    )

    return metadata
