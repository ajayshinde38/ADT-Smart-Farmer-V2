"""
Central Agronomy Constants & Scientific Baselines for Sugarcane (Co 86032).
References:
  1. FAO Irrigation and Drainage Paper No. 56: Crop Evapotranspiration
     (Allen, Pereira, Raes, & Smith, 1998, Chapter 6 & Table 12).
  2. Vasantdada Sugar Institute (VSI), Pune: Water Management and Drip Fertigation
     Schedules for Sugarcane cultivar Co 86032 in Tropical Maharashtra.
  3. ICAR - Sugarcane Breeding Institute (SBI, Coimbatore): Thermal Unit (GDD)
     requirements and stage thresholds (Base 18°C).
"""

# Stage-specific Single Crop Coefficients (Kc) for Sugarcane (FAO-56 Table 12 & VSI Guidelines)
CROP_STAGE_KC = {
    "Sprouting":     0.15,   # Initial stage (Kc_ini): Sprouting & establishment (0-45 DAP)
    "Tillering":     0.50,   # Crop development: Formative & tillering phase (45-120 DAP)
    "Vegetative":    0.90,   # Late vegetative / transitional growth
    "Grand Growth":  1.20,   # Mid-season maximum (Kc_mid): Rapid cane elongation (120-270 DAP)
    "Maturity":      0.95,   # Late season ripening (Kc_late): Sucrose synthesis (270-360 DAP)
    "Harvest Ready": 0.70,   # End of season harvest drying (Kc_end): Pre-harvest drydown (>360 DAP)
    "Any":           0.90,   # Seasonal weighted fallback
}

DEFAULT_KC = 0.90

# FAO-56 / USDA Soil Conservation Service (SCS) Effective Rainfall Fraction
# For level drip-irrigated sugarcane fields in peninsular India, ~80% of rainfall > 1 mm is effective
EFFECTIVE_RAINFALL_FRACTION = 0.80

# Sugarcane biological base temperature for thermal unit (GDD) accumulation
# Below 18.0°C, cell division and internode elongation in tropical sugarcane cease (Inman-Bamber, 1994)
SUGARCANE_BASE_TEMP_C = 18.0


def kc_for_stage(crop_stage: str) -> float:
    """Return single crop coefficient (Kc) for given sugarcane growth stage."""
    return CROP_STAGE_KC.get(crop_stage, DEFAULT_KC)

