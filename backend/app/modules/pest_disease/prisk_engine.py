"""
prisk_engine.py

Sugarcane Pest & Disease Weather Risk Engine
Source of Truth: 'final A_B grade.xlsx' (Workbook sheets: Pest_Table, Daily_Predictor, Changes_Log)

Core Principles:
1. Pure Meteorological Weather Suitability Score (%):
   Weather Suitability Score (%) = 100 * (Matched valid criteria / Total valid criteria tested)
   Let M = number of valid criteria satisfied
   Let N = number of valid criteria actually tested
   Score = 100 * M / N

   Rules:
   - Exclude missing or unavailable observations from N (do not count missing data as failed).
   - Do not test thresholds that are undefined for a rule (e.g. Sett Rot has no rain threshold).
   - Never invent or fabricate a missing threshold.
   - Physical leaf-wetness sensor data: standard weather APIs do not provide measured leaf wetness.
     Unless an actual physical sensor measurement is supplied, leaf wetness is marked "Unavailable"
     and excluded from denominator N.
   - If N == 0: return "Insufficient weather data" rather than dividing by zero.

2. Configurable Operational Score Bands:
   - High weather suitability: score >= 75%
   - Medium weather suitability: score >= 50% and < 75%
   - Low weather suitability: score < 50%

3. Separation of Dimensions:
   - Weather Suitability Score indicates microclimatic favorability; it does NOT confirm disease or pest presence.
   - Crop-Stage Eligibility is evaluated separately and explicitly. If crop is outside the susceptible
     stage, it is reported as "Outside specified susceptible stage", keeping the weather score unpolluted.
   - Field visual inspection / AI image diagnosis remain independent validation layers.

4. Thermal Degree-Days:
   - Applied ONLY to the two approved rules defining them:
     * Top Shoot Borer (Base = 14.1°C, Cycle threshold = 718.07 degree-days)
     * Mealybug (Base = 17.0°C, Cycle threshold = 339.6 degree-days)
   - Daily GDD = max(0, Tmean - Tbase), where Tmean = (Tmin + Tmax) / 2
   - Cumulative GDD = sum of daily GDD over dated records, with missing day tracking.
"""

from __future__ import annotations

import datetime
import math
from typing import Any, Dict, List, Optional, Tuple

from .rule_registry import (
    check_crop_stage_eligibility,
    get_rule_by_id,
    get_rule_by_sr_no,
    load_approved_rules,
)


def calculate_daily_mean_temp(
    temp_min: Optional[float],
    temp_max: Optional[float],
    fallback_temp: Optional[float] = None
) -> Optional[float]:
    """
    Computes daily mean temperature as defined in 'final A_B grade.xlsx' (cell B9):
    Tmean = (Tmin + Tmax) / 2
    """
    if temp_min is not None and temp_max is not None:
        try:
            return round((float(temp_min) + float(temp_max)) / 2.0, 2)
        except (ValueError, TypeError):
            pass
    if fallback_temp is not None:
        try:
            return round(float(fallback_temp), 2)
        except (ValueError, TypeError):
            pass
    return None


def calculate_fao56_vpd(temp_c: Optional[float], humidity_pct: Optional[float]) -> Optional[float]:
    """
    Computes Vapour Pressure Deficit (VPD in kPa) using FAO-56 Tetens formulation.
    VPD = 0.6108 * exp(17.27 * T / (T + 237.3)) * (1 - RH / 100)
    """
    if temp_c is None or humidity_pct is None:
        return None
    try:
        t = float(temp_c)
        rh = max(0.0, min(100.0, float(humidity_pct)))
        sat_vp = 0.6108 * math.exp((17.27 * t) / (t + 237.3))
        vpd = sat_vp * (1.0 - (rh / 100.0))
        return max(0.0, round(vpd, 2))
    except (ValueError, TypeError):
        return None


def calculate_degree_days_for_records(
    rule: Dict[str, Any],
    daily_records: List[Dict[str, Any]]
) -> Optional[Dict[str, Any]]:
    """
    Calculates cumulative GDD from dated daily weather records.
    Applies ONLY to Top Shoot Borer and Mealybug.
    
    Requirements:
    - Base temperature: 14.1°C (Top Shoot Borer) or 17.0°C (Mealybug)
    - Threshold: 718.07 DD (Top Shoot Borer) or 339.6 DD (Mealybug)
    - Deduplicates dated daily temperature records.
    - Tracks missing days and data completeness.
    """
    pest_tbase = rule.get("pest_tbase")
    pest_dd = rule.get("pest_dd")
    if pest_tbase is None or pest_dd is None:
        return None

    try:
        t_base = float(pest_tbase)
        threshold_dd = float(pest_dd)
    except (ValueError, TypeError):
        return None

    if not daily_records:
        return {
            "pest_tbase": t_base,
            "cycle_threshold_dd": threshold_dd,
            "daily_gdd_today": None,
            "cumulative_gdd": 0.0,
            "accumulation_start_date": None,
            "accumulation_end_date": None,
            "valid_days_count": 0,
            "missing_days_count": 0,
            "data_completeness_pct": 0.0,
            "cycle_completion_pct": 0.0,
            "cycle_completed": False,
            "projection": None,
        }

    # Deduplicate and sort by date
    dedup: Dict[datetime.date, Dict[str, Any]] = {}
    for r in daily_records:
        d = r.get("date")
        if isinstance(d, str):
            try:
                d = datetime.date.fromisoformat(d)
            except ValueError:
                continue
        elif not isinstance(d, datetime.date):
            continue
        dedup[d] = r

    if not dedup:
        return None

    sorted_dates = sorted(dedup.keys())
    start_date = sorted_dates[0]
    end_date = sorted_dates[-1]
    total_calendar_days = (end_date - start_date).days + 1

    cumulative_gdd = 0.0
    valid_days = 0
    missing_days = 0
    daily_gdds: List[float] = []

    # Iterate day-by-day across the calendar range to detect missing dates
    curr = start_date
    while curr <= end_date:
        if curr in dedup:
            row = dedup[curr]
            tmin = row.get("temp_min_c") or row.get("temp_min")
            tmax = row.get("temp_max_c") or row.get("temp_max")
            tmean = calculate_daily_mean_temp(tmin, tmax, fallback_temp=row.get("temp_c") or row.get("avg_temp_c"))
            if tmean is not None:
                gdd = max(0.0, tmean - t_base)
                cumulative_gdd += gdd
                daily_gdds.append(gdd)
                valid_days += 1
            else:
                missing_days += 1
        else:
            missing_days += 1
        curr += datetime.timedelta(days=1)

    today_record = dedup.get(end_date)
    today_tmin = today_record.get("temp_min_c") or today_record.get("temp_min") if today_record else None
    today_tmax = today_record.get("temp_max_c") or today_record.get("temp_max") if today_record else None
    today_tmean = calculate_daily_mean_temp(today_tmin, today_tmax, fallback_temp=today_record.get("temp_c") if today_record else None)
    today_gdd = max(0.0, round(today_tmean - t_base, 2)) if today_tmean is not None else None

    completeness_pct = round((valid_days / total_calendar_days) * 100.0, 1) if total_calendar_days > 0 else 0.0
    completion_pct = min(100.0, round((cumulative_gdd / threshold_dd) * 100.0, 1))
    cycle_completed = cumulative_gdd >= threshold_dd

    # Forecast projection based on recent average rate (last 7 valid days)
    projection = None
    if not cycle_completed and daily_gdds:
        recent_gdds = daily_gdds[-7:]
        avg_rate = sum(recent_gdds) / len(recent_gdds) if recent_gdds else 0.0
        if avg_rate > 0.0:
            remaining_dd = threshold_dd - cumulative_gdd
            days_remaining = int(round(remaining_dd / avg_rate))
            proj_date = end_date + datetime.timedelta(days=days_remaining)
            projection = {
                "projected_completion_date": proj_date.isoformat(),
                "projected_days_remaining": days_remaining,
                "assumed_daily_gdd_rate": round(avg_rate, 2),
                "assumptions": (
                    "Forecast projection assuming recent mean thermal accumulation continues without extremes. "
                    "Actual development will vary with field temperature fluctuations."
                )
            }

    return {
        "pest_tbase": t_base,
        "cycle_threshold_dd": threshold_dd,
        "daily_gdd_today": today_gdd,
        "cumulative_gdd": round(cumulative_gdd, 2),
        "accumulation_start_date": start_date.isoformat(),
        "accumulation_end_date": end_date.isoformat(),
        "valid_days_count": valid_days,
        "missing_days_count": missing_days,
        "total_calendar_days": total_calendar_days,
        "data_completeness_pct": completeness_pct,
        "cycle_completion_pct": completion_pct,
        "cycle_completed": cycle_completed,
        "projection": projection,
    }


def calculate_weather_suitability(
    rule: Dict[str, Any],
    weather: Dict[str, Any],
    current_stage: Optional[str] = None,
    crop_age_days: Optional[int] = None,
    daily_history: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    Evaluates the Weather Suitability Score (%) for an approved Grade A/B pest or disease rule.

    Score Formula:
        Score (%) = 100 * (Matched valid criteria / Total valid criteria tested) = 100 * M / N
    
    Evaluation Rules:
    - Missing observations are excluded from N (do not penalize score).
    - Undefined thresholds are excluded from N.
    - Leaf-wetness duration is marked "Unavailable" and excluded from N unless an actual
      physical sensor measurement is provided.
    - N == 0 returns "Insufficient weather data".
    """
    # Resolve authoritative rule data if incomplete dict passed
    rule_id = rule.get("id")
    sr_no = rule.get("sr_no")
    full_rule = get_rule_by_id(rule_id) or get_rule_by_sr_no(sr_no) or rule

    # 1. Weather Inputs Extraction
    temp_min_in = weather.get("temp_min_c") if weather.get("temp_min_c") is not None else weather.get("temp_min")
    temp_max_in = weather.get("temp_max_c") if weather.get("temp_max_c") is not None else weather.get("temp_max")
    fallback_temp = weather.get("temp_c") if weather.get("temp_c") is not None else weather.get("avg_temp_c")
    t_mean = calculate_daily_mean_temp(temp_min_in, temp_max_in, fallback_temp=fallback_temp)

    humidity_in = weather.get("humidity_pct")
    try:
        humidity = float(humidity_in) if humidity_in is not None else None
    except (ValueError, TypeError):
        humidity = None

    rain_in = weather.get("rainfall_mm")
    try:
        rainfall = float(rain_in) if rain_in is not None else None
    except (ValueError, TypeError):
        rainfall = None

    # Leaf wetness sensor measurement (Open-Meteo does NOT provide physical sensor leaf wetness)
    # A value is ONLY considered measured if explicitly tagged as sensor_measured=True or passed as measured_leaf_wetness_hrs
    measured_wetness = weather.get("measured_leaf_wetness_hrs")
    if measured_wetness is None and weather.get("is_leaf_wetness_sensor_measured") is True:
        measured_wetness = weather.get("leaf_wetness_hrs")

    try:
        leaf_wetness = float(measured_wetness) if measured_wetness is not None else None
    except (ValueError, TypeError):
        leaf_wetness = None

    # 2. Evaluate Criteria Criterion-by-Criterion
    criteria_details = []
    n_tested = 0
    m_matched = 0

    # Criterion A: Temperature (°C)
    t_min = full_rule.get("temp_min")
    t_max = full_rule.get("temp_max")
    if t_min is not None and t_max is not None:
        if t_mean is None:
            criteria_details.append({
                "criterion": "temperature",
                "label": "Daily Mean Temperature",
                "status": "Excluded",
                "tested": False,
                "matched": None,
                "observation": None,
                "unit": "°C",
                "lower_bound": t_min,
                "upper_bound": t_max,
                "reason": "Missing temperature observation (Tmin/Tmax unavailable)"
            })
        else:
            t_match = (t_min <= t_mean <= t_max)
            n_tested += 1
            if t_match:
                m_matched += 1
            criteria_details.append({
                "criterion": "temperature",
                "label": "Daily Mean Temperature",
                "status": "Matched" if t_match else "Unmatched",
                "tested": True,
                "matched": t_match,
                "observation": t_mean,
                "unit": "°C",
                "lower_bound": t_min,
                "upper_bound": t_max,
                "reason": f"Observed Tmean {t_mean}°C is within [{t_min}, {t_max}]°C" if t_match else f"Observed Tmean {t_mean}°C is outside [{t_min}, {t_max}]°C"
            })
    else:
        criteria_details.append({
            "criterion": "temperature",
            "label": "Daily Mean Temperature",
            "status": "Excluded",
            "tested": False,
            "matched": None,
            "observation": t_mean,
            "unit": "°C",
            "lower_bound": t_min,
            "upper_bound": t_max,
            "reason": "Undefined temperature threshold for this rule"
        })

    # Criterion B: Relative Humidity (%)
    rh_min = full_rule.get("rh_min")
    rh_max = full_rule.get("rh_max")
    if rh_min is not None and rh_max is not None:
        if humidity is None:
            criteria_details.append({
                "criterion": "relative_humidity",
                "label": "Relative Humidity",
                "status": "Excluded",
                "tested": False,
                "matched": None,
                "observation": None,
                "unit": "%",
                "lower_bound": rh_min,
                "upper_bound": rh_max,
                "reason": "Missing relative humidity observation"
            })
        else:
            rh_match = (rh_min <= humidity <= rh_max)
            n_tested += 1
            if rh_match:
                m_matched += 1
            criteria_details.append({
                "criterion": "relative_humidity",
                "label": "Relative Humidity",
                "status": "Matched" if rh_match else "Unmatched",
                "tested": True,
                "matched": rh_match,
                "observation": humidity,
                "unit": "%",
                "lower_bound": rh_min,
                "upper_bound": rh_max,
                "reason": f"Observed RH {humidity}% is within [{rh_min}, {rh_max}]%" if rh_match else f"Observed RH {humidity}% is outside [{rh_min}, {rh_max}]%"
            })
    else:
        criteria_details.append({
            "criterion": "relative_humidity",
            "label": "Relative Humidity",
            "status": "Excluded",
            "tested": False,
            "matched": None,
            "observation": humidity,
            "unit": "%",
            "lower_bound": rh_min,
            "upper_bound": rh_max,
            "reason": "Undefined relative humidity threshold for this rule"
        })

    # Criterion C: Rainfall (mm/day)
    r_min = full_rule.get("rainfall_min")
    r_max = full_rule.get("rainfall_max")
    if r_min is not None and r_max is not None:
        if rainfall is None:
            criteria_details.append({
                "criterion": "rainfall",
                "label": "Rainfall",
                "status": "Excluded",
                "tested": False,
                "matched": None,
                "observation": None,
                "unit": "mm/day",
                "lower_bound": r_min,
                "upper_bound": r_max,
                "reason": "Missing rainfall observation"
            })
        else:
            r_match = (r_min <= rainfall <= r_max)
            n_tested += 1
            if r_match:
                m_matched += 1
            criteria_details.append({
                "criterion": "rainfall",
                "label": "Rainfall",
                "status": "Matched" if r_match else "Unmatched",
                "tested": True,
                "matched": r_match,
                "observation": rainfall,
                "unit": "mm/day",
                "lower_bound": r_min,
                "upper_bound": r_max,
                "reason": f"Observed rain {rainfall} mm/day is within [{r_min}, {r_max}] mm" if r_match else f"Observed rain {rainfall} mm/day is outside [{r_min}, {r_max}] mm"
            })
    else:
        criteria_details.append({
            "criterion": "rainfall",
            "label": "Rainfall",
            "status": "Excluded",
            "tested": False,
            "matched": None,
            "observation": rainfall,
            "unit": "mm/day",
            "lower_bound": None,
            "upper_bound": None,
            "reason": "Undefined rainfall threshold for this rule in approved workbook (soil moisture / drainage dependent)"
        })

    # Criterion D: Leaf Wetness Duration (hours/day)
    lw_min = full_rule.get("leaf_wetness_min")
    lw_max = full_rule.get("leaf_wetness_max")
    if lw_min is not None and lw_max is not None:
        if leaf_wetness is None:
            criteria_details.append({
                "criterion": "leaf_wetness",
                "label": "Leaf Wetness Duration",
                "status": "Unavailable",
                "tested": False,
                "matched": None,
                "observation": None,
                "unit": "h/day",
                "lower_bound": lw_min,
                "upper_bound": lw_max,
                "reason": "Physical leaf-wetness sensor measurement unavailable; excluded from denominator per scientific specification"
            })
        else:
            lw_match = (lw_min <= leaf_wetness <= lw_max)
            n_tested += 1
            if lw_match:
                m_matched += 1
            criteria_details.append({
                "criterion": "leaf_wetness",
                "label": "Leaf Wetness Duration",
                "status": "Matched" if lw_match else "Unmatched",
                "tested": True,
                "matched": lw_match,
                "observation": leaf_wetness,
                "unit": "h/day",
                "lower_bound": lw_min,
                "upper_bound": lw_max,
                "reason": f"Measured leaf wetness {leaf_wetness} h/day is within [{lw_min}, {lw_max}] h" if lw_match else f"Measured leaf wetness {leaf_wetness} h/day is outside [{lw_min}, {lw_max}] h"
            })
    else:
        criteria_details.append({
            "criterion": "leaf_wetness",
            "label": "Leaf Wetness Duration",
            "status": "Excluded",
            "tested": False,
            "matched": None,
            "observation": None,
            "unit": "h/day",
            "lower_bound": None,
            "upper_bound": None,
            "reason": "Undefined leaf wetness threshold for this rule"
        })

    # 3. Calculate Score and Operational Band
    if n_tested == 0:
        score = None
        suitability_band = "Insufficient weather data"
        score_reason = "No valid weather criteria could be tested due to missing weather observations."
    else:
        score = round((m_matched / n_tested) * 100.0, 1)
        if score >= 75.0:
            suitability_band = "High"
        elif score >= 50.0:
            suitability_band = "Medium"
        else:
            suitability_band = "Low"
        score_reason = f"{m_matched} of {n_tested} valid weather criteria satisfied ({score}%)."

    # 4. Crop-Stage Eligibility (Independent dimension)
    stage_to_eval = current_stage or weather.get("crop_stage")
    is_eligible, stage_status, susceptible_stages = check_crop_stage_eligibility(
        full_rule, current_stage=stage_to_eval, crop_age_days=crop_age_days
    )

    # 5. Degree-Day Model (Strictly for Top Shoot Borer and Mealybug)
    degree_day_result = None
    if full_rule.get("pest_tbase") is not None:
        if daily_history:
            degree_day_result = calculate_degree_days_for_records(full_rule, daily_history)
        else:
            # Single-day GDD calculation
            tb = float(full_rule["pest_tbase"])
            dd_thresh = float(full_rule.get("pest_dd", 0))
            day_gdd = max(0.0, round(t_mean - tb, 2)) if t_mean is not None else None
            degree_day_result = {
                "pest_tbase": tb,
                "cycle_threshold_dd": dd_thresh,
                "daily_gdd_today": day_gdd,
                "cumulative_gdd": day_gdd or 0.0,
                "accumulation_start_date": weather.get("date"),
                "accumulation_end_date": weather.get("date"),
                "valid_days_count": 1 if day_gdd is not None else 0,
                "missing_days_count": 0,
                "data_completeness_pct": 100.0 if day_gdd is not None else 0.0,
                "cycle_completion_pct": min(100.0, round(((day_gdd or 0.0) / dd_thresh) * 100.0, 1)) if dd_thresh > 0 else 0.0,
                "cycle_completed": (day_gdd or 0.0) >= dd_thresh if dd_thresh > 0 else False,
                "projection": None,
            }

    # 6. Action Recommendation / Advisory
    if suitability_band == "High":
        if is_eligible is False:
            alert_badge = "🟢 LOW RISK (OUTSIDE SUSCEPTIBLE CROP STAGE)"
            alert_color = "#10b981"
            action_recommendation = (
                f"Weather conditions are highly favorable ({score}%), but the crop ({stage_to_eval}) "
                "is currently outside the susceptible stage window. Routine crop monitoring advised."
            )
        else:
            alert_badge = "🚨 HIGH WEATHER SUITABILITY (FIELD SCOUTING REQUIRED)"
            alert_color = "#ef4444"
            action_recommendation = (
                "High weather suitability. Field scouting recommended: visually inspect cane stalks, "
                "growing points, or leaf undersides, and take photos for AI diagnostic confirmation. "
                "Do not apply preventative chemical sprays solely on weather suitability."
            )
    elif suitability_band == "Medium":
        alert_badge = "🟡 MEDIUM WEATHER SUITABILITY"
        alert_color = "#f59e0b"
        action_recommendation = (
            "Moderate weather suitability. Microclimatic conditions are moderately favorable. "
            "Monitor vulnerable border rows and inspect fields weekly."
        )
    elif suitability_band == "Low":
        alert_badge = "🟢 LOW WEATHER SUITABILITY"
        alert_color = "#10b981"
        action_recommendation = (
            "Low weather suitability. Current microclimatic conditions are unfavorable "
            "for pathogen establishment or pest development."
        )
    else:
        alert_badge = "⚪ INSUFFICIENT WEATHER DATA"
        alert_color = "#6b7280"
        action_recommendation = (
            "Insufficient weather observations to evaluate suitability. "
            "Verify weather station connection or forecast provider status."
        )

    # Integer risk score for legacy components
    int_score = int(round(score)) if score is not None else 0

    return {
        "rule_id": full_rule.get("id"),
        "rule_sr_no": full_rule.get("sr_no"),
        "name": full_rule.get("name"),
        "organism": full_rule.get("organism", ""),
        "type": full_rule.get("type", ""),
        "category": full_rule.get("category", "Disease"),
        "evidence_grade": full_rule.get("evidence_grade", "B"),
        
        # Core Weather Suitability Score
        "weather_suitability_score": score,
        "suitability_band": suitability_band,
        "criteria_met_count": m_matched,
        "criteria_tested_count": n_tested,
        "criteria_details": criteria_details,
        "score_reason": score_reason,
        
        # Backward compatibility aliases
        "p_risk": int_score,
        "risk_score": int_score,
        "risk_band": suitability_band.upper() if suitability_band in ("High", "Medium", "Low") else "LOW",
        "risk_level": suitability_band,
        "match_ratio": round(m_matched / n_tested, 2) if n_tested > 0 else 0.0,
        "criteria_met": m_matched,
        "criteria_tested": n_tested,
        "alert_badge": alert_badge,
        "alert_color": alert_color,
        "action_recommendation": action_recommendation,
        
        # Stage Eligibility (Separate Dimension)
        "is_stage_eligible": is_eligible,
        "stage_status": stage_status,
        "susceptible_stages": susceptible_stages,
        "crop_stage_evaluated": stage_to_eval,
        
        # Weather Provenance
        "weather_summary": {
            "temp_mean_c": t_mean,
            "temp_min_c": temp_min_in,
            "temp_max_c": temp_max_in,
            "humidity_pct": humidity,
            "rainfall_mm": rainfall,
            "leaf_wetness_status": "Unavailable (sensor measurement not present)" if leaf_wetness is None else f"{leaf_wetness} h/day",
            "timestamp": weather.get("timestamp"),
            "source": weather.get("source", "open_meteo"),
            "is_forecast": weather.get("is_forecast", False),
        },
        
        # Degree-Day Evaluation
        "degree_day": degree_day_result,
        "pest_gdd_today": degree_day_result.get("daily_gdd_today") if degree_day_result else None,
        
        # Transparency & Limitations
        "scientific_disclaimer": (
            "Weather Suitability Score indicates microclimatic favorability based on approved agronomic rules; "
            "it does not confirm pest/pathogen presence or epidemiological outbreak probability."
        )
    }


# Backward-compatible alias for existing callers
calculate_p_risk = calculate_weather_suitability
