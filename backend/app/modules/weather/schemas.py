from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import date


class HourlyWeatherForecast(BaseModel):
    time: str
    time_label: str
    temp_c: float
    humidity_pct: float
    precipitation_mm: float
    precipitation_probability_pct: float = 0.0
    wind_speed_kmh: float
    vpd_kpa: float
    et0_mm: float
    weather_condition: str
    weather_icon: str
    is_stress: bool = False


class DailyWeatherForecast(BaseModel):
    date: date
    temp_max_c: float
    temp_min_c: float
    humidity_pct: Optional[float] = None
    rainfall_mm: float
    et0_mm: float
    vpd_kpa: Optional[float] = None
    gdd: float
    wind_kmh: Optional[float] = None
    weather_condition: str
    weather_icon: str
    precipitation_probability: float = 0.0
    water_demand_liters: Optional[float] = None
    etc_mm: Optional[float] = None


class IrrigationAdvisory(BaseModel):
    crop_stage: str
    kc: float
    et0_mm_day: float
    etc_mm_day: float
    net_irrigation_mm_day: float
    water_required_liters: float
    pump_discharge_l_s: float = 8.0
    pump_capacity_liters_per_hour: float
    irrigation_duration_hours: float
    irrigation_duration_label: str
    effective_rainfall_mm: float = 0.0
    is_estimated: bool = True
    assumptions_note: str = "Assumes 5 HP pump (8 L/s discharge), drip system, and FAO-56 effective rainfall."


class WeatherOverviewResponse(BaseModel):
    farm_id: UUID
    latitude: float
    longitude: float
    current_temp_c: float
    apparent_temp_c: float
    current_humidity_pct: float
    current_wind_speed_kmh: float
    current_precipitation_mm: float = 0.0
    current_condition: str
    current_icon: str
    current_et0_mm: float
    current_vpd_kpa: float
    forecast_7d_gdd: float = 0.0
    cumulative_gdd: float = 0.0  # Kept for backward compatibility (matches forecast_7d_gdd)
    cumulative_gdd_since_planting: Optional[float] = None
    planting_age_days: Optional[int] = None
    farm_area_acres: Optional[float] = None
    farm_area_m2: Optional[float] = None
    plantation_date: Optional[str] = None
    et0_source: str = "Open-Meteo FAO-56 NWP (Authoritative)"
    irrigation: IrrigationAdvisory
    hourly_forecast: List[HourlyWeatherForecast] = []
    forecast_7_day: List[DailyWeatherForecast] = []
    past_7_day: List[DailyWeatherForecast] = []
    
    crop_watch: List[Dict[str, Any]] = []
    crop_watch_outlook: List[Dict[str, Any]] = []
    field_context: Optional[Dict[str, Any]] = None

    # Metadata & Provenance
    weather_provider: str = "Open-Meteo Commercial"
    source_type: str = "NWP Forecast Model (Best Match)"
    forecast_timezone: str = "Asia/Kolkata"
    last_updated_utc: str = ""
    fetched_at_utc: str = ""
    is_cached: bool = False
    cache_expires_in_seconds: int = 900

