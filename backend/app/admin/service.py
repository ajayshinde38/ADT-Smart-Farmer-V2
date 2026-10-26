from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
import time
from starlette.concurrency import run_in_threadpool
from app.farmers import service as farmers
from app.farmers.context import build_field_context, number
from app.modules.gis.service import get_farm_plot_gis
from app.modules.weather.service import get_cached_farm_weather
from app.modules.advisory.service import get_farm_advisory
from app.core.records import read_records
from app.core.operations import EVENTS


def admin_plot(plot):
    if plot is None:
        return None
    data=plot.model_dump(mode='json')
    if data.get('raster'):
        data['raster']['overlay_urls']={key:f"/api/v1/admin/farms/{data['farm_id']}/raster/{key}.png" for key in data['raster'].get('overlay_urls',{})}
    return data


def directory():
    rows=[]
    for farmer in farmers.get_all_farmers():
        farms=[]
        for farm in farmer.get('farms',[]):
            plot=get_farm_plot_gis(farm['farm_id'])
            weather=get_cached_farm_weather(farm['farm_id'])
            context=build_field_context(farm,plot,weather)
            farms.append({'farm_id':str(farm['farm_id']), 'area_acres':farm['area_acre'],
                          'crop_name':farm.get('crop_name'), 'crop_variety':farm.get('crop_variety'),
                          'boundary_available':bool(farm.get('boundary_geojson')), 'raster_available':bool(plot and plot.raster and plot.raster.is_available),
                          'indices':plot.indices.model_dump(mode='json') if plot else {},
                          'advisory_inputs_ready':all(number((farm.get('soil') or {}).get(key)) is not None for key in ('oc','nitrogen_kg_ha','phosphorus_kg_ha','potassium_kg_ha')),
                          'context':context})
        rows.append({'farmer_id':str(farmer['farmer_id']), 'name':farmer['name'], 'mobile':farmer['mobile'],
                     'village':farmer.get('village') or farmer.get('address','').split('Tq.')[0].strip(),
                     'prn':farmer.get('prn'), 'area_acres':sum(f['area_acres'] for f in farms), 'farms':farms})
    return rows


async def overview():
    rows=await run_in_threadpool(directory)
    farms=[farm for row in rows for farm in row['farms']]
    scans=await read_records('pest_disease_records',limit=1000)
    advisories=await read_records('advisory_results',limit=1000)
    freshness=Counter('Missing' if not farm['context']['satellite']['available'] else '0–7 days' if farm['context']['satellite']['age_days']<=7 else '8–21 days' if farm['context']['satellite']['age_days']<=21 else 'Over 21 days' for farm in farms)
    recent=sorted([{'farmer_id':row['farmer_id'],'farmer_name':row['name'],'farm_id':farm['farm_id'],'date':farm['context']['satellite']['observed_on'],'indices':farm['indices']} for row in rows for farm in row['farms'] if farm['context']['satellite']['available']],key=lambda item:item['date'],reverse=True)[:10]
    return {'generated_at':datetime.now(timezone.utc).isoformat(), 'farmers':len(rows), 'farms':len(farms),
            'area_acres':round(sum(row['area_acres'] for row in rows),3),
            'boundaries':sum(f['boundary_available'] for f in farms),
            'satellite_available':sum(f['context']['satellite']['available'] for f in farms),
            'satellite_missing':sum(not f['context']['satellite']['available'] for f in farms),
            'raster_available':sum(f['raster_available'] for f in farms),
            'weather_cached':sum(f['context']['weather']['available'] for f in farms),
            'weather_fresh':sum(f['context']['weather']['fresh'] for f in farms),
            'soil_records':sum(f['context']['soil']['available'] for f in farms),
            'advisory_inputs_ready':sum(f['advisory_inputs_ready'] for f in farms),
            'satellite_freshness':[{'label':label,'count':freshness[label]} for label in ('0–7 days','8–21 days','Over 21 days','Missing')],
            'recent_observations':recent,
            'scans':{'available':scans['available'],'count':len(scans['items']) if scans['available'] else None,'limited_to':1000},
            'stored_advisories':{'available':advisories['available'],'count':len(advisories['items']) if advisories['available'] else None,'limited_to':1000},
            'by_village':[{'label':key or 'Not recorded','count':value} for key,value in Counter(row['village'] for row in rows).items()],
            'area_distribution':[{'label':row['name'],'value':row['area_acres']} for row in rows],
            'scan_categories':[{'label':key,'count':value} for key,value in Counter(row['detected_disease'] for row in scans['items']).items()],
            'data_note':'Current authoritative registry and local forecast cache; stored-history charts show up to 1,000 recorded rows. No bulk forecast fetch is performed.'}


async def farmer_detail(farmer_id):
    farmer=farmers.get_farmer_by_id(farmer_id)
    if not farmer:
        return None
    result={'farmer_id':str(farmer['farmer_id']),'name':farmer['name'],'mobile':farmer['mobile'],'village':farmer.get('village') or farmer.get('address'), 'prn':farmer.get('prn'),'farms':[]}
    for farm in farmer.get('farms',[]):
        plot=get_farm_plot_gis(farm['farm_id'])
        weather=get_cached_farm_weather(farm['farm_id'])
        advisory=get_farm_advisory(farm['farm_id'])
        result['farms'].append({'farm_id':str(farm['farm_id']), 'area_acres':farm['area_acre'], 'crop_name':farm.get('crop_name'),
            'crop_variety':farm.get('crop_variety'), 'soil':farm.get('soil'), 'gis':admin_plot(plot),
            'weather':weather.model_dump(mode='json') if weather else None, 'advisory':advisory.model_dump(mode='json') if advisory else None,
            'field_context':build_field_context(farm,plot,weather),
            'scans':await read_records('pest_disease_records',farm_id=farm['farm_id']),
            'advisory_history':await read_records('advisory_results',farm_id=farm['farm_id'])})
    return result


def operations():
    from app.modules.weather.service import _WEATHER_CACHE
    from app.modules.pest_disease.unet_classifier import _model_loaded
    from app.core.config import settings
    weights=Path(__file__).resolve().parents[1]/'modules/pest_disease/models/best_unet.pth'
    return {'generated_at':datetime.now(timezone.utc).isoformat(), 'backend':'running',
            'registry':{'last_success_age_seconds':round(time.time()-farmers._LAST_SYNC_TIMESTAMP) if farmers._LAST_SYNC_TIMESTAMP else None,'farmers_cached':len(farmers._CACHE_FARMERS)},
            'weather':{'configured':bool(settings.OPEN_METEO_BASE_URL),'paid_key_configured':bool(settings.OPEN_METEO_API_KEY),'cache_entries':len(_WEATHER_CACHE),'note':'Cache availability is not a live provider health probe.'},
            'model':{'weights_available':weights.is_file(),'loaded':_model_loaded},
            'events':list(EVENTS), 'event_retention':'Latest 200 events in this process; resets when the server restarts.',
            'admin_authority':'Supabase Auth app_metadata admin role; verified on each admin request.'}
