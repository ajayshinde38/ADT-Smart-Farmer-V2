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
  address?: string;
  taluka?: string;
  district?: string;
  farm_id?: string;
  farm_area_acres?: number;
  crop_name?: string;
  crop_variety?: string;
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
    rvi?: number | null;
    vra?: number | null;
    capture_date?: string | null;
    cloud_coverage_pct: number | null;
  };
  raster?: {
    is_available: boolean;
    scene_id?: string;
    acquisition_date?: string;
    resolution_meters?: number;
    composite_start_date?: string | null;
    composite_end_date?: string | null;
    valid_pixel_coverage_pct?: number | null;
    coverage_by_index?: Record<string, number> | null;
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
  farm_id:string;farmer_id:string;farmer_name:string;area_acres:number;
  soil_status:{ph:number|null;ec:number|null;oc:number|null;nitrogen_kg_ha:number|null;phosphorus_kg_ha:number|null;potassium_kg_ha:number|null;organic_manure_ton_ha:number|null;organic_manure_ton_acre:number|null};
  rdf:null|{expected_yield_ton_ha:number;rdf_n_kg_ha:number;rdf_p_kg_ha:number;rdf_k_kg_ha:number;rdf_n_kg_acre:number;rdf_p_kg_acre:number;rdf_k_kg_acre:number;basal_dose:unknown;final_fertigation_n_kg_acre:number|null;final_fertigation_p_kg_acre:number|null;final_fertigation_k_kg_acre:number|null};
  weekly_schedules:unknown[];
  schedule?: FertigationScheduleData | null;
  // FertiNex extension is optional for compatibility with older hosted APIs.
  planning:{fertinex?:{model:string;season:string|null;season_source:string;current_dap:number|null;season_cutoff_dap:number|null;ph_band:string|null;status:string;note:string;missing_inputs:string[];bounded_target_kg_acre:Record<string,number>|null;applied_kg_acre:Record<string,number>|null;remaining_kg_acre:Record<string,number>|null;remaining_kg_farm:Record<string,number>|null;schedule:Array<{dap:number;date:string;status:string;products:Array<{product:string;kg_per_acre:number;kg_farm:number}>}>;balance:null|{delivered_kg_acre:Record<string,number>;unmet_kg_acre:Record<string,number>;excess_kg_acre:Record<string,number>}};generated_at:string;status:string;missing_inputs:string[];crop:FieldContext['crop'];target_yield_ton_ha:number;target_source:string;nutrient_totals_kg:Record<string,number>|null;assumptions:string[];product_prescription_available:boolean;application_history_available:boolean;reference_stage_splits:Array<{stage:string;days:string;N_percent:number;P_percent:number;K_percent:number}>;calendar_schedule_available:boolean;rainfall_today_forecast_mm:number|null;weather_guidance:string;weather_note:string};
}
export interface FertigationProduct {
  fertilizer: string;
  quantity: number;
  quantity_per_acre: number;
  unit: string;
  water_liters: number | null;
  water_liters_per_acre: number | null;
}

export interface FertigationPeriod {
  dap: number;
  period: string;
  application_date: string;
  start_date: string;
  end_date: string;
  days_remaining: number;
  status: string;
  recommendation_text: string;
  products: FertigationProduct[];
  target_n: number;
  target_p: number;
  target_k: number;
  farm_target_n: number;
  farm_target_p: number;
  farm_target_k: number;
  target_n_per_acre: number;
  target_p_per_acre: number;
  target_k_per_acre: number;
  is_upcoming: boolean;
  applied?: boolean;
}

export interface FertigationScheduleData {
  ph_range: string;
  ph_sheet: string;
  season: string;
  season_key: string;
  max_dap: number;
  plantation_date_str: string | null;
  current_dap: number | null;
  login_dap: number;
  area_acre: number;
  active_upcoming_dose: FertigationPeriod | null;
  current_period: FertigationPeriod | null;
  farmer_periods: FertigationPeriod[];
  application_groups: FertigationPeriod[];
  periods: FertigationPeriod[];
  applied_till_date: { N: number; P: number; K: number };
  farm_applied_till_date: { N: number; P: number; K: number };
  bounded_target_kg_acre: { N: number; P: number; K: number };
  farm_stcr_target_npk: { N: number; P: number; K: number };
  target_season_npk: { N: number; P: number; K: number };
  compliance_logs?: Record<string, { period: string; applied: boolean; notes?: string; logged_at?: string }>;
}

export interface ScanRecord {id:string;farm_id:string;farmer_id:string;detected_disease:string;confidence_score:number;affected_percentage:number;severity_level:string;status:string;created_at:string;has_image:boolean;treatment_summary?:string}
export interface HistoryData<T=ScanRecord>{available:boolean;items:T[];reason?:string|null;limit?:number}
export interface DashboardData{farm_id:string;gis:GISData|null;weather:WeatherData|null;advisory:AdvisoryData|null;field_context:FieldContext}

export interface DiseaseDetectionResult {
  model_results?:Array<{model:string;task:string;status:string;threshold:number;minimum_affected_percentage?:number;predictions:Array<{disease:string;score:number;detected:boolean;affected_percentage?:number}>}>;
  detected_diseases?:string[];
  decision_reason?:string|null;
  fusion_policy?:string|null;
  record_id?:string|null;record_saved?:boolean;history_note?:string|null;
  field_context?: FieldContext | null;
  detected_disease: string;
  marathi_name: string;
  confidence_score: number;
  affected_percentage: number;
  severity_level: string;
  status?: string;
  overlay_data_url?: string | null;
  disease_details: {
    treatment?:string;treatment_mr?:string;
    management_practices?:Array<{category:string;title:string;title_mr:string;items:string[];items_mr:string[]}>;
    chemical_references?:Array<{product:string;dosage:string;group:string;verification_status:string}>;
    reference_note?:string;reference_note_mr?:string;
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

export interface VraSummary {
  source_index: string;
  method: string;
  disclaimer: string;
  valid_pixel_count: number;
  counts: { check: number; monitor: number; strong: number; no_data: number };
  share_of_valid_pixels_pct: { check: number; monitor: number; strong: number };
}
