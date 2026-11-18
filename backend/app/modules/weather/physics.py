import math
from typing import Dict, Any, Optional
from app.modules.weather.agronomy_constants import kc_for_stage, EFFECTIVE_RAINFALL_FRACTION, SUGARCANE_BASE_TEMP_C


def saturation_vapour_pressure_kpa(temp_c: float) -> float:
    """Tetens equation for saturation vapour pressure (kPa)."""
    return 0.6108 * math.exp((17.27 * temp_c) / (temp_c + 237.3))


def compute_vpd_kpa(temp_max_c: float, temp_min_c: float, humidity_pct: float) -> float:
    """
    Vapour Pressure Deficit using the Tetens equation (FAO-56 style):
    es = mean of es(Tmax) and es(Tmin); ea = es * (RH/100); VPD = es - ea.
    """
    es_max = saturation_vapour_pressure_kpa(temp_max_c)
    es_min = saturation_vapour_pressure_kpa(temp_min_c)
    es = (es_max + es_min) / 2.0
    ea = es * (humidity_pct / 100.0)
    return round(max(0.0, es - ea), 2)


def compute_et0_hargreaves_mm(temp_max_c: float, temp_min_c: float, solar_mj_m2: float) -> float:
    """
    Hargreaves-Samani reference evapotranspiration ET0 (mm/day).
    1 MJ/m2 solar radiation ~= 0.408 mm evaporation equivalent.
    """
    temp_mean = (temp_max_c + temp_min_c) / 2.0
    temp_range = max(0.1, temp_max_c - temp_min_c)
    ra_mm_equiv = solar_mj_m2 * 0.408
    et0 = 0.0023 * ra_mm_equiv * (temp_mean + 17.8) * math.sqrt(temp_range)
    return round(max(0.0, et0), 2)


def compute_et0_penman_monteith(
    temp_max_c: float,
    temp_min_c: float,
    humidity_pct: float,
    wind_kmh: float,
    solar_mj_m2: float,
    latitude_deg: float,
    elevation_m: float = 560.0,
    day_of_year: int = 196,
) -> float:
    """
    FAO-56 Penman-Monteith reference evapotranspiration ET0 (mm/day).
    Allen et al., 1998, FAO-56 Ch. 2.
    """
    tmean = (temp_max_c + temp_min_c) / 2.0

    # Saturation and actual vapour pressure
    es_tmax = saturation_vapour_pressure_kpa(temp_max_c)
    es_tmin = saturation_vapour_pressure_kpa(temp_min_c)
    es = (es_tmax + es_tmin) / 2.0
    ea = es * (humidity_pct / 100.0)

    # Slope of vapour pressure curve
    es_tmean = saturation_vapour_pressure_kpa(tmean)
    delta = (4098.0 * es_tmean) / ((tmean + 237.3) ** 2)

    # Psychrometric constant
    pressure = 101.3 * (((293.0 - 0.0065 * elevation_m) / 293.0) ** 5.26)
    gamma = 0.000665 * pressure

    # Extraterrestrial radiation Ra
    phi = math.radians(latitude_deg)
    dr = 1.0 + 0.033 * math.cos((2.0 * math.pi * day_of_year) / 365.0)
    decl = 0.409 * math.sin((2.0 * math.pi * day_of_year) / 365.0 - 1.39)
    x = max(-1.0, min(1.0, -math.tan(phi) * math.tan(decl)))
    omega_s = math.acos(x)
    gsc = 0.0820
    ra = ((24.0 * 60.0) / math.pi) * gsc * dr * (
        omega_s * math.sin(phi) * math.sin(decl)
        + math.cos(phi) * math.cos(decl) * math.sin(omega_s)
    )

    # Net radiation Rn
    rso = (0.75 + 2e-5 * elevation_m) * ra
    rns = (1.0 - 0.23) * solar_mj_m2
    rs_rso = min(1.0, solar_mj_m2 / rso) if rso > 0 else 0.9
    sigma = 4.903e-9
    tmax_k = temp_max_c + 273.16
    tmin_k = temp_min_c + 273.16
    rnl = (
        sigma
        * ((tmax_k ** 4 + tmin_k ** 4) / 2.0)
        * (0.34 - 0.14 * math.sqrt(max(0.0, ea)))
        * (1.35 * rs_rso - 0.35)
    )
    rn = rns - rnl

    g = 0.0
    u2 = wind_kmh / 3.6  # m/s
    numerator = 0.408 * delta * (rn - g) + gamma * (900.0 / (tmean + 273.0)) * u2 * (es - ea)
    denominator = delta + gamma * (1.0 + 0.34 * u2)
    et0 = numerator / denominator if denominator else 0.0
    return round(max(0.0, et0), 2)


def compute_gdd(temp_max_c: float, temp_min_c: float, base_temp_c: float = SUGARCANE_BASE_TEMP_C) -> float:
    """Growing Degree Days (GDD) for sugarcane."""
    mean_temp = (temp_max_c + temp_min_c) / 2.0
    return round(max(0.0, mean_temp - base_temp_c), 1)


def compute_effective_rainfall(rainfall_mm: float) -> float:
    """
    FAO-56 / USDA Soil Conservation Service (SCS) daily effective rainfall:
    - Rain <= 1.0 mm is completely lost to canopy interception and surface evaporation.
    - Rain > 1.0 mm: ~80% infiltrates into the root zone and replaces irrigation demand.
    """
    if rainfall_mm <= 1.0:
        return 0.0
    return round(rainfall_mm * EFFECTIVE_RAINFALL_FRACTION, 2)


def compute_irrigation_requirement(
    et0_mm: float,
    crop_stage: str,
    field_area_m2: float,
    pump_discharge_l_s: float = 8.0,
    rainfall_week_mm: float = 0.0,
    subtract_rainfall: bool = True,
    rainfall_today_mm: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Deterministic FAO-56 irrigation requirement calculation:
      ETc (mm/day) = ET0 * Kc
      Net Irrigation (mm/day) = max(0, ETc - Effective Rainfall)
      Water Required (L) = Net Depth (mm) * Area (m2) [1 mm = 1 L/m2]
      Pump Capacity (L/hr) = Discharge (L/s) * 3600
      Irrigation Time (hr) = Water Required / Pump Capacity
    """
    kc = kc_for_stage(crop_stage)
    etc_mm_day = round(et0_mm * kc, 2)
    net_mm = etc_mm_day
    
    effective_rain_daily = 0.0
    if subtract_rainfall and rainfall_today_mm is not None:
        effective_rain_daily = compute_effective_rainfall(rainfall_today_mm)
        net_mm = max(0.0, round(etc_mm_day - effective_rain_daily, 2))
    elif subtract_rainfall and rainfall_week_mm > 0:
        effective_rain_daily = compute_effective_rainfall(rainfall_week_mm / 7.0)
        net_mm = max(0.0, round(etc_mm_day - effective_rain_daily, 2))

    water_required_liters = round(net_mm * field_area_m2, 1)
    pump_capacity_l_hr = round(pump_discharge_l_s * 3600, 1)
    hours = (water_required_liters / pump_capacity_l_hr) if pump_capacity_l_hr > 0 else 0.0

    if net_mm <= 0.0 or hours <= 0.0:
        duration_label = "0 min (Rain Sufficed)"
    else:
        hours_int = int(hours)
        minutes_int = int(round((hours - hours_int) * 60))
        if minutes_int == 60:
            hours_int += 1
            minutes_int = 0
        if hours_int > 0 and minutes_int > 0:
            duration_label = f"{hours_int} hr {minutes_int} min"
        elif hours_int > 0:
            duration_label = f"{hours_int} hr"
        else:
            duration_label = f"{minutes_int} min"

    return {
        "crop_stage": crop_stage,
        "kc": kc,
        "et0_mm_day": et0_mm,
        "etc_mm_day": etc_mm_day,
        "effective_rainfall_mm": effective_rain_daily,
        "net_irrigation_mm_day": net_mm,
        "water_required_liters": water_required_liters,
        "pump_discharge_l_s": pump_discharge_l_s,
        "pump_capacity_liters_per_hour": pump_capacity_l_hr,
        "irrigation_duration_hours": round(hours, 2),
        "irrigation_duration_label": duration_label,
        "is_estimated": True,
        "assumptions_note": f"Estimated using standard 5 HP pump ({pump_discharge_l_s} L/s), {crop_stage} stage (Kc={kc}), and FAO-56 effective rainfall.",
    }
