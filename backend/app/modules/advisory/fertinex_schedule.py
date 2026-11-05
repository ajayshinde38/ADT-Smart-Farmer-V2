"""
FertiNex Complete Fertigation Schedule Engine
============================================
Implements the official KVK DAP-based fertigation schedule directly from 'Fertigation.xlsx'
and the scientific model in 'backend_django' (FertiNex Fertigation Model).

Core Features:
1. Direct Excel loader with caching from 'backend/app/modules/advisory/Fertigation.xlsx':
   - Sheet '6.0 - 8.2': Standard / Normal / Slightly Alkaline soil schedule
   - Sheet '8.3 - 8.9': High Alkalinity soil schedule
2. Crop Season DAP Cutoff:
   - Adsali: up to 450 DAP
   - Pre-Seasonal: up to 420 DAP
   - Suru: up to 360 DAP
3. STCR Targeted Yield & Bounded STCR Rule:
   - MPKV Rahuri calibration
   - 80% STCR clamped within ±20% of Crop Season Standard
4. Dynamic Nutrient Balancing (Least-Squares Optimization):
   - Solves for optimal scaling factors across upcoming doses
   - Applied Till Date + Advised Upcoming = Bounded STCR Target
5. Farm Acreage Scaling:
   - Product quantities and drip water volumes scale by farm area in acres
6. Sequential 3-Dose Farmer Window:
   - Displays up to 2 previous applied doses + 1 current upcoming active dose
   - Tracks compliance: marking dose as applied unlocks subsequent doses
"""

from __future__ import annotations

import os
import re
import math
import hashlib
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Tuple, Optional
from pathlib import Path
import numpy as np

from app.modules.advisory import compliance

HA_TO_ACRE = 2.47105

# Default seasonal benchmarks (kg/acre)
SEASON_STANDARDS: Dict[str, Dict[str, Any]] = {
    "adsali": {
        "expected_yield_ton_per_ha": 250,
        "standard_n_kg_per_ha": 400.0,
        "standard_p_kg_per_ha": 170.0,
        "standard_k_kg_per_ha": 170.0,
        "standard_n_kg_per_acre": 160.0,
        "standard_p_kg_per_acre": 68.0,
        "standard_k_kg_per_acre": 68.0,
        "max_dap": 450,
    },
    "pre-seasonal": {
        "expected_yield_ton_per_ha": 220,
        "standard_n_kg_per_ha": 340.0,
        "standard_p_kg_per_ha": 170.0,
        "standard_k_kg_per_ha": 170.0,
        "standard_n_kg_per_acre": 136.0,
        "standard_p_kg_per_acre": 68.0,
        "standard_k_kg_per_acre": 68.0,
        "max_dap": 420,
    },
    "suru": {
        "expected_yield_ton_per_ha": 200,
        "standard_n_kg_per_ha": 250.0,
        "standard_p_kg_per_ha": 115.0,
        "standard_k_kg_per_ha": 115.0,
        "standard_n_kg_per_acre": 100.0,
        "standard_p_kg_per_acre": 46.0,
        "standard_k_kg_per_acre": 46.0,
        "max_dap": 360,
    },
}

_SEASON_DAP_LIMITS: Dict[str, int] = {
    "adsali": 450,
    "pre-seasonal": 420,
    "preseasonal": 420,
    "suru": 360,
    "seasonal": 360,
}

_FERTILIZER_NUTRIENTS: Dict[str, Tuple[float, float, float]] = {
    # NPK Grades (% N, % P2O5, % K2O)
    "09::24::24": (9.0, 24.0, 24.0),
    "9::24::24": (9.0, 24.0, 24.0),
    "09:24:24": (9.0, 24.0, 24.0),
    "9:24:24": (9.0, 24.0, 24.0),
    "10::26::26": (10.0, 26.0, 26.0),
    "10:26:26": (10.0, 26.0, 26.0),
    "12::61::00": (12.0, 61.0, 0.0),
    "12:61:00": (12.0, 61.0, 0.0),
    "13::00::45": (13.0, 0.0, 45.0),
    "13:00:45": (13.0, 0.0, 45.0),
    "24::24::00": (24.0, 24.0, 0.0),
    "24:24:00": (24.0, 24.0, 0.0),

    # Straight & Specialty Fertilizers
    "urea": (46.0, 0.0, 0.0),
    "ammonium sulphate": (20.6, 0.0, 0.0),
    "muriate of potash": (0.0, 0.0, 60.0),
    "sulphate of potash": (0.0, 0.0, 50.0),
    "calcium nitrate": (15.5, 0.0, 0.0),
    "daiammonium phosphate": (18.0, 46.0, 0.0),
    "diammonium phosphate": (18.0, 46.0, 0.0),
    "dap": (18.0, 46.0, 0.0),
    "phosphoric acid": (0.0, 52.0, 0.0),
    "poly sulphate": (0.0, 0.0, 14.0),

    # Organics & Amendments
    "neem cake": (5.0, 1.0, 2.0),
    "organic manure": (0.5, 0.2, 0.5),
    "prome": (0.4, 10.4, 0.0),
    "promo": (0.4, 10.4, 0.0),
}

_CACHED_EXCEL_SCHEDULES: Optional[Dict[str, List[Dict[str, Any]]]] = None


def _load_excel_schedules() -> Dict[str, List[Dict[str, Any]]]:
    """Reads Fertigation.xlsx and builds the schedule table."""
    global _CACHED_EXCEL_SCHEDULES
    if _CACHED_EXCEL_SCHEDULES is not None:
        return _CACHED_EXCEL_SCHEDULES

    search_paths = [
        Path(__file__).parent / "Fertigation.xlsx",
        Path(__file__).parent / "Fertigation .xlsx",
        Path("backend/app/modules/advisory/Fertigation.xlsx"),
        Path("Fertigation.xlsx"),
        Path(r"C:\Users\ADT AI\Downloads\FertiNex\Fertigation Model\backend_django\Fertigation .xlsx"),
    ]

    excel_file = None
    for p in search_paths:
        if p.exists():
            excel_file = p
            break

    if not excel_file:
        return _get_fallback_schedules()

    try:
        import openpyxl
        wb = openpyxl.load_workbook(excel_file, data_only=True)
        schedules: Dict[str, List[Dict[str, Any]]] = {}

        for sheet_name in wb.sheetnames:
            sheet = wb[sheet_name]
            entries: List[Dict[str, Any]] = []
            cur_dap = 0
            for r in range(2, sheet.max_row + 1):
                dap_cell = sheet.cell(r, 1).value
                fert_cell = sheet.cell(r, 2).value
                qty_cell = sheet.cell(r, 3).value
                unit_cell = sheet.cell(r, 4).value
                water_cell = sheet.cell(r, 5).value

                if not fert_cell and not qty_cell:
                    continue

                if dap_cell is not None:
                    dap_str = str(dap_cell).strip()
                    m = re.search(r"\d+", dap_str)
                    if m:
                        cur_dap = int(m.group(0))

                try:
                    qty = float(qty_cell) if qty_cell is not None else 0.0
                except (ValueError, TypeError):
                    qty = 0.0

                try:
                    water = float(water_cell) if water_cell is not None else None
                except (ValueError, TypeError):
                    water = None

                raw_name = str(fert_cell or "").strip()
                norm_name = re.sub(r":{2,}", ":", raw_name)

                entries.append({
                    "dap": cur_dap,
                    "fertilizer": norm_name,
                    "quantity": qty,
                    "unit": str(unit_cell or "kg").strip(),
                    "water": water,
                })

            clean_key = "8.3-8.9" if "8.3" in sheet_name else "6.0-8.2"
            schedules[clean_key] = entries

        _CACHED_EXCEL_SCHEDULES = schedules
        return schedules
    except Exception:
        return _get_fallback_schedules()


def _get_fallback_schedules() -> Dict[str, List[Dict[str, Any]]]:
    from app.modules.advisory import fertinex
    ref = getattr(fertinex, "REFERENCE", {})
    return {
        "6.0-8.2": ref.get("_SCHEDULE_PH_LOW", []),
        "8.3-8.9": ref.get("_SCHEDULE_PH_HIGH", []),
    }


def safe_float(val: Any, default: float = 0.0) -> float:
    if val is None:
        return default
    try:
        if isinstance(val, str):
            val = val.strip()
            if not val or val.lower() in ("null", "none", "nan", "n/a", "-"):
                return default
        f = float(val)
        return default if math.isnan(f) else f
    except (ValueError, TypeError):
        return default


def _calculate_product_npk(fert_name: str, qty: float, unit: str) -> Tuple[float, float, float]:
    """Calculates kilograms of elemental N, P2O5, K2O delivered by a product quantity."""
    if not qty or qty <= 0:
        return 0.0, 0.0, 0.0

    unit_clean = str(unit or "").strip().lower()
    conversion_factor = 0.001 if unit_clean in ("gm", "g", "ml") else 1.0
    qty_kg = float(qty) * conversion_factor

    name_clean = str(fert_name or "").strip().lower()
    percentages = _FERTILIZER_NUTRIENTS.get(name_clean)

    if not percentages:
        match = re.match(r"(\d+)[:\.\-]+(\d+)[:\.\-]+(\d+)", name_clean)
        if match:
            percentages = (float(match.group(1)), float(match.group(2)), float(match.group(3)))
        else:
            percentages = (0.0, 0.0, 0.0)

    n_kg = qty_kg * (percentages[0] / 100.0)
    p_kg = qty_kg * (percentages[1] / 100.0)
    k_kg = qty_kg * (percentages[2] / 100.0)
    return n_kg, p_kg, k_kg


def calculate_organic_manure(oc_value: Any) -> float:
    oc_val = safe_float(oc_value, 0.5)
    bracket_index = math.floor((oc_val - 0.1) / 0.1 + 1e-9)
    om_value = 28 - bracket_index
    return round(float(om_value), 2)


def calculate_stcr(oc: Any, n: Any, p: Any, k: Any, season: Any = "Adsali") -> Dict[str, Any]:
    oc_clean = safe_float(oc, 0.5)
    n_clean = safe_float(n, 100.0)
    p_clean = safe_float(p, 10.0)
    k_clean = safe_float(k, 300.0)

    season_str = str(season or "").strip().lower()
    if "adsali" in season_str or "आडसाली" in season_str:
        season_std = SEASON_STANDARDS["adsali"]
    elif "suru" in season_str or "सुरू" in season_str or "seasonal" in season_str:
        season_std = SEASON_STANDARDS["suru"]
    else:
        season_std = SEASON_STANDARDS["pre-seasonal"]

    expected_yield = season_std["expected_yield_ton_per_ha"]
    organic_manure = calculate_organic_manure(oc_clean)
    organic_manure_ton_per_acre = round(organic_manure / 2.5, 2)

    stcr_n_ha = (4.03 * expected_yield) - (1.43 * n_clean) - (3.81 * organic_manure)
    stcr_p_ha = (1.23 * expected_yield) - (2.44 * p_clean) - (1.83 * organic_manure)
    stcr_k_ha = (2.26 * expected_yield) - (0.55 * k_clean) - (1.40 * organic_manure)

    stcr_n_acre = stcr_n_ha / HA_TO_ACRE
    stcr_p_acre = stcr_p_ha / HA_TO_ACRE
    stcr_k_acre = stcr_k_ha / HA_TO_ACRE

    return {
        "organic_manure_ton_per_ha": organic_manure,
        "organic_manure_ton_per_acre": organic_manure_ton_per_acre,
        "expected_yield_ton_per_ha": expected_yield,
        "stcr_n_kg_per_ha": round(stcr_n_ha, 2),
        "stcr_p_kg_per_ha": round(stcr_p_ha, 2),
        "stcr_k_kg_per_ha": round(stcr_k_ha, 2),
        "stcr_n_kg_per_acre": round(stcr_n_acre, 2),
        "stcr_p_kg_per_acre": round(stcr_p_acre, 2),
        "stcr_k_kg_per_acre": round(stcr_k_acre, 2),
    }


def compute_bounded_stcr(farm: Dict[str, Any]) -> Dict[str, Any]:
    soil = farm.get("soil") or farm.get("soil_parameters") or {}
    oc = safe_float(soil.get("oc") if soil.get("oc") is not None else soil.get("OC"), 0.5)
    n = safe_float(soil.get("nitrogen_kg_ha") if soil.get("nitrogen_kg_ha") is not None else soil.get("N"), 100.0)
    p = safe_float(soil.get("phosphorus_kg_ha") if soil.get("phosphorus_kg_ha") is not None else soil.get("P"), 10.0)
    k = safe_float(soil.get("potassium_kg_ha") if soil.get("potassium_kg_ha") is not None else soil.get("K"), 300.0)

    season_val = farm.get("crop_season") or farm.get("season", "Adsali")
    stcr = calculate_stcr(oc, n, p, k, season_val)

    s_str = str(season_val or "").strip().lower()
    if "adsali" in s_str or "आडसाली" in s_str:
        std = SEASON_STANDARDS["adsali"]
    elif "suru" in s_str or "सुरू" in s_str or "seasonal" in s_str:
        std = SEASON_STANDARDS["suru"]
    else:
        std = SEASON_STANDARDS["pre-seasonal"]

    std_n, std_p, std_k = std["standard_n_kg_per_acre"], std["standard_p_kg_per_acre"], std["standard_k_kg_per_acre"]

    raw_80_n = 0.80 * stcr["stcr_n_kg_per_acre"]
    raw_80_p = 0.80 * stcr["stcr_p_kg_per_acre"]
    raw_80_k = 0.80 * stcr["stcr_k_kg_per_acre"]

    bounded_n = round(max(0.80 * std_n, min(1.20 * std_n, raw_80_n)), 2)
    bounded_p = round(max(0.80 * std_p, min(1.20 * std_p, raw_80_p)), 2)
    bounded_k = round(max(0.80 * std_k, min(1.20 * std_k, raw_80_k)), 2)

    area = safe_float(farm.get("area_acre") or farm.get("area_acres") or farm.get("area"), 1.0)
    if area <= 0:
        area = 1.0

    return {
        "stcr_raw": stcr,
        "standard_season_npk": {"N": std_n, "P": std_p, "K": std_k},
        "bounded_target_kg_acre": {"N": bounded_n, "P": bounded_p, "K": bounded_k},
        "farm_bounded_target_kg": {
            "N": round(bounded_n * area, 2),
            "P": round(bounded_p * area, 2),
            "K": round(bounded_k * area, 2),
        },
        "area_acre": area,
        "crop_season": s_str,
    }


def _detect_season_key(season_value: Any, p_date: Optional[date] = None) -> str:
    s = str(season_value or "").strip().lower()
    if "adsali" in s or "आडसाली" in s:
        return "adsali"
    if "pre" in s or "preseasonal" in s or "पूर्वहंगामी" in s:
        return "pre-seasonal"
    if "suru" in s or "seasonal" in s or "सुरू" in s or "हंगामी" in s:
        return "suru"
    if p_date:
        m = p_date.month
        if 6 <= m <= 9:
            return "adsali"
        elif 10 <= m <= 11:
            return "pre-seasonal"
        else:
            return "suru"
    return "pre-seasonal"


def _parse_date(date_val: Any) -> Optional[date]:
    if not date_val:
        return None
    if isinstance(date_val, date):
        return date_val
    s = str(date_val).strip()
    for fmt in ("%Y-%m-%d", "%d-%b-%Y", "%d %b %Y", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def get_farm_fertigation_schedule(
    farm: Dict[str, Any],
    applied_till_date: Optional[Dict[str, float]] = None,
    login_dap: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Computes complete FertiNex fertigation schedule for a farm dictionary.
    Scales all fertilizer quantities, water liters, and NPK outputs by the farm's area in acres.
    Returns 2 previous doses + 1 upcoming active dose (farmer_periods) and the active dose banner data.
    """
    farm_id = str(farm.get("farm_id") or farm.get("id") or "")
    phone = str(farm.get("mobile") or farm.get("phone") or "")

    compliance_logs = {
        **compliance.get_compliance_for_farm(phone),
        **compliance.get_compliance_for_farm(farm_id),
    }

    soil = farm.get("soil") or farm.get("soil_parameters") or {}
    ph_val = safe_float(soil.get("ph") if soil.get("ph") is not None else soil.get("pH"), 7.5)

    plantation_date = farm.get("plantation_date") or farm.get("transplanted")
    p_date = _parse_date(plantation_date)
    today = date.today()

    season_val = farm.get("crop_season") or farm.get("season")
    season_key = _detect_season_key(season_val, p_date)
    max_dap = _SEASON_DAP_LIMITS.get(season_key, 420)

    area_acre = safe_float(farm.get("area_acre") or farm.get("area_acres") or farm.get("area"), 1.0)
    if area_acre <= 0:
        area_acre = 1.0

    days_since = (today - p_date).days if p_date else None
    current_dap = days_since

    schedules = _load_excel_schedules()
    sheet_key = "8.3-8.9" if ph_val > 8.2 else "6.0-8.2"
    base_schedule = schedules.get(sheet_key) or schedules.get("6.0-8.2") or []

    filtered = [e for e in base_schedule if e.get("dap", 0) <= max_dap]

    has_snapshot_dap = False
    if login_dap is None:
        login_snap = farm.get("initial_login_snapshot") or {}
        snap_dap = login_snap.get("login_dap")
        if snap_dap is not None:
            login_dap = int(snap_dap)
            has_snapshot_dap = True
    else:
        has_snapshot_dap = True

    sorted_daps = sorted(list(set(e.get("dap", 0) for e in filtered)))

    if has_snapshot_dap:
        split_dap = login_dap
        target_active_dap = None
    elif current_dap is not None and sorted_daps:
        upcoming_candidates = [d for d in sorted_daps if d >= current_dap]
        target_active_dap = upcoming_candidates[0] if upcoming_candidates else sorted_daps[-1]
        active_idx = sorted_daps.index(target_active_dap)
        # All doses prior to target_active_dap were due in the past
        split_dap = sorted_daps[active_idx - 1] if active_idx > 0 else -1
    else:
        split_dap = 103
        target_active_dap = None

    bounded_info = compute_bounded_stcr(farm)
    bounded_target = bounded_info["bounded_target_kg_acre"]

    if applied_till_date is None:
        source_applied = farm.get("applied_till_date") or soil.get("applied_till_date")
        if isinstance(source_applied, dict):
            applied_till_date = {
                "N": safe_float(source_applied.get("N")),
                "P": safe_float(source_applied.get("P") if source_applied.get("P") is not None else source_applied.get("P2O5")),
                "K": safe_float(source_applied.get("K") if source_applied.get("K") is not None else source_applied.get("K2O")),
            }
        elif has_snapshot_dap:
            applied_till_date = {"N": 46.0, "P": 24.0, "K": 16.0}
        else:
            cutoff = target_active_dap if target_active_dap is not None else (split_dap + 1)
            cum_n = sum(_calculate_product_npk(e["fertilizer"], e["quantity"], e["unit"])[0] for e in filtered if e.get("dap", 0) < cutoff)
            cum_p = sum(_calculate_product_npk(e["fertilizer"], e["quantity"], e["unit"])[1] for e in filtered if e.get("dap", 0) < cutoff)
            cum_k = sum(_calculate_product_npk(e["fertilizer"], e["quantity"], e["unit"])[2] for e in filtered if e.get("dap", 0) < cutoff)
            applied_till_date = {
                "N": round(cum_n, 1),
                "P": round(cum_p, 1),
                "K": round(cum_k, 1),
            }

    rem_target_n = max(0.0, bounded_target["N"] - applied_till_date["N"])
    rem_target_p = max(0.0, bounded_target["P"] - applied_till_date["P"])
    rem_target_k = max(0.0, bounded_target["K"] - applied_till_date["K"])

    base_upcoming_entries = [e for e in filtered if e["dap"] > split_dap]

    scale_n, scale_p, scale_k = 1.0, 1.0, 1.0
    if base_upcoming_entries:
        A = np.zeros((3, 3), dtype=float)
        for entry in base_upcoming_entries:
            pn, pp, pk = _calculate_product_npk(entry["fertilizer"], entry["quantity"], entry["unit"])
            if pn == 0.0 and pp == 0.0 and pk == 0.0:
                continue
            if pp > pn and pp >= pk:
                col = 1
            elif pk > pn and pk > pp:
                col = 2
            else:
                col = 0
            A[0, col] += pn
            A[1, col] += pp
            A[2, col] += pk

        b = np.array([rem_target_n, rem_target_p, rem_target_k], dtype=float)
        try:
            factors, _, _, _ = np.linalg.lstsq(A, b, rcond=None)
            factors = np.clip(factors, 0.05, 8.0)
            scale_n = float(factors[0])
            scale_p = float(factors[1])
            scale_k = float(factors[2])
        except Exception:
            scale_n, scale_p, scale_k = 1.0, 1.0, 1.0

    dap_groups: Dict[int, List[Dict[str, Any]]] = {}
    for entry in filtered:
        dap_groups.setdefault(entry["dap"], []).append(entry)

    application_groups: List[Dict[str, Any]] = []

    for dap_val in sorted(dap_groups.keys()):
        items = dap_groups[dap_val]
        is_upcoming_entry = (dap_val > split_dap)

        if p_date:
            app_date = p_date + timedelta(days=dap_val)
            app_date_str = app_date.strftime("%d-%b-%Y")
            start_date_str = (app_date - timedelta(days=2)).strftime("%d-%b-%Y")
            end_date_str = (app_date + timedelta(days=5)).strftime("%d-%b-%Y")
            days_remaining = (app_date - today).days

            if days_remaining > 0:
                status = "upcoming"
            elif days_remaining == 0:
                status = "due_today"
            elif days_remaining >= -7:
                status = "overdue"
            else:
                status = "completed"
        else:
            app_date_str = f"Day {dap_val}"
            start_date_str = app_date_str
            end_date_str = app_date_str
            days_remaining = 0
            status = "upcoming" if is_upcoming_entry else "completed"

        products = []
        rec_lines = []
        for entry in items:
            base_qty = float(entry["quantity"])
            unit_str = str(entry["unit"] or "").strip().lower()

            if is_upcoming_entry:
                n_pct, p_pct, k_pct = _calculate_product_npk(entry["fertilizer"], 100.0, "kg")
                if p_pct > n_pct and p_pct >= k_pct:
                    ratio = scale_p
                elif k_pct > n_pct and k_pct > p_pct:
                    ratio = scale_k
                elif n_pct > 0:
                    ratio = scale_n
                else:
                    ratio = 1.0
                scaled_qty = base_qty * ratio
            else:
                scaled_qty = base_qty

            if unit_str in ("gm", "ml"):
                qty_per_acre = round(scaled_qty)
            else:
                qty_per_acre = round(scaled_qty, 1)

            farm_qty = scaled_qty * area_acre
            if unit_str in ("gm", "ml"):
                qty_farm = round(farm_qty)
            else:
                qty_farm = round(farm_qty, 1)

            base_water = float(entry["water"]) if entry.get("water") is not None else None
            farm_water = round(base_water * area_acre) if base_water is not None else None

            products.append({
                "fertilizer": entry["fertilizer"],
                "quantity": qty_farm,
                "quantity_per_acre": qty_per_acre,
                "unit": entry["unit"],
                "water_liters": farm_water,
                "water_liters_per_acre": base_water,
            })

            line = f"{entry['fertilizer']}: {qty_farm} {entry['unit']}"
            if farm_water is not None and farm_water > 0:
                line += f" (Water: {farm_water} L)"
            rec_lines.append(line)

        recommendation_text = "\n".join(rec_lines)

        total_farm_n = sum(_calculate_product_npk(p["fertilizer"], p["quantity"], p["unit"])[0] for p in products)
        total_farm_p = sum(_calculate_product_npk(p["fertilizer"], p["quantity"], p["unit"])[1] for p in products)
        total_farm_k = sum(_calculate_product_npk(p["fertilizer"], p["quantity"], p["unit"])[2] for p in products)

        per_acre_n = total_farm_n / area_acre if area_acre > 0 else total_farm_n
        per_acre_p = total_farm_p / area_acre if area_acre > 0 else total_farm_p
        per_acre_k = total_farm_k / area_acre if area_acre > 0 else total_farm_k

        period_key = f"{dap_val} DAP"
        is_applied_logged = compliance_logs.get(period_key, {}).get("applied")
        if is_applied_logged is not None:
            applied = bool(is_applied_logged)
        elif has_snapshot_dap and is_upcoming_entry and dap_val == 110:
            applied = True
        elif not is_upcoming_entry:
            applied = True
        else:
            applied = False

        application_groups.append({
            "dap": dap_val,
            "period": period_key,
            "application_date": app_date_str,
            "start_date": start_date_str,
            "end_date": end_date_str,
            "days_remaining": days_remaining,
            "status": status,
            "recommendation_text": recommendation_text,
            "products": products,
            "target_n": round(total_farm_n, 1) if round(total_farm_n, 1) != int(round(total_farm_n)) else int(round(total_farm_n)),
            "target_p": round(total_farm_p, 1) if round(total_farm_p, 1) != int(round(total_farm_p)) else int(round(total_farm_p)),
            "target_k": round(total_farm_k, 1) if round(total_farm_k, 1) != int(round(total_farm_k)) else int(round(total_farm_k)),
            "farm_target_n": round(total_farm_n, 2),
            "farm_target_p": round(total_farm_p, 2),
            "farm_target_k": round(total_farm_k, 2),
            "target_n_per_acre": round(per_acre_n, 1) if round(per_acre_n, 1) != int(round(per_acre_n)) else int(round(per_acre_n)),
            "target_p_per_acre": round(per_acre_p, 1) if round(per_acre_p, 1) != int(round(per_acre_p)) else int(round(per_acre_p)),
            "target_k_per_acre": round(per_acre_k, 1) if round(per_acre_k, 1) != int(round(per_acre_k)) else int(round(per_acre_k)),
            "is_upcoming": is_upcoming_entry,
            "applied": applied,
        })

    if has_snapshot_dap:
        after_login_groups = [g for g in application_groups if g["dap"] > split_dap]
        if not after_login_groups:
            after_login_groups = application_groups
    else:
        after_login_groups = [g for g in application_groups if g["dap"] >= (target_active_dap if target_active_dap is not None else 0)]
        if not after_login_groups:
            after_login_groups = application_groups

    current_active_dose = None
    is_waiting_for_date = False
    active_idx_in_after = 0

    for idx, g in enumerate(after_login_groups):
        is_applied = bool(g.get("applied"))
        app_date = _parse_date(g.get("application_date")) or _parse_date(g.get("end_date"))
        has_date_passed = (today > app_date) if app_date else (g.get("days_remaining", 0) < 0)

        if not is_applied:
            # First unapplied dose: this is the active upcoming advisory
            current_active_dose = g
            is_waiting_for_date = False
            active_idx_in_after = idx
            break

        if not has_date_passed:
            # The dose has been marked as applied by the farmer,
            # BUT its advisory date has NOT passed yet!
            # The next advisory should ONLY be shown after the date of this advisory has passed!
            current_active_dose = g
            is_waiting_for_date = True
            active_idx_in_after = idx
            break

    if not current_active_dose and after_login_groups:
        current_active_dose = after_login_groups[-1]
        active_idx_in_after = len(after_login_groups) - 1

    current_active_dose["is_applied_waiting_for_date"] = is_waiting_for_date

    # Farmer periods: up to 2 previous doses + 1 active dose (never unlocking future doses beyond active_idx)
    if has_snapshot_dap:
        start_idx = max(0, active_idx_in_after - 2)
        farmer_periods = after_login_groups[start_idx : active_idx_in_after + 1]
    else:
        all_active_idx = next((i for i, g in enumerate(application_groups) if g["dap"] == current_active_dose["dap"]), 0)
        start_all_idx = max(0, all_active_idx - 2)
        farmer_periods = application_groups[start_all_idx : all_active_idx + 1]

    farm_applied_n = round(applied_till_date["N"] * area_acre)
    farm_applied_p = round(applied_till_date["P"] * area_acre)
    farm_applied_k = round(applied_till_date["K"] * area_acre)

    farm_target_n = round(bounded_target["N"] * area_acre)
    farm_target_p = round(bounded_target["P"] * area_acre)
    farm_target_k = round(bounded_target["K"] * area_acre)

    season_display = {
        "adsali": "Adsali",
        "pre-seasonal": "Pre-Seasonal",
        "suru": "Suru",
    }.get(season_key, season_key.title())

    return {
        "ph_range": "8.3–8.9 (Alkaline)" if ph_val > 8.2 else "6.0–8.2 (Normal/Slightly Alkaline)",
        "ph_sheet": sheet_key,
        "season": season_display,
        "season_key": season_key,
        "max_dap": max_dap,
        "plantation_date_str": p_date.strftime("%d-%b-%Y") if p_date else None,
        "current_dap": current_dap,
        "login_dap": split_dap,
        "area_acre": area_acre,
        "active_upcoming_dose": current_active_dose,
        "current_period": current_active_dose,
        "farmer_periods": farmer_periods,
        "application_groups": application_groups,
        "periods": application_groups,
        "applied_till_date": applied_till_date,
        "farm_applied_till_date": {
            "N": farm_applied_n,
            "P": farm_applied_p,
            "K": farm_applied_k,
        },
        "bounded_target_kg_acre": bounded_target,
        "farm_stcr_target_npk": {
            "N": farm_target_n,
            "P": farm_target_p,
            "K": farm_target_k,
        },
        "target_season_npk": bounded_info["standard_season_npk"],
        "compliance_logs": compliance_logs,
    }
