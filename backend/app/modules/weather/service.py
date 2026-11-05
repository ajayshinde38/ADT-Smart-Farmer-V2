import logging
import httpx
import re
import math
from datetime import date, datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, Tuple
from uuid import UUID

from app.core.config import settings
from app.farmers import service as farmer_service
from app.modules.weather.schemas import (
    WeatherOverviewResponse,
    DailyWeatherForecast,
    HourlyWeatherForecast,
    IrrigationAdvisory,
)
from app.modules.weather import physics

logger = logging.getLogger(__name__)

# In-process cache: key -> (timestamp_utc, WeatherOverviewResponse)
_WEATHER_CACHE: Dict[str, Tuple[datetime, WeatherOverviewResponse]] = {}


def provider_timestamp(payload):
    """Open-Meteo current.time is local to the provider's declared UTC offset."""
    try:
        timestamp = datetime.fromisoformat(payload['current']['time'])
        if timestamp.tzinfo is None:
            offset = payload.get('utc_offset_seconds')
            if not isinstance(offset, (int, float)) or isinstance(offset, bool) or abs(offset)>86400:
                from zoneinfo import ZoneInfo
                timestamp = timestamp.replace(tzinfo=ZoneInfo(payload.get('timezone', 'Asia/Kolkata')))
            else:
                timestamp = timestamp.replace(tzinfo=timezone(timedelta(seconds=offset)))
        return timestamp.astimezone(timezone.utc).isoformat()
    except (KeyError, TypeError, ValueError):
        return ''

def _redact_apikey(text: str) -> str:
    """Safely redact any Open-Meteo apikey query parameters from logs and errors."""
    if not text:
        return text
    return re.sub(r"apikey=[^&\s'\"]+", "apikey=REDACTED", str(text))


def get_weather_condition(code: int) -> tuple[str, str]:
    """Map WMO weather code to clear condition text and emoji icon."""
    mapping = {
        0: ("Clear Sky", "☀️"),
        1: ("Mainly Clear", "🌤️"),
        2: ("Partly Cloudy", "⛅"),
        3: ("Overcast", "☁️"),
        45: ("Foggy", "🌫️"),
        48: ("Depositing Rime Fog", "🌫️"),
        51: ("Light Drizzle", "🌦️"),
        53: ("Moderate Drizzle", "🌦️"),
        55: ("Dense Drizzle", "🌧️"),
        61: ("Slight Rain", "🌧️"),
        63: ("Moderate Rain", "🌧️"),
        65: ("Heavy Rain", "⛈️"),
        71: ("Slight Snow", "🌨️"),
        80: ("Rain Showers", "🌦️"),
        81: ("Moderate Showers", "🌧️"),
        82: ("Violent Showers", "⛈️"),
        95: ("Thunderstorm", "⚡"),
        96: ("Thunderstorm with Hail", "⛈️"),
    }
    return mapping.get(code, ("Partly Cloudy", "⛅"))


async def fetch_open_meteo(lat: float, lon: float) -> Dict[str, Any]:
    """
    Fetch raw weather forecast from the commercial Open-Meteo endpoint.
    Passes apikey via query params and redacts credentials in all logs.
    """
    endpoint = f"{settings.OPEN_METEO_BASE_URL.rstrip('/')}/v1/forecast"
    params: Dict[str, Any] = {
        "latitude": round(lat, 6),
        "longitude": round(lon, 6),
        "timezone": "Asia/Kolkata",
        "temperature_unit": "celsius",
        "wind_speed_unit": "kmh",
        "precipitation_unit": "mm",
        "forecast_days": 7,
        "current": [
            "temperature_2m",
            "relative_humidity_2m",
            "apparent_temperature",
            "precipitation",
            "weather_code",
            "wind_speed_10m",
            "vapour_pressure_deficit",
        ],
        "hourly": [
            "temperature_2m",
            "relative_humidity_2m",
            "precipitation",
            "precipitation_probability",
            "wind_speed_10m",
            "vapour_pressure_deficit",
            "et0_fao_evapotranspiration",
            "weather_code",
        ],
        "daily": [
            "temperature_2m_max",
            "temperature_2m_min",
            "precipitation_sum",
            "precipitation_probability_max",
            "weather_code",
            "et0_fao_evapotranspiration",
        ],
    }

    # Pass commercial API key if configured
    if settings.OPEN_METEO_API_KEY:
        params["apikey"] = settings.OPEN_METEO_API_KEY

    timeout = httpx.Timeout(settings.OPEN_METEO_TIMEOUT_SECONDS, connect=5.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            resp = await client.get(endpoint, params=params)
        except httpx.TimeoutException as e:
            safe_url = _redact_apikey(str(e.request.url) if e.request else endpoint)
            logger.error(f"Open-Meteo timeout calling {safe_url}")
            raise TimeoutError(f"Open-Meteo request timed out after {settings.OPEN_METEO_TIMEOUT_SECONDS}s")
        except Exception as e:
            logger.error(f"Open-Meteo network failure: {_redact_apikey(str(e))}")
            raise

        safe_url = _redact_apikey(str(resp.url))
        if resp.status_code == 200:
            logger.info('Open-Meteo forecast retrieved successfully')
            return resp.json()
        elif resp.status_code in (401, 403):
            logger.error(f"Open-Meteo commercial authentication rejected (HTTP {resp.status_code}) for {safe_url}")
            raise PermissionError(f"Commercial Open-Meteo authentication failed (HTTP {resp.status_code}). Verify OPEN_METEO_API_KEY.")
        elif resp.status_code == 429:
            logger.error(f"Open-Meteo rate limit exceeded (HTTP 429) for {safe_url}")
            raise RuntimeError("Open-Meteo rate limit exceeded (HTTP 429).")
        else:
            logger.error(f"Open-Meteo upstream error HTTP {resp.status_code}: {resp.text[:200]}")
            raise RuntimeError(f"Open-Meteo returned HTTP {resp.status_code}")


def _format_time_label(iso_time_str: str, is_now: bool) -> str:
    """Format hourly ISO timestamp into a readable bio-forecast label."""
    if is_now:
        return "Now"
    try:
        dt = datetime.fromisoformat(iso_time_str)
        hour = dt.hour
        am_pm = "AM" if hour < 12 else "PM"
        hour_12 = hour % 12
        if hour_12 == 0:
            hour_12 = 12
        return f"{hour_12} {am_pm}"
    except Exception:
        return iso_time_str[-5:]


async def get_farm_weather_overview(farm_id: UUID | str) -> Optional[WeatherOverviewResponse]:
    """
    Generate agro-meteorological metrics, bio-forecast, ET0, VPD, and
    deterministic irrigation schedule for an authenticated farmer's plot.
    Features in-process caching with configurable TTL.
    """
    farm = farmer_service.get_farm_by_id(farm_id)
    if not farm:
        return None

    lat = float(farm["latitude"])
    lon = float(farm["longitude"])
    area_acres = float(farm["area_acre"])
    area_m2 = area_acres * 4046.8564224  # 1 acre = 4046.856 m2
    from app.farmers.context import resolve_crop_context
    crop = resolve_crop_context(farm)
    crop_stage = crop['stage'] or 'Unknown' 

    # In-process cache check
    cache_key = f"{farm_id}:{lat:.6f}:{lon:.6f}:{area_acres}:{crop_stage}:{farm.get('pump_discharge_l_s')}:{crop['plantation_date']}"
    now_utc = datetime.now(timezone.utc)
    cached_entry = _WEATHER_CACHE.get(cache_key)

    if cached_entry:
        cached_time, cached_response = cached_entry
        elapsed_seconds = (now_utc - cached_time).total_seconds()
        if elapsed_seconds < settings.OPEN_METEO_CACHE_TTL_SECONDS:
            # Return fresh cached response
            remaining_seconds = int(settings.OPEN_METEO_CACHE_TTL_SECONDS - elapsed_seconds)
            res_dict = cached_response.model_dump()
            res_dict["is_cached"] = True
            res_dict["cache_expires_in_seconds"] = remaining_seconds
            # Update farm-specific ID and acreage in case shared cache key
            res_dict["farm_id"] = UUID(str(farm["farm_id"]))
            return WeatherOverviewResponse(**res_dict)

    # Fetch live from commercial Open-Meteo
    api_data: Optional[Dict[str, Any]] = None
    fetch_error: Optional[Exception] = None

    try:
        api_data = await fetch_open_meteo(lat, lon)
    except Exception as e:
        fetch_error = e
        logger.warning(f"Live Open-Meteo fetch failed for {farm_id}: {_redact_apikey(str(e))}")

    # If live fetch failed, attempt to serve stale cached data if available
    if not api_data or "daily" not in api_data:
        if cached_entry:
            cached_time, cached_response = cached_entry
            logger.warning(f"Serving stale cached weather for farm {farm_id} from {cached_time}")
            res_dict = cached_response.model_dump()
            res_dict["is_cached"] = True
            res_dict["cache_expires_in_seconds"] = 0
            res_dict["farm_id"] = UUID(str(farm["farm_id"]))
            return WeatherOverviewResponse(**res_dict)
        # If no cache exists, do not fabricate numbers! Re-raise or return None
        if fetch_error:
            raise fetch_error
        return None

    # Required provider values must be real; fail visibly instead of fabricating.
    required_current = ('temperature_2m', 'relative_humidity_2m', 'apparent_temperature', 'wind_speed_10m', 'precipitation', 'weather_code')
    current_payload = api_data.get('current', {})
    daily_payload = api_data.get('daily', {})
    if any(not isinstance(current_payload.get(key), (float, int)) or not math.isfinite(current_payload[key]) for key in required_current):
        raise RuntimeError('Incomplete current weather from provider')
    day_count = len(daily_payload.get('time', []))
    for key in ('temperature_2m_max','temperature_2m_min','precipitation_sum','precipitation_probability_max','weather_code','et0_fao_evapotranspiration'):
        column = daily_payload.get(key, [])
        if day_count == 0 or len(column) != day_count or any(not isinstance(value, (float, int)) or not math.isfinite(value) for value in column):
            raise RuntimeError('Incomplete daily weather from provider')

    # Parse current weather
    current = api_data.get("current", {})
    curr_temp = float(current.get("temperature_2m", 32.0))
    curr_apparent = float(current.get("apparent_temperature", curr_temp))
    curr_rh = float(current.get("relative_humidity_2m", 50.0))
    curr_wind = float(current.get("wind_speed_10m", 12.0))
    curr_precip = float(current.get("precipitation", 0.0))
    curr_wmo = int(current.get("weather_code", 0))
    curr_cond, curr_icon = get_weather_condition(curr_wmo)
    raw_vpd = current.get('vapour_pressure_deficit')
    curr_vpd = float(raw_vpd) if isinstance(raw_vpd, (float, int)) and math.isfinite(raw_vpd) else physics.compute_vpd_kpa(curr_temp, curr_temp, curr_rh)

    # Parse 7-day daily forecast
    daily = api_data.get("daily", {})
    times = daily.get("time", [])
    t_maxs = daily.get("temperature_2m_max", [])
    t_mins = daily.get("temperature_2m_min", [])
    precip_sums = daily.get("precipitation_sum", [])
    precip_probs = daily.get("precipitation_probability_max", [])
    codes = daily.get("weather_code", [])
    daily_et0s = daily.get("et0_fao_evapotranspiration", [])

    forecast_list: List[DailyWeatherForecast] = []
    total_rain_week = 0.0
    accumulated_7d_gdd = 0.0

    for i in range(len(times)):
        t_max = float(t_maxs[i]) if i < len(t_maxs) else curr_temp + 2
        t_min = float(t_mins[i]) if i < len(t_mins) else curr_temp - 10
        rain = float(precip_sums[i]) if i < len(precip_sums) else 0.0
        prob = float(precip_probs[i]) if i < len(precip_probs) else 0.0
        code = int(codes[i]) if i < len(codes) else 0
        cond, icon = get_weather_condition(code)

        # Use Open-Meteo FAO-56 daily ET0 directly
        if i < len(daily_et0s) and daily_et0s[i] is not None:
            et0_val = round(float(daily_et0s[i]), 2)
        else:
            et0_val = round(physics.compute_et0_hargreaves_mm(t_max, t_min, 20.0), 2)

        # Sugarcane GDD (Base 18°C)
        daily_gdd = physics.compute_gdd(t_max, t_min, base_temp_c=18.0)
        accumulated_7d_gdd += daily_gdd
        total_rain_week += rain
        hourly_source = api_data.get('hourly', {})
        def daily_mean(variable):
            values = hourly_source.get(variable, [])
            samples = [values[j] for j, stamp in enumerate(hourly_source.get('time', []))
                       if stamp.startswith(times[i]) and j < len(values) and isinstance(values[j], (float, int)) and math.isfinite(values[j])]
            return round(sum(samples) / len(samples), 1) if len(samples) == 24 else None
        daily_rh = daily_mean('relative_humidity_2m')
        daily_wind = daily_mean('wind_speed_10m')
        daily_vpd = physics.compute_vpd_kpa(t_max, t_min, daily_rh) if daily_rh is not None else None

        forecast_list.append(DailyWeatherForecast(
            date=date.fromisoformat(times[i]),
            temp_max_c=round(t_max, 1),
            temp_min_c=round(t_min, 1),
            humidity_pct=daily_rh,
            rainfall_mm=round(rain, 1),
            precipitation_probability=round(prob, 1),
            et0_mm=et0_val,
            vpd_kpa=daily_vpd,
            gdd=round(daily_gdd, 1),
            wind_kmh=daily_wind,
            weather_condition=cond,
            weather_icon=icon,
        ))

    curr_et0 = forecast_list[0].et0_mm if forecast_list else 5.2

    # Parse hourly forecast (extract next 8 to 12 hours from current local time)
    hourly = api_data.get("hourly", {})
    hourly_times = hourly.get("time", [])
    hourly_temps = hourly.get("temperature_2m", [])
    hourly_rhs = hourly.get("relative_humidity_2m", [])
    hourly_precips = hourly.get("precipitation", [])
    hourly_probs = hourly.get("precipitation_probability", [])
    hourly_winds = hourly.get("wind_speed_10m", [])
    hourly_vpds = hourly.get("vapour_pressure_deficit", [])
    hourly_et0s = hourly.get("et0_fao_evapotranspiration", [])
    hourly_codes = hourly.get("weather_code", [])

    # Find the hourly index matching current local time
    # In Asia/Kolkata (UTC + 5:30), get local current hour
    local_now = datetime.now(timezone(timedelta(hours=5, minutes=30)))
    current_hour_prefix = local_now.strftime("%Y-%m-%dT%H:00")

    start_idx = len(hourly_times)
    for idx, t_str in enumerate(hourly_times):
        if t_str >= current_hour_prefix:
            start_idx = idx
            break

    hourly_forecast_list: List[HourlyWeatherForecast] = []
    # Take next 10 hours from start_idx
    for offset in range(10):
        h_idx = start_idx + offset
        if h_idx >= len(hourly_times):
            break

        needed = (hourly_temps, hourly_rhs, hourly_precips, hourly_probs, hourly_winds, hourly_vpds, hourly_et0s, hourly_codes)
        if any(h_idx >= len(values) or not isinstance(values[h_idx], (float, int)) or not math.isfinite(values[h_idx]) for values in needed):
            continue
        iso_t = hourly_times[h_idx]
        h_temp = float(hourly_temps[h_idx]) if h_idx < len(hourly_temps) else curr_temp
        h_rh = float(hourly_rhs[h_idx]) if h_idx < len(hourly_rhs) else curr_rh
        h_precip = float(hourly_precips[h_idx]) if h_idx < len(hourly_precips) else 0.0
        h_prob = float(hourly_probs[h_idx]) if h_idx < len(hourly_probs) else 0.0
        h_wind = float(hourly_winds[h_idx]) if h_idx < len(hourly_winds) else curr_wind
        h_vpd = float(hourly_vpds[h_idx]) if h_idx < len(hourly_vpds) else curr_vpd
        h_et0 = float(hourly_et0s[h_idx]) if h_idx < len(hourly_et0s) else 0.4
        h_code = int(hourly_codes[h_idx]) if h_idx < len(hourly_codes) else 0
        h_cond, h_icon = get_weather_condition(h_code)

        time_label = _format_time_label(iso_t, is_now=(offset == 0))

        hourly_forecast_list.append(HourlyWeatherForecast(
            time=iso_t,
            time_label=time_label,
            temp_c=round(h_temp, 1),
            humidity_pct=round(h_rh, 1),
            precipitation_mm=round(h_precip, 1),
            precipitation_probability_pct=round(h_prob, 1),
            wind_speed_kmh=round(h_wind, 1),
            vpd_kpa=round(h_vpd, 2),
            et0_mm=round(h_et0, 2),
            weather_condition=h_cond,
            weather_icon=h_icon,
            is_stress=(h_vpd > 2.2),
        ))

    pump_discharge_val = float(farm.get("pump_discharge_l_s") or 8.0)
    plantation_date = farm.get("plantation_date")
    forecast_7d_gdd = round(accumulated_7d_gdd, 1)

    # Compute deterministic FAO-56 single-Kc irrigation recommendation
    irrigation_dict = physics.compute_irrigation_requirement(
        et0_mm=curr_et0,
        crop_stage=crop_stage,
        field_area_m2=area_m2,
        pump_discharge_l_s=pump_discharge_val,
        rainfall_week_mm=total_rain_week,
        subtract_rainfall=True,
        rainfall_today_mm=forecast_list[0].rainfall_mm,
    )

    from app.modules.pest_disease.crop_watch import build_crop_watch
    local_date = local_now.date()
    watch_day = next((day for day in forecast_list if day.date == local_date), None)
    crop_watch = build_crop_watch(watch_day, crop_stage)
    crop_watch_outlook = [{'date': str(day.date), 'checks': build_crop_watch(day, crop_stage)} for day in forecast_list]

    irrigation_dict['assumptions_note'] += ' Rain adjustment uses today’s forecast only; later rain is not credited to today.'

    provider_name = "Open-Meteo Commercial" if settings.OPEN_METEO_API_KEY else "Open-Meteo"
    overview = WeatherOverviewResponse(
        farm_id=UUID(str(farm["farm_id"])),
        latitude=lat,
        longitude=lon,
        current_temp_c=round(curr_temp, 1),
        apparent_temp_c=round(curr_apparent, 1),
        current_humidity_pct=round(curr_rh, 1),
        current_wind_speed_kmh=round(curr_wind, 1),
        current_precipitation_mm=round(curr_precip, 1),
        current_condition=curr_cond,
        current_icon=curr_icon,
        current_et0_mm=round(curr_et0, 2),
        current_vpd_kpa=round(curr_vpd, 2),
        forecast_7d_gdd=forecast_7d_gdd,
        cumulative_gdd=forecast_7d_gdd,
        cumulative_gdd_since_planting=None,  # Not fabricated when historical planting weather is unverified
        plantation_date=str(plantation_date) if plantation_date else None,
        et0_source="Open-Meteo FAO-56 NWP (Authoritative)",
        irrigation=IrrigationAdvisory(**irrigation_dict),
        hourly_forecast=hourly_forecast_list,
        forecast_7_day=forecast_list,
        crop_watch=crop_watch,
        crop_watch_outlook=crop_watch_outlook,
        weather_provider=provider_name,
        source_type="Best Match NWP Model",
        forecast_timezone="Asia/Kolkata",
        last_updated_utc=provider_timestamp(api_data),
        fetched_at_utc=now_utc.isoformat(),
        is_cached=False,
        cache_expires_in_seconds=settings.OPEN_METEO_CACHE_TTL_SECONDS,
    )

    from app.farmers.context import build_field_context
    from app.modules.gis.service import get_farm_plot_gis
    try:
        plot_context = get_farm_plot_gis(farm_id)
    except Exception as error:
        logger.warning('Satellite context unavailable: %s', type(error).__name__)
        plot_context = None
    overview.field_context = build_field_context(farm, plot_context, overview)

    # Store in in-process cache
    _WEATHER_CACHE[cache_key] = (now_utc, overview)
    return overview


def get_cached_farm_weather(farm_id):
    """Local snapshot only: image analysis must not trigger an external weather request."""
    matches = [(stamp, data) for stamp, data in list(_WEATHER_CACHE.values()) if str(data.farm_id) == str(farm_id)]
    if not matches:
        return None
    stamp, data = max(matches, key=lambda row: row[0])
    return data.model_copy(deep=True)
