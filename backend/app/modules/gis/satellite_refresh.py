
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
                'last_checked_at': datetime.now(timezone.utc).isoformat(),
            }

    return None


STATS_EVALSCRIPT = """//VERSION=3
function setup() {
  return {
    input: [{bands: ['B02','B04','B05','B08','B11','SCL','dataMask']}],
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
    NDWI:[ndmi],
    dataMask:[
      valid && [ndvi,evi,ndre,msavi,ndmi].every(Number.isFinite)
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


def _raster_dimensions(bbox):
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
        min(512, math.ceil(width_m / 10))
    )

    height = max(
        1,
        min(512, math.ceil(height_m / 10))
    )

    return width, height


def _raster_evalscript(index_name):
    """Color genuine Sentinel-2 pixels using the existing V2 palettes."""

    key = index_name.lower()

    if key not in KEYS:
        raise ValueError(
            f'Unsupported index: {index_name}'
        )

    if key in ('ndmi', 'ndwi'):
        palette = WATER_PALETTE
    else:
        palette = VEG_PALETTE

    rgb_palette = [
        [
            int(color[1:3], 16),
            int(color[3:5], 16),
            int(color[5:7], 16),
        ]
        for color in palette
    ]

    palette_js = json.dumps(rgb_palette)

    return f"""//VERSION=3
const colors = {palette_js};

function setup() {{
  return {{
    input: [{{
      bands: [
        'B02','B04','B05','B08','B11','SCL','dataMask'
      ]
    }}],
    output: {{
      id: 'default',
      bands: 4,
      sampleType: 'UINT8'
    }}
  }};
}}

function evaluatePixel(s) {{
  if (
    s.dataMask !== 1 ||
    [0,1,3,8,9,10,11].includes(s.SCL)
  ) {{
    return [0,0,0,0];
  }}

  const div = (a,b) =>
    a+b !== 0 ? (a-b)/(a+b) : NaN;

  const ndvi = div(s.B08,s.B04);
  const ndre = div(s.B08,s.B05);
  const ndmi = div(s.B08,s.B11);

  const evi =
    2.5*(s.B08-s.B04)/
    (s.B08+6*s.B04-7.5*s.B02+1);

  const root =
    Math.pow(2*s.B08+1,2) -
    8*(s.B08-s.B04);

  const msavi =
    root >= 0
    ? (2*s.B08+1-Math.sqrt(root))/2
    : NaN;

  const values = {{
    ndvi: ndvi,
    evi: evi,
    ndre: ndre,
    msavi: msavi,
    ndmi: ndmi,
    ndwi: ndmi
  }};

  const value = values['{key}'];

  if (
    !Number.isFinite(value) ||
    value < -1 ||
    value > 1
  ) {{
    return [0,0,0,0];
  }}

  const cls = Math.min(
    19,
    Math.max(
      0,
      Math.floor(
        Math.round((value+1)*10*1e8)/1e8
      )
    )
  );

  const rgb = colors[cls];

  return [
    rgb[0],
    rgb[1],
    rgb[2],
    220
  ];
}}
"""


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

    if day > datetime.now(timezone.utc).date():
        raise ValueError(
            'Cannot request a future satellite observation.'
        )

    geometry = farm.get('boundary_geojson')

    bbox, leaflet_bounds = _raster_bounds(geometry)

    width, height = _raster_dimensions(bbox)

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
                'dataFilter': {
                    'timeRange': {
                        'from': (
                            f'{day.isoformat()}T00:00:00Z'
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

    # Reject an entirely transparent image.
    # This avoids advertising an empty scene as valid raster data.
    from PIL import Image

    with Image.open(io.BytesIO(content)) as image:
        alpha = image.convert('RGBA').getchannel('A')

        if alpha.getextrema()[1] == 0:
            raise RuntimeError(
                'No valid cloud-free satellite pixels '
                'on the selected date.'
            )

    return {
        'png_bytes': content,
        'index': index_name.lower(),
        'acquisition_date': day.isoformat(),
        'bounds': leaflet_bounds,
        'width': width,
        'height': height,
        'source': 'copernicus_process',
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
        return json.loads(
            metadata_file.read_text(
                encoding='utf-8'
            )
        )

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
