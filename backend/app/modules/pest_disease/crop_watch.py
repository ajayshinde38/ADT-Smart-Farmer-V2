"""Reference weather suitability rules, separated from image diagnosis."""
from .rule_registry import load_approved_rules
from .prisk_engine import calculate_weather_suitability


def build_crop_watch(day, crop_stage):
    if day is None:
        return []
    # Reference rainfall thresholds have no consistent accumulation interval.
    # Do not compare a one-day forecast to an unspecified rainfall total.
    weather = {'temp_min_c': day.temp_min_c, 'temp_max_c': day.temp_max_c,
               'humidity_pct': day.humidity_pct, 'rainfall_mm': None,
               'date': str(day.date), 'source': 'open_meteo_forecast', 'is_forecast': True}
    checks = []
    for rule in load_approved_rules():
        result = calculate_weather_suitability(rule, weather, current_stage=crop_stage)
        checks.append({'rule_id': rule['id'], 'name': rule['name'], 'category': rule['category'],
                       'score': result['weather_suitability_score'], 'criteria_tested': result['criteria_tested_count'],
                       'stage_eligible': result['is_stage_eligible'], 'date': str(day.date),
                       'symptoms': rule['field_symptoms'], 'evidence_grade': rule['evidence_grade'],
                       'leaf_wetness_measured': False, 'rainfall_interval_verified': False})
    return checks
