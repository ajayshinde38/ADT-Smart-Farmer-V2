"""Farm context shared by satellite, weather and crop-care views.

Adapted from the reference project's multi-input checks: missing crop age,
measured SAR, a calibrated chlorophyll model or weather history is not invented.
"""
import math
from datetime import date, datetime
from zoneinfo import ZoneInfo


def local_today():
    return datetime.now(ZoneInfo('Asia/Kolkata')).date()


def as_date(value):
    try:
        return date.fromisoformat(str(value)[:10])
    except (TypeError, ValueError):
        return None


def number(value):
    return float(value) if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) else None


def resolve_crop_context(farm, today=None):
    today = today or local_today()
    planted = as_date(farm.get('plantation_date'))
    if planted and planted > today:
        planted = None
    age = (today - planted).days if planted else None
    aliases = {'germination & establishment': 'Sprouting', 'germination': 'Sprouting',
               'sprouting': 'Sprouting', 'tillering & formative': 'Tillering', 'tillering': 'Tillering',
               'grand growth': 'Grand Growth', 'development': 'Grand Growth', 'vegetative': 'Vegetative',
               'maturation & ripening': 'Maturity', 'maturity': 'Maturity', 'harvest ready': 'Harvest Ready'}
    stage = aliases.get(str(farm.get('growth_stage') or '').strip().lower())
    source = 'recorded' if stage else 'unknown'
    if stage is None and age is not None:
        stage = 'Sprouting' if age <= 45 else 'Tillering' if age <= 120 else 'Grand Growth' if age <= 270 else 'Maturity' if age <= 360 else 'Harvest Ready'
        source = 'planting_date_estimate'
    return {'stage': stage, 'stage_source': source, 'plantation_date': str(planted) if planted else None, 'age_days': age}


def observation_history(farm, gis=None):
    raw = list(farm.get('gis_observations') or [])
    if gis and gis.get('indices'):
        current = gis['indices']
        raw.append({'capture_date': current.get('capture_date'), **{f'{key}_mean': current.get(key) for key in ('ndvi','ndre','ndmi')}})
    records = {}
    for row in raw:
        captured = as_date(row.get('capture_date'))
        if not captured or captured > local_today():
            continue
        values = {key: number(row.get(f'{key}_mean')) for key in ('ndvi', 'ndre', 'ndmi')}
        values = {key: value if value is not None and -1 <= value <= 1 else None for key, value in values.items()}
        if any(value is not None for value in values.values()):
            records[str(captured)] = {'date': str(captured), **values}
    return sorted(records.values(), key=lambda row: row['date'])


def build_field_context(farm, gis=None, weather=None):
    gis = gis.model_dump(mode='json') if hasattr(gis, 'model_dump') else gis
    weather = weather.model_dump(mode='json') if hasattr(weather, 'model_dump') else weather
    farm_id = str(farm['farm_id'])
    for source in (gis, weather):
        if source and source.get('farm_id') is not None and str(source['farm_id']) != farm_id:
            raise ValueError('Cannot combine data from different farms')
    crop = resolve_crop_context(farm)
    observed = as_date(((gis or {}).get('indices') or {}).get('capture_date'))
    satellite_age = (local_today() - observed).days if observed and observed <= local_today() else None
    updated = (weather or {}).get('last_updated_utc')
    weather_age = None
    try:
        timestamp = datetime.fromisoformat(updated.replace('Z', '+00:00'))
        if timestamp.tzinfo is not None:
            weather_age = (datetime.now(timestamp.tzinfo) - timestamp).total_seconds()
    except (AttributeError, TypeError, ValueError):
        pass
    weather_fresh = weather_age is not None and 0 <= weather_age <= 900 and (weather or {}).get('cache_expires_in_seconds') != 0
    satellite_values = (gis or {}).get('indices') or {}
    satellite_available = satellite_age is not None and any(number(satellite_values.get(key)) is not None for key in ('ndvi','ndre','ndmi','evi','msavi','ndwi'))
    history = observation_history(farm, gis)
    soil_available = bool(farm.get('soil') or farm.get('soil_test_records'))
    cues = []
    def cue(code, target, en, mr, sources):
        cues.append({'code': code, 'target': target, 'text_en': en, 'text_mr': mr, 'sources': sources})
    if not weather_fresh:
        cue('weather_unavailable', 'weather', 'Check the latest weather before planning field work.', 'शेतकामाचे नियोजन करण्यापूर्वी नवीन हवामान तपासा.', ['weather'])
    elif number(weather.get('current_vpd_kpa')) is not None and weather['current_vpd_kpa'] > 2.2:
        cue('drying_demand', 'weather', 'Drying demand is high. Check soil moisture before watering.', 'हवेतील कोरडेपणा जास्त आहे. पाणी देण्यापूर्वी मातीतील ओलावा तपासा.', ['weather'])
    checks = weather.get('crop_watch', []) if weather_fresh else []
    watch_count = sum(item.get('criteria_tested', 0) >= 2 and (number(item.get('score')) or 0) >= 75 and item.get('stage_eligible') is not False for item in checks)
    if watch_count:
        cue('scout_crop', 'pest', 'Weather may favour crop problems. Inspect leaves and growing points.', 'हवामान कीड-रोगांसाठी अनुकूल असू शकते. पाने व शेंडे तपासा.', ['weather_rules'])
    if not satellite_available:
        cue('satellite_missing', 'gis', 'Your farm boundary is saved. Crop observations are not recorded yet.', 'शेताची हद्द जतन आहे. पिकाचे उपग्रह निरीक्षण अद्याप नोंदलेले नाही.', ['satellite'])
    elif satellite_age > 21:
        cue('satellite_historical', 'gis', 'The satellite observation is historical. Confirm current field conditions.', 'उपग्रह निरीक्षण जुने आहे. सध्याची शेतस्थिती प्रत्यक्ष तपासा.', ['satellite'])
    if crop['stage'] is None:
        cue('crop_stage_missing', 'settings', 'Planting date and crop stage are not recorded; stage-based advice is limited.', 'लागवड तारीख व पिकाची अवस्था नोंदलेली नाही; अवस्थेनुसार सल्ला मर्यादित आहे.', ['farm_record'])
    return {'farm_id': farm_id, 'crop': crop,
            'satellite': {'available': satellite_available, 'observed_on': str(observed) if observed and satellite_available else None,
                          'age_days': satellite_age, 'historical': satellite_age is not None and satellite_age > 21,
                          'observation_count': len(history), 'history': history},
            'weather': {'available': weather is not None, 'fresh': weather_fresh, 'updated_at': updated},
            'soil': {'available': soil_available}, 'watch_count': watch_count, 'next_steps': cues,
            'analysis_readiness': {'biomass_tonnes': False, 'calibrated_chlorophyll': False,
                                   'nutrient_confirmation_required': True,
                                   'reason': 'Measured SAR, calibrated proxies and planting-to-date meteorology are not verified.'}}
