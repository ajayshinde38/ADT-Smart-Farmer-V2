import pytest
from datetime import date, timedelta
from app.modules.advisory.fertinex_schedule import get_farm_fertigation_schedule, compute_bounded_stcr
from app.modules.advisory import compliance


def test_rohit_ramgonda_exact_numbers():
    """Validates exact figures against agronomist KVK Fertigation guide for 2.05 acres."""
    farmer = {
        "farm_id": "rohit-test-id",
        "name": "Rohit Ramgonda Patil",
        "mobile": "7588621575",
        "area_acre": 2.05,
        "crop_season": "Adsali",
        "plantation_date": "2026-07-10",
        "initial_login_snapshot": {"login_dap": 103},
        "soil": {
            "ph": 7.6,
            "oc": 0.6,
            "nitrogen_kg_ha": 161,
            "phosphorus_kg_ha": 24,
            "potassium_kg_ha": 233,
            "applied_till_date": {"N": 46.0, "P": 24.0, "K": 16.0},
        },
    }
    # Clear any previous test compliance for this id
    compliance.set_compliance_dose("rohit-test-id", "110 DAP", applied=True)

    sched = get_farm_fertigation_schedule(farmer)
    active = sched["active_upcoming_dose"]
    assert active["period"] == "120 DAP"
    assert active["application_date"] == "07-Nov-2026"
    assert "Ammonium Sulphate: 142.5 kg" in active["recommendation_text"] or "Ammonium Sulphate: 142.6 kg" in active["recommendation_text"]
    assert "09:24:24:" in active["recommendation_text"]
    assert "Muriate of Potash: 64.2 kg" in active["recommendation_text"] or "Muriate of Potash: 64.5 kg" in active["recommendation_text"]
    assert "Poly Sulphate: 64.2 kg" in active["recommendation_text"] or "Poly Sulphate: 64.5 kg" in active["recommendation_text"]
    assert "Fertera: 8.2 kg" in active["recommendation_text"]

    # Applied till date scaled
    applied = sched["farm_applied_till_date"]
    assert applied["N"] == round(46 * 2.05)  # 94
    assert applied["P"] == round(24 * 2.05)  # 49
    assert applied["K"] == round(16 * 2.05)  # 33

    # Farmer periods: shows 110 DAP (applied) and 120 DAP (upcoming active)
    periods = sched["farmer_periods"]
    assert len(periods) >= 2
    daps = [p["dap"] for p in periods]
    assert 110 in daps
    assert 120 in daps


def test_area_scaling_direct_proportionality():
    """Validates that fertilizer quantities scale directly with acreage."""
    base_farmer = {
        "farm_id": "scale-test-1",
        "name": "Scale Farmer",
        "area_acre": 1.0,
        "crop_season": "Adsali",
        "plantation_date": "2026-07-10",
        "soil": {"ph": 7.5, "oc": 0.5, "nitrogen_kg_ha": 100, "phosphorus_kg_ha": 10, "potassium_kg_ha": 300},
    }
    double_farmer = {
        **base_farmer,
        "farm_id": "scale-test-2",
        "area_acre": 2.0,
    }

    s1 = get_farm_fertigation_schedule(base_farmer)
    s2 = get_farm_fertigation_schedule(double_farmer)

    # Fertera at 120 DAP is 4 kg per acre
    f1_dose = [g for g in s1["application_groups"] if g["dap"] == 120][0]
    f2_dose = [g for g in s2["application_groups"] if g["dap"] == 120][0]

    fertera1 = [p for p in f1_dose["products"] if p["fertilizer"] == "Fertera"][0]
    fertera2 = [p for p in f2_dose["products"] if p["fertilizer"] == "Fertera"][0]

    assert fertera1["quantity"] == 4.0
    assert fertera2["quantity"] == 8.0

