export interface FieldContext {
  farm_id: string;
  crop: { stage: string | null; stage_source: string; plantation_date: string | null; age_days: number | null };
  satellite: { available: boolean; observed_on: string | null; age_days: number | null; historical: boolean; observation_count: number;
    history: Array<{ date: string; ndvi: number | null; ndre: number | null; ndmi: number | null }> };
  weather: { available: boolean; fresh: boolean; updated_at: string | null };
  soil: { available: boolean };
  watch_count: number;
  next_steps: Array<{ code: string; target: string; text_en: string; text_mr: string; sources: string[] }>;
  analysis_readiness: { biomass_tonnes: boolean; calibrated_chlorophyll: boolean; nutrient_confirmation_required: boolean; reason: string };
}

export interface FarmerProfile {
  farmer_id: string;
  name: string;
  mobile: string;
  prn?: string;
  village?: string;
  farm_id?: string;
  farm_area_acres?: number;
}

export interface AuthState {
  token: string | null;
  farmer: FarmerProfile | null;
  language: 'en' | 'mr';
}

export interface GISData {
  field_context?: FieldContext | null;
  farm_id: string;
  latitude: number;
  longitude: number;
  area_acres: number;
  area_hectares?: number;
  geometry?: {
    type: string;
    coordinates: number[][][];
  };
  indices: {
    ndvi: number | null;
    evi?: number | null;
    ndre?: number | null;
    msavi?: number | null;
    ndmi?: number | null;
    ndwi?: number | null;
    capture_date?: string | null;
    cloud_coverage_pct: number | null;
  };
  raster?: {
    is_available: boolean;
    scene_id?: string;
    acquisition_date?: string;
    resolution_meters?: number;
    bounds?: number[][];
    overlay_urls?: Record<string, string>;
  } | null;
  health: {
    status: string;
    health_score: number;
    color_hex: string;
    recommendation: string;
  };
}

export interface HourlyWeatherForecast {
  time: string;
  time_label: string;
  temp_c: number;
  humidity_pct: number;
  precipitation_mm: number;
  precipitation_probability_pct: number;
  wind_speed_kmh: number;
  vpd_kpa: number;
  et0_mm: number;
  weather_condition: string;
  weather_icon: string;
  is_stress?: boolean;
}

export interface WeatherData {
  field_context?: FieldContext | null;
  crop_watch_outlook?: Array<{ date: string; checks: NonNullable<WeatherData['crop_watch']> }>;
  farm_id?: string;
  latitude?: number;
  longitude?: number;
  current_temp_c: number;
  apparent_temp_c?: number;
  current_humidity_pct: number;
  current_wind_speed_kmh?: number;
  current_precipitation_mm?: number;
  current_condition: string;
  current_icon: string;
  current_et0_mm: number;
  current_vpd_kpa: number;
  cumulative_gdd: number;
  forecast_7d_gdd?: number;
  cumulative_gdd_since_planting?: number | null;
  plantation_date?: string | null;
  et0_source?: string;
  irrigation: {
    crop_stage: string;
    kc: number;
    et0_mm_day?: number;
    etc_mm_day?: number;
    net_irrigation_mm_day: number;
    water_required_liters: number;
    pump_discharge_l_s?: number;
    pump_capacity_liters_per_hour: number;
    irrigation_duration_label: string;
    effective_rainfall_mm?: number;
    is_estimated?: boolean;
    assumptions_note?: string;
  };
  hourly_forecast?: HourlyWeatherForecast[];
  forecast_7_day: Array<{
    date: string;
    temp_max_c: number;
    temp_min_c: number;
    humidity_pct: number | null;
    rainfall_mm: number;
    precipitation_probability?: number;
    et0_mm: number;
    vpd_kpa?: number | null;
    gdd?: number;
    wind_kmh?: number | null;
    weather_condition: string;
    weather_icon: string;
  }>;
  crop_watch?: Array<{
    rule_id: string; name: string; category: string; score: number | null; criteria_tested: number;
    stage_eligible: boolean | null; date: string; symptoms: string; evidence_grade: string;
  }>;
  weather_provider?: string;
  source_type?: string;
  forecast_timezone?: string;
  last_updated_utc?: string;
  is_cached?: boolean;
  cache_expires_in_seconds?: number;
}

export interface AdvisoryData {
  farm_id: string;
  area_acres: number;
  soil_status: {
    ph: number;
    ec: number;
    oc: number;
    nitrogen_kg_ha: number;
    phosphorus_kg_ha: number;
    potassium_kg_ha: number;
    organic_manure_ton_ha: number;
    organic_manure_ton_acre: number;
  };
  rdf: {
    expected_yield_ton_ha: number;
    rdf_n_kg_acre: number;
    rdf_p_kg_acre: number;
    rdf_k_kg_acre: number;
    basal_dose: {
      fertilizer_selected: string;
      basal_n_kg_acre: number;
      basal_p_kg_acre: number;
      basal_k_kg_acre: number;
    };
    final_fertigation_n_kg_acre: number;
    final_fertigation_p_kg_acre: number;
    final_fertigation_k_kg_acre: number;
  };
  weekly_schedules: Array<{
    stage_name: string;
    days_range: string;
    duration_days: number;
    target_n_kg_acre: number;
    target_p_kg_acre: number;
    target_k_kg_acre: number;
    fertilizers_recommended: Array<{
      product: string;
      total_kg_acre: number;
      daily_dose_g: number;
    }>;
    dose_per_day: string;
  }>;
}

export interface DiseaseDetectionResult {
  field_context?: FieldContext | null;
  detected_disease: string;
  marathi_name: string;
  confidence_score: number;
  affected_percentage: number;
  severity_level: string;
  status?: string;
  overlay_data_url?: string | null;
  disease_details: {
    pathogen: string;
    symptoms: string;
    symptoms_mr: string;
    causes: string;
    causes_mr: string;
    prevention: string;
    prevention_mr: string;
    chemical_control: string;
    chemical_control_mr: string;
    recommended_products: Array<{
      product_name: string;
      active_ingredient: string;
      dose_per_acre: string;
    }>;
  } | null;
}
