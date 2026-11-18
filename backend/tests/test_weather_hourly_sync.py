import asyncio
import pytest
from datetime import datetime, timezone, timedelta
from app.modules.weather import service as weather

def test_hourly_forecast_now_syncs_with_current(monkeypatch):
    farm_id = "fa001310-84ec-47b1-9564-ea0a64d9fc47"
    farm = {
        "farm_id": farm_id,
        "latitude": 18.15,
        "longitude": 74.57,
        "area_acre": 1.0,
        "growth_stage": "Grand Growth",
        "crop_name": "Sugarcane",
        "plantation_date": "2024-01-01",
    }
    
    local_now = datetime.now(timezone(timedelta(hours=5, minutes=30)))
    today_str = local_now.date().isoformat()
    
    # Generate 24 hourly timestamps for today
    hourly_times = [f"{today_str}T{h:02d}:00" for h in range(24)]
    
    # Simulated model temperatures: say model forecasted 25°C at current hour and 28°C next hour
    hourly_temps = [25.0] * 24
    current_hour = local_now.hour
    if current_hour + 1 < 24:
        hourly_temps[current_hour + 1] = 28.0
        
    mock_api_payload = {
        "current": {
            "temperature_2m": 23.2,
            "relative_humidity_2m": 51.0,
            "apparent_temperature": 24.1,
            "wind_speed_10m": 4.0,
            "precipitation": 0.0,
            "weather_code": 0,
            "vapour_pressure_deficit": 1.40,
        },
        "daily": {
            "time": [today_str],
            "temperature_2m_max": [32.0],
            "temperature_2m_min": [20.0],
            "precipitation_sum": [0.0],
            "precipitation_probability_max": [0.0],
            "weather_code": [0],
            "et0_fao_evapotranspiration": [5.2],
        },
        "hourly": {
            "time": hourly_times,
            "temperature_2m": hourly_temps,
            "relative_humidity_2m": [60.0] * 24,
            "precipitation": [0.0] * 24,
            "precipitation_probability": [0.0] * 24,
            "wind_speed_10m": [8.0] * 24,
            "vapour_pressure_deficit": [1.1] * 24,
            "et0_fao_evapotranspiration": [0.4] * 24,
            "weather_code": [0] * 24,
        }
    }
    
    monkeypatch.setattr(weather.farmer_service, "get_farm_by_id", lambda _: farm)
    async def mock_fetch(*args, **kwargs):
        return mock_api_payload
    monkeypatch.setattr(weather, "fetch_open_meteo", mock_fetch)
    monkeypatch.setattr(weather, "_WEATHER_CACHE", {})
    
    overview = asyncio.run(weather.get_farm_weather_overview(farm_id))
    assert overview is not None
    assert overview.current_temp_c == 23.2
    
    assert len(overview.hourly_forecast) > 0
    now_slot = overview.hourly_forecast[0]
    assert now_slot.time_label == "Now"
    # Ensure "Now" slot temp is synchronized with current microclimate temp (23.2°C, not raw 25.0°C)
    assert now_slot.temp_c == 23.2
    assert now_slot.humidity_pct == 51.0
    assert now_slot.wind_speed_kmh == 4.0
    assert now_slot.vpd_kpa == 1.40
    
    # Future hours should still retain their forecast model values
    if len(overview.hourly_forecast) > 1 and current_hour + 1 < 24:
        next_slot = overview.hourly_forecast[1]
        assert next_slot.time_label != "Now"
        assert next_slot.temp_c == 28.0

