import math
from typing import Dict, Any

EXPECTED_YIELD_TON_HA = 250.0  # Standard Maharashtra sugarcane target
HA_TO_ACRE = 2.47105           # 1 hectare = 2.47105 acres

# Fixed Basal Dose Products (kg/acre nutrient content)
NIMBOLI_PEND = {"name": "Nimboli Pend", "qty_kg": 100.0, "N": 5.0, "P": 1.0, "K": 2.0}
CALCIUM_NITRATE = {"name": "Calcium Nitrate", "qty_kg": 5.5, "N": 0.8525, "P": 0.0, "K": 0.0}
AZOTOBACTER = {"name": "Azotobacter", "qty_kg": 2.0, "N": 0.0, "P": 0.0, "K": 0.0}
PSB = {"name": "PSB (Phosphate Solubilizing Bacteria)", "qty_kg": 2.0, "N": 0.0, "P": 0.0, "K": 0.0}
BORAX = {"name": "Borax", "qty_kg": 2.0, "N": 0.0, "P": 0.0, "K": 0.0}

NPK_FERTILIZER_OPTIONS: Dict[str, Dict[str, Any]] = {
    "24:24:00": {"name": "24:24:00", "qty_kg": 100.0, "N": 24.0, "P": 24.0, "K": 0.0},
    "14:35:14": {"name": "14:35:14", "qty_kg": 100.0, "N": 14.0, "P": 35.0, "K": 14.0},
    "10:26:26": {"name": "10:26:26", "qty_kg": 100.0, "N": 10.0, "P": 26.0, "K": 26.0},
    "12:32:16": {"name": "12:32:16", "qty_kg": 100.0, "N": 12.0, "P": 32.0, "K": 16.0},
}
DEFAULT_FERTILIZER = "24:24:00"


def calculate_organic_manure(oc_value: float) -> float:
    """
    Organic Manure (ton/ha) requirement based on Organic Carbon (OC%):
    Starts at 28 ton/ha for OC in [0.1, 0.2) and decreases by 1 ton/ha
    for each 0.1 increase in OC.
    """
    bracket_index = math.floor((oc_value - 0.1) / 0.1 + 1e-9)
    om_ton_ha = max(5.0, 28.0 - bracket_index)
    return round(om_ton_ha, 2)


def calculate_stcr_rdf(oc: float, n_kg_ha: float, p_kg_ha: float, k_kg_ha: float, fertilizer_choice: str = DEFAULT_FERTILIZER) -> Dict[str, Any]:
    """
    Calculates Sugarcane Soil Test Crop Response (STCR) Recommended Dose of Fertilizer:
      rdf_n_ha = (4.03 * Yield) - (1.43 * N) - (3.81 * OM)
      rdf_p_ha = (1.23 * Yield) - (2.44 * P) - (1.83 * OM)
      rdf_k_ha = (2.26 * Yield) - (0.55 * K) - (1.40 * OM)
    """
    om_ton_ha = calculate_organic_manure(oc)
    om_ton_acre = round(om_ton_ha / 2.5, 2)  # Specified OM conversion factor

    # Equation values in kg/ha
    rdf_n_ha = (4.03 * EXPECTED_YIELD_TON_HA) - (1.43 * n_kg_ha) - (3.81 * om_ton_ha)
    rdf_p_ha = (1.23 * EXPECTED_YIELD_TON_HA) - (2.44 * p_kg_ha) - (1.83 * om_ton_ha)
    rdf_k_ha = (2.26 * EXPECTED_YIELD_TON_HA) - (0.55 * k_kg_ha) - (1.40 * om_ton_ha)

    # Floor at 0.0
    rdf_n_ha = max(0.0, rdf_n_ha)
    rdf_p_ha = max(0.0, rdf_p_ha)
    rdf_k_ha = max(0.0, rdf_k_ha)

    # Convert kg/ha -> kg/acre using standard 2.47105
    rdf_n_acre = round(rdf_n_ha / HA_TO_ACRE, 2)
    rdf_p_acre = round(rdf_p_ha / HA_TO_ACRE, 2)
    rdf_k_acre = round(rdf_k_ha / HA_TO_ACRE, 2)

    # Basal Dose calculation
    fert = NPK_FERTILIZER_OPTIONS.get(fertilizer_choice, NPK_FERTILIZER_OPTIONS[DEFAULT_FERTILIZER])
    basal_n = round(NIMBOLI_PEND["N"] + CALCIUM_NITRATE["N"] + fert["N"], 2)
    basal_p = round(NIMBOLI_PEND["P"] + CALCIUM_NITRATE["P"] + fert["P"], 2)
    basal_k = round(NIMBOLI_PEND["K"] + CALCIUM_NITRATE["K"] + fert["K"], 2)

    # Remaining RDF for Fertigation
    fertigation_n = max(0.0, round(rdf_n_acre - basal_n, 2))
    fertigation_p = max(0.0, round(rdf_p_acre - basal_p, 2))
    fertigation_k = max(0.0, round(rdf_k_acre - basal_k, 2))

    return {
        "expected_yield_ton_ha": EXPECTED_YIELD_TON_HA,
        "organic_manure_ton_ha": om_ton_ha,
        "organic_manure_ton_acre": om_ton_acre,
        "rdf_n_kg_ha": round(rdf_n_ha, 2),
        "rdf_p_kg_ha": round(rdf_p_ha, 2),
        "rdf_k_kg_ha": round(rdf_k_ha, 2),
        "rdf_n_kg_acre": rdf_n_acre,
        "rdf_p_kg_acre": rdf_p_acre,
        "rdf_k_kg_acre": rdf_k_acre,
        "basal_dose": {
            "fertilizer_selected": fert["name"],
            "organic_manure_ton_acre": om_ton_acre,
            "basal_n_kg_acre": basal_n,
            "basal_p_kg_acre": basal_p,
            "basal_k_kg_acre": basal_k,
            "items": {
                "nimboli_pend": NIMBOLI_PEND,
                "calcium_nitrate": CALCIUM_NITRATE,
                "azotobacter": AZOTOBACTER,
                "psb": PSB,
                "borax": BORAX,
                "npk_complex": fert,
            }
        },
        "final_fertigation_n_kg_acre": fertigation_n,
        "final_fertigation_p_kg_acre": fertigation_p,
        "final_fertigation_k_kg_acre": fertigation_k,
    }
