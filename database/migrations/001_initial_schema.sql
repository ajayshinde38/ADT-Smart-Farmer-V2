-- ====================================================================
-- ADT SMART FARMER V2 — HARDENED SUPABASE POSTGRESQL SCHEMA MIGRATION
-- Migration: 001_initial_schema.sql
-- Description: Consolidated, idempotent, RLS-hardened schema for all 4 modules
-- Compatibility: Safe for fresh empty project or existing retry execution
-- ====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. FARMERS (Master Farmer Identity)
-- Supports multiple farmers sharing the same mobile phone (e.g. family accounts)
CREATE TABLE IF NOT EXISTS public.farmers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prn VARCHAR(50),
    name VARCHAR(200) NOT NULL,
    mobile VARCHAR(20) NOT NULL,
    address TEXT,
    village VARCHAR(200),
    taluka VARCHAR(200),
    district VARCHAR(200),
    factory_hub VARCHAR(200),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.farmers DROP CONSTRAINT IF EXISTS farmers_prn_key;
CREATE INDEX IF NOT EXISTS idx_farmers_mobile ON public.farmers(mobile);
CREATE INDEX IF NOT EXISTS idx_farmers_prn ON public.farmers(prn);

-- 3. FARMS (Farm plots, verified acres/hectares, and KML storage paths)
CREATE TABLE IF NOT EXISTS public.farms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id UUID NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
    latitude NUMERIC(10, 8) NOT NULL,
    longitude NUMERIC(11, 8) NOT NULL,
    area_value NUMERIC(10, 4) NOT NULL,
    area_unit VARCHAR(10) NOT NULL DEFAULT 'acre' CHECK (area_unit IN ('acre', 'hectare')),
    -- Exact conversion standard: 1 hectare = 2.47105 acres
    area_acres NUMERIC(10, 4) GENERATED ALWAYS AS (
        CASE WHEN area_unit = 'hectare' THEN ROUND(area_value * 2.47105, 4)
             ELSE area_value END
    ) STORED,
    area_hectares NUMERIC(10, 4) GENERATED ALWAYS AS (
        CASE WHEN area_unit = 'acre' THEN ROUND(area_value / 2.47105, 4)
             ELSE area_value END
    ) STORED,
    boundary_geojson JSONB,
    boundary_source VARCHAR(50) DEFAULT 'kml',
    kml_storage_path VARCHAR(500),
    crop_name VARCHAR(100) NOT NULL DEFAULT 'Sugarcane',
    crop_variety VARCHAR(100) NOT NULL DEFAULT 'Co 86032',
    plantation_date DATE,
    -- Growth stage is nullable; defaults to 'Unknown' if plantation date is unrecorded
    growth_stage VARCHAR(50) DEFAULT 'Unknown',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_farms_farmer ON public.farms(farmer_id);
CREATE INDEX IF NOT EXISTS idx_farms_location ON public.farms(latitude, longitude);

-- 4. USER-TO-FARMER ACCESS MAPPING (Supabase Auth Integration)
-- Maps Supabase auth.users to one or more farmer profiles (family account resolution)
CREATE TABLE IF NOT EXISTS public.user_farmer_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    farmer_id UUID NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'farmer' CHECK (role IN ('farmer', 'family_member', 'agronomist', 'admin')),
    is_primary BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, farmer_id)
);

CREATE INDEX IF NOT EXISTS idx_user_farmer_user ON public.user_farmer_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_farmer_farmer ON public.user_farmer_access(farmer_id);

-- 5. SOIL TEST RECORDS (Soil health parameters per farm plot)
-- NOTE: Unmeasured micronutrients are stored as NULL, NOT zero, to avoid false nutrient deficit advisories.
CREATE TABLE IF NOT EXISTS public.soil_test_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    sample_date DATE DEFAULT NULL,
    ph NUMERIC(5, 2) NOT NULL,
    ec NUMERIC(5, 2) NOT NULL,
    oc NUMERIC(5, 2) NOT NULL,
    nitrogen_kg_ha NUMERIC(7, 2) NOT NULL,
    phosphorus_kg_ha NUMERIC(7, 2) NOT NULL,
    potassium_kg_ha NUMERIC(7, 2) NOT NULL,
    sodium NUMERIC(7, 2) DEFAULT NULL,
    calcium_carbonate NUMERIC(7, 2) DEFAULT NULL,
    iron NUMERIC(7, 2) DEFAULT NULL,
    magnesium NUMERIC(7, 2) DEFAULT NULL,
    zinc NUMERIC(7, 2) DEFAULT NULL,
    copper NUMERIC(7, 2) DEFAULT NULL,
    sulfur NUMERIC(7, 2) DEFAULT NULL,
    boron NUMERIC(7, 2) DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_soil_tests_farm ON public.soil_test_records(farm_id);

-- 6. CROP CYCLES (Growing stages & timeline)
CREATE TABLE IF NOT EXISTS public.crop_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    cycle_name VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    expected_harvest_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'fallow')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crop_cycles_farm ON public.crop_cycles(farm_id);

-- 7. GIS OBSERVATIONS (Copernicus Sentinel-2 6 Vegetation Indices)
-- Cloud coverage is NULL if not explicitly observed by CDSE scene metadata
CREATE TABLE IF NOT EXISTS public.gis_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    capture_date DATE NOT NULL,
    source VARCHAR(50) NOT NULL DEFAULT 'sentinel_2_l2a',
    cloud_coverage_pct NUMERIC(5, 2) DEFAULT NULL,
    ndvi_mean NUMERIC(6, 4) NOT NULL,
    evi_mean NUMERIC(6, 4),
    ndre_mean NUMERIC(6, 4),
    msavi_mean NUMERIC(6, 4),
    ndmi_mean NUMERIC(6, 4),
    ndwi_mean NUMERIC(6, 4),
    health_status VARCHAR(50),
    health_score INT,
    raster_storage_path VARCHAR(500),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_gis_obs_farm_date UNIQUE(farm_id, capture_date)
);

CREATE INDEX IF NOT EXISTS idx_gis_obs_farm ON public.gis_observations(farm_id);
CREATE INDEX IF NOT EXISTS idx_gis_obs_date ON public.gis_observations(capture_date);

-- 8. WEATHER OBSERVATIONS & FORECASTS (Open-Meteo & FAO-56 Physics)
CREATE TABLE IF NOT EXISTS public.weather_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    observation_date DATE NOT NULL,
    source VARCHAR(50) NOT NULL DEFAULT 'open_meteo',
    temp_max_c NUMERIC(5, 2),
    temp_min_c NUMERIC(5, 2),
    humidity_pct NUMERIC(5, 2),
    rainfall_mm NUMERIC(7, 2) DEFAULT NULL,
    et0_mm NUMERIC(7, 2),
    vpd_kpa NUMERIC(6, 3),
    gdd NUMERIC(6, 2),
    wind_kmh NUMERIC(6, 2),
    weather_condition VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_weather_obs_farm_date UNIQUE(farm_id, observation_date)
);

CREATE INDEX IF NOT EXISTS idx_weather_obs_farm ON public.weather_observations(farm_id);
CREATE INDEX IF NOT EXISTS idx_weather_obs_date ON public.weather_observations(observation_date);

-- 9. ADVISORY RESULTS (STCR RDF & Weekly Fertigation Schedules)
-- target_yield_assumption_ton_ha clearly documents agronomic modeling assumption
CREATE TABLE IF NOT EXISTS public.advisory_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    fertilizer_selected VARCHAR(50) NOT NULL,
    target_yield_assumption_ton_ha NUMERIC(7, 2) NOT NULL DEFAULT 250.0,
    organic_manure_ton_ha NUMERIC(7, 2) NOT NULL,
    organic_manure_ton_acre NUMERIC(7, 2) NOT NULL,
    rdf_n_kg_acre NUMERIC(7, 2) NOT NULL,
    rdf_p_kg_acre NUMERIC(7, 2) NOT NULL,
    rdf_k_kg_acre NUMERIC(7, 2) NOT NULL,
    basal_n_kg_acre NUMERIC(7, 2) NOT NULL,
    basal_p_kg_acre NUMERIC(7, 2) NOT NULL,
    basal_k_kg_acre NUMERIC(7, 2) NOT NULL,
    final_fertigation_n_kg_acre NUMERIC(7, 2) NOT NULL,
    final_fertigation_p_kg_acre NUMERIC(7, 2) NOT NULL,
    final_fertigation_k_kg_acre NUMERIC(7, 2) NOT NULL,
    weekly_schedule JSONB NOT NULL,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_advisory_farm ON public.advisory_results(farm_id);

-- 10. PEST AND DISEASE RECORDS (PyTorch UNet Diagnostics)
CREATE TABLE IF NOT EXISTS public.pest_disease_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    farmer_id UUID NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
    image_storage_path VARCHAR(500) NOT NULL,
    overlay_storage_path VARCHAR(500),
    detected_disease VARCHAR(100) NOT NULL,
    confidence_score NUMERIC(5, 2) NOT NULL,
    affected_percentage NUMERIC(5, 2) NOT NULL,
    severity_level VARCHAR(50) NOT NULL,
    treatment_summary TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'diagnosed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pest_records_farm ON public.pest_disease_records(farm_id);
CREATE INDEX IF NOT EXISTS idx_pest_records_farmer ON public.pest_disease_records(farmer_id);

-- ====================================================================
-- HARDENED SECURITY FUNCTION (Zero-Recursion, Safe search_path)
-- ====================================================================

CREATE OR REPLACE FUNCTION public.user_has_farmer_access(target_farmer_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- Allow service_role full administrative access
    IF auth.role() = 'service_role' THEN
        RETURN TRUE;
    END IF;

    -- Deny if unauthenticated or target is null
    IF auth.uid() IS NULL OR target_farmer_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Check verified user mapping in public.user_farmer_access
    RETURN EXISTS (
        SELECT 1 FROM public.user_farmer_access
        WHERE user_id = auth.uid()
          AND farmer_id = target_farmer_id
    );
END;
$$;

-- Restrict function execution privileges
REVOKE ALL ON FUNCTION public.user_has_farmer_access(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_farmer_access(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_farmer_access(UUID) TO service_role;

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES — ALL 9 TABLES SECURED
-- ====================================================================

ALTER TABLE public.farmers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_farmer_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soil_test_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crop_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gis_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weather_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advisory_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pest_disease_records ENABLE ROW LEVEL SECURITY;

-- 1. Farmers Policies
DROP POLICY IF EXISTS "Farmers: read own profile" ON public.farmers;
CREATE POLICY "Farmers: read own profile" ON public.farmers
    FOR SELECT USING (public.user_has_farmer_access(id));

-- 2. Farms Policies
DROP POLICY IF EXISTS "Farms: read own farm" ON public.farms;
CREATE POLICY "Farms: read own farm" ON public.farms
    FOR SELECT USING (public.user_has_farmer_access(farmer_id));

-- 3. User-Farmer Access Policies (Self-Mapping Prevention)
-- Authenticated users can ONLY read their own mapping; cannot insert/update self-mappings
DROP POLICY IF EXISTS "User farmer access: read own mappings" ON public.user_farmer_access;
CREATE POLICY "User farmer access: read own mappings" ON public.user_farmer_access
    FOR SELECT USING (user_id = auth.uid());

-- 4. Soil Test Records Policies
DROP POLICY IF EXISTS "Soil tests: read own farm soil" ON public.soil_test_records;
CREATE POLICY "Soil tests: read own farm soil" ON public.soil_test_records
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.farms
            WHERE farms.id = soil_test_records.farm_id
              AND public.user_has_farmer_access(farms.farmer_id)
        )
    );

-- 5. Crop Cycles Policies
DROP POLICY IF EXISTS "Crop cycles: read own farm cycles" ON public.crop_cycles;
CREATE POLICY "Crop cycles: read own farm cycles" ON public.crop_cycles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.farms
            WHERE farms.id = crop_cycles.farm_id
              AND public.user_has_farmer_access(farms.farmer_id)
        )
    );

-- 6. GIS Observations Policies
DROP POLICY IF EXISTS "GIS: read own farm satellite observations" ON public.gis_observations;
CREATE POLICY "GIS: read own farm satellite observations" ON public.gis_observations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.farms
            WHERE farms.id = gis_observations.farm_id
              AND public.user_has_farmer_access(farms.farmer_id)
        )
    );

-- 7. Weather Observations Policies
DROP POLICY IF EXISTS "Weather: read own farm weather" ON public.weather_observations;
CREATE POLICY "Weather: read own farm weather" ON public.weather_observations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.farms
            WHERE farms.id = weather_observations.farm_id
              AND public.user_has_farmer_access(farms.farmer_id)
        )
    );

-- 8. Advisory Results Policies
DROP POLICY IF EXISTS "Advisory: read own farm advisory" ON public.advisory_results;
CREATE POLICY "Advisory: read own farm advisory" ON public.advisory_results
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.farms
            WHERE farms.id = advisory_results.farm_id
              AND public.user_has_farmer_access(farms.farmer_id)
        )
    );

-- 9. Pest & Disease Records Policies (Separate SELECT, INSERT with dual verification, UPDATE)
DROP POLICY IF EXISTS "Pest Disease: read and insert own records" ON public.pest_disease_records;
DROP POLICY IF EXISTS "Pest Disease: read own records" ON public.pest_disease_records;
CREATE POLICY "Pest Disease: read own records" ON public.pest_disease_records
    FOR SELECT USING (
        public.user_has_farmer_access(farmer_id)
    );

DROP POLICY IF EXISTS "Pest Disease: insert own records" ON public.pest_disease_records;
CREATE POLICY "Pest Disease: insert own records" ON public.pest_disease_records
    FOR INSERT WITH CHECK (
        public.user_has_farmer_access(farmer_id)
        AND EXISTS (
            SELECT 1 FROM public.farms
            WHERE farms.id = pest_disease_records.farm_id
              AND farms.farmer_id = pest_disease_records.farmer_id
        )
    );

DROP POLICY IF EXISTS "Pest Disease: update own records" ON public.pest_disease_records;
CREATE POLICY "Pest Disease: update own records" ON public.pest_disease_records
    FOR UPDATE USING (
        public.user_has_farmer_access(farmer_id)
    ) WITH CHECK (
        public.user_has_farmer_access(farmer_id)
        AND EXISTS (
            SELECT 1 FROM public.farms
            WHERE farms.id = pest_disease_records.farm_id
              AND farms.farmer_id = pest_disease_records.farmer_id
        )
    );

-- ====================================================================
-- STORAGE BUCKETS (Strictly Private — Preserves Existing Uploaded Files)
-- ====================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES 
    ('kml-storage', 'kml-storage', FALSE),
    ('disease-images', 'disease-images', FALSE),
    ('satellite-tiff', 'satellite-tiff', FALSE)
ON CONFLICT (id) DO UPDATE SET public = FALSE;

-- ====================================================================
-- END OF MIGRATION 001_initial_schema.sql
-- ====================================================================
