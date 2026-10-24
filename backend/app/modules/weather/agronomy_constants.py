"""
Central agronomy constants for Sugarcane (Co 86032).
Single-Kc approach from FAO-56.
"""

CROP_STAGE_KC = {
    "Sprouting":     0.15,   # initial stage (Kc_ini)
    "Tillering":     0.50,   # crop development
    "Vegetative":    0.90,   # late vegetative development
    "Grand Growth":  1.20,   # mid-season maximum (Kc_mid)
    "Maturity":      0.95,   # late season ripening
    "Harvest Ready": 0.70,   # end of season harvest drying (Kc_end)
    "Any":           0.90,   # fallback
}

DEFAULT_KC = 0.90
EFFECTIVE_RAINFALL_FRACTION = 0.80
SUGARCANE_BASE_TEMP_C = 18.0  # Base temperature for Sugarcane GDD calculation


def kc_for_stage(crop_stage: str) -> float:
    """Return single crop coefficient (Kc) for given sugarcane growth stage."""
    return CROP_STAGE_KC.get(crop_stage, DEFAULT_KC)
