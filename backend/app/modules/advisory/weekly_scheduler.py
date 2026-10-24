from typing import List, Dict, Any

# Catalog of 16 real Maharashtra-market fertilizer products: (N%, P%, K%)
FERTILIZER_CATALOG: Dict[str, tuple[float, float, float]] = {
    "Urea":                         (0.46, 0.00, 0.00),
    "Ammonium Sulphate":            (0.205, 0.00, 0.00),
    "CAN":                          (0.25, 0.00, 0.00),
    "SSP":                          (0.00, 0.16, 0.00),
    "Phosphoric Acid":              (0.00, 0.61, 0.00),
    "MOP":                          (0.00, 0.00, 0.60),
    "SOP":                          (0.00, 0.00, 0.50),
    "19:19:19":                     (0.19, 0.19, 0.19),
    "17:17:17":                     (0.17, 0.17, 0.17),
    "12:32:16":                     (0.12, 0.32, 0.16),
    "14:35:14":                     (0.14, 0.35, 0.14),
    "10:26:26":                     (0.10, 0.26, 0.26),
    "MAP (12:61:00)":               (0.12, 0.61, 0.00),
    "DAP (18:46:00)":               (0.18, 0.46, 0.00),
    "MKP (00:52:34)":               (0.00, 0.52, 0.34),
    "Potassium Nitrate (13:00:45)": (0.13, 0.00, 0.45),
}

# Seasonal Growth Stages and Nutrient Split Percentages
STAGES_SPLIT = [
    {
        "stage_name": "Sprouting & Early Establishment",
        "days_range": "1 - 30 Days",
        "duration_days": 30,
        "n_pct": 0.10,
        "p_pct": 0.25,
        "k_pct": 0.10,
        "primary_product": "19:19:19",
        "topup_n": "Urea",
    },
    {
        "stage_name": "Tillering & Root Development",
        "days_range": "31 - 90 Days",
        "duration_days": 60,
        "n_pct": 0.30,
        "p_pct": 0.45,
        "k_pct": 0.20,
        "primary_product": "12:32:16",
        "topup_n": "Urea",
    },
    {
        "stage_name": "Grand Growth (Cane Elongation)",
        "days_range": "91 - 210 Days",
        "duration_days": 120,
        "n_pct": 0.50,
        "p_pct": 0.30,
        "k_pct": 0.45,
        "primary_product": "10:26:26",
        "topup_n": "Urea",
    },
    {
        "stage_name": "Maturity & Sugar Accumulation",
        "days_range": "211 - 300 Days",
        "duration_days": 90,
        "n_pct": 0.10,
        "p_pct": 0.00,
        "k_pct": 0.25,
        "primary_product": "SOP",
        "topup_n": "CAN",
    },
]


def generate_weekly_schedule(fert_n: float, fert_p: float, fert_k: float) -> List[Dict[str, Any]]:
    """
    Computes exact stage doses and daily fertigation split without negative topups.
    """
    schedule_items = []
    
    for stage in STAGES_SPLIT:
        target_n = round(fert_n * stage["n_pct"], 2)
        target_p = round(fert_p * stage["p_pct"], 2)
        target_k = round(fert_k * stage["k_pct"], 2)
        duration = stage["duration_days"]
        
        # Calculate primary carrier quantities
        p_name = stage["primary_product"]
        fn, fp, fk = FERTILIZER_CATALOG[p_name]
        
        # If stage needs P, size primary carrier by P
        if target_p > 0 and fp > 0:
            qty_primary = round(target_p / fp, 2)
        elif target_k > 0 and fk > 0:
            qty_primary = round(target_k / fk, 2)
        else:
            qty_primary = round(target_n / max(0.01, fn), 2)
            
        supplied_n = round(qty_primary * fn, 2)
        supplied_p = round(qty_primary * fp, 2)
        supplied_k = round(qty_primary * fk, 2)
        
        needed_n = max(0.0, round(target_n - supplied_n, 2))
        needed_k = max(0.0, round(target_k - supplied_k, 2))
        
        products = [
            {"product": p_name, "total_kg_acre": qty_primary, "daily_dose_g": round((qty_primary * 1000) / duration, 1)}
        ]
        
        if needed_n > 0:
            top_n = stage["topup_n"]
            t_fn = FERTILIZER_CATALOG[top_n][0]
            top_qty = round(needed_n / t_fn, 2)
            products.append({"product": top_n, "total_kg_acre": top_qty, "daily_dose_g": round((top_qty * 1000) / duration, 1)})
            
        if needed_k > 0 and p_name not in ("MOP", "SOP"):
            top_k = "SOP"
            t_fk = FERTILIZER_CATALOG[top_k][2]
            top_k_qty = round(needed_k / t_fk, 2)
            products.append({"product": top_k, "total_kg_acre": top_k_qty, "daily_dose_g": round((top_k_qty * 1000) / duration, 1)})

        dose_summary_parts = [f"{p['product']}: {p['daily_dose_g']} g/acre/day" for p in products]
        dose_label = ", ".join(dose_summary_parts)

        schedule_items.append({
            "stage_name": stage["stage_name"],
            "days_range": stage["days_range"],
            "duration_days": duration,
            "target_n_kg_acre": target_n,
            "target_p_kg_acre": target_p,
            "target_k_kg_acre": target_k,
            "fertilizers_recommended": products,
            "dose_per_day": dose_label,
            "status": "Matched",
        })
        
    return schedule_items
