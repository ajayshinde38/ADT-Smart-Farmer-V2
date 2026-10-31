import asyncio, json, logging, sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'backend'))
logging.disable(logging.CRITICAL)
from app.farmers import service as farmers
from app.modules.gis import service as gis
from app.modules.weather import service as weather
async def main():
    rows=[]
    for needle,area in [('amol shubhashrao',1.86),('asawari',1.9),('dhondiba',1.4)]:
        person=next(p for p in farmers.get_all_farmers() if needle in p['name'].lower())
        farm=farmers.get_farms_by_farmer_id(person['farmer_id'])[0]
        plot=gis.get_farm_plot_gis(farm['farm_id'])
        assert abs(plot.area_acres-area)<0.01
        row={'name':person['name'],'area_acres':plot.area_acres,'indices':plot.indices.model_dump(mode='json'),'raster':plot.raster.model_dump(mode='json') if plot.raster else None}
        if needle=='asawari': assert all(getattr(plot.indices,k) is None for k in ['ndvi','evi','ndre','msavi','ndmi','ndwi'])
        try:
            data=await weather.get_farm_weather_overview(farm['farm_id'])
            assert str(data.farm_id)==str(farm['farm_id'])
            row['weather']={'farm_matches':True,'temperature_c':data.current_temp_c,'timezone':data.forecast_timezone,'cache_entries':len(weather._WEATHER_CACHE)}
        except Exception as exc: row['weather']={'error_type':type(exc).__name__}
        rows.append(row)
    Path(__file__).with_name('farm-validation.json').write_text(json.dumps(rows,indent=2),encoding='utf8')
    print(json.dumps([{k:v for k,v in r.items() if k!='raster'} for r in rows],indent=2))
asyncio.run(main())
