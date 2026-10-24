"""
Rule Registry for Approved Sugarcane Pest & Disease Rules
Source of Truth: 'final A_B grade.xlsx' (Sheets: Pest_Table, Daily_Predictor, Changes_Log)

Contains exclusively the 8 approved Grade A and B rules.
All 22 Grade C (unverified/rejected) rules are strictly excluded.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("advisory.rules")

APPROVED_RULE_IDS = ["D7", "P4", "D2", "D4", "D1", "P2", "D3", "P7"]
APPROVED_RULE_SR_NOS = [1, 3, 5, 8, 9, 17, 18, 23]

# Stage phenological susceptibility windows based on approved workbook
STAGE_SUSCEPTIBILITY_MAP: Dict[str, Dict[str, Any]] = {
    "D7": {
        "name": "Sett Rot / Pineapple Disease",
        "stages": ["Sprouting", "Germination"],
        "min_days": 0,
        "max_days": 60,
        "description": "Susceptible during sett establishment and early sprouting (0-60 days)."
    },
    "P4": {
        "name": "White Grub",
        "stages": ["Sprouting", "Germination", "Tillering"],
        "min_days": 0,
        "max_days": 120,
        "description": "Susceptible during sprouting and tillering stages (0-120 days)."
    },
    "D2": {
        "name": "Brown Rust",
        "stages": ["Stem elongation", "Grand Growth", "Development"],
        "min_days": 120,
        "max_days": 270,
        "description": "Susceptible during stem elongation and rapid canopy development (120-270 days)."
    },
    "D4": {
        "name": "Whiplash Smut",
        "stages": ["Tillering", "Stem elongation", "Grand Growth", "Development"],
        "min_days": 60,
        "max_days": 270,
        "description": "Susceptible from tillering through grand growth / development (60-270 days)."
    },
    "D1": {
        "name": "Pokkah Boeng",
        "stages": ["Tillering", "Stem elongation", "Grand Growth", "Development"],
        "min_days": 60,
        "max_days": 270,
        "description": "Susceptible from tillering through grand growth / development (60-270 days)."
    },
    "P2": {
        "name": "Top Shoot Borer",
        "stages": ["Tillering", "Stem elongation", "Grand Growth", "Development"],
        "min_days": 60,
        "max_days": 270,
        "description": "Susceptible from tillering through grand growth / development (60-270 days)."
    },
    "D3": {
        "name": "Red Rot",
        "stages": ["Tillering", "Stem elongation", "Grand Growth", "Development", "Maturity", "Harvest"],
        "min_days": 60,
        "max_days": 400,
        "description": "Susceptible from tillering through maturity and harvest (60-360+ days)."
    },
    "P7": {
        "name": "Mealybug",
        "stages": ["Stem elongation", "Grand Growth", "Development", "Maturity", "Harvest"],
        "min_days": 120,
        "max_days": 400,
        "description": "Susceptible from stem elongation through maturity and harvest (120-360+ days)."
    },
}

_RULES_CACHE: Optional[List[Dict[str, Any]]] = None


def load_approved_rules() -> List[Dict[str, Any]]:
    """Loads the 8 approved rules from the authoritative JSON file."""
    global _RULES_CACHE
    if _RULES_CACHE is not None:
        return _RULES_CACHE

    json_path = Path(__file__).resolve().parent / "data" / "disease_and_pest_rules.json"
    if not json_path.exists():
        raise FileNotFoundError(f"Authoritative rules file not found: {json_path}")

    with open(json_path, "r", encoding="utf-8") as f:
        raw_rules = json.load(f)

    # Strict enforcement: filter only approved Grade A and B rules
    approved = [
        r for r in raw_rules
        if r.get("id") in APPROVED_RULE_IDS or r.get("sr_no") in APPROVED_RULE_SR_NOS
    ]

    if len(approved) != 8:
        logger.warning("Expected exactly 8 approved rules, found %d", len(approved))

    _RULES_CACHE = approved
    return _RULES_CACHE


def get_rule_by_id(rule_id: str) -> Optional[Dict[str, Any]]:
    rules = load_approved_rules()
    for r in rules:
        if r.get("id") == rule_id:
            return r
    return None


def get_rule_by_sr_no(sr_no: int) -> Optional[Dict[str, Any]]:
    rules = load_approved_rules()
    for r in rules:
        if r.get("sr_no") == sr_no:
            return r
    return None


def get_rule_by_name(name: str) -> Optional[Dict[str, Any]]:
    rules = load_approved_rules()
    name_clean = name.strip().lower()
    for r in rules:
        r_name = r.get("name", "").strip().lower()
        if name_clean in r_name or r_name in name_clean:
            return r
    return None


def check_crop_stage_eligibility(
    rule_or_id: Any,
    current_stage: Optional[str] = None,
    crop_age_days: Optional[int] = None
) -> Tuple[Optional[bool], str, List[str]]:
    """
    Evaluates whether the crop is in a susceptible developmental stage.
    
    Returns:
        (is_eligible, status_message, susceptible_stages_list)
        is_eligible is:
            True: if confirmed within susceptible stage
            False: if confirmed outside susceptible stage
            None: if crop stage / age is unknown or unconfirmed
    """
    rule_id = rule_or_id.get("id") if isinstance(rule_or_id, dict) else str(rule_or_id)
    mapping = STAGE_SUSCEPTIBILITY_MAP.get(rule_id)
    if not mapping:
        return None, "Susceptible stages undefined for this rule", []

    susceptible_stages = mapping["stages"]

    if not current_stage and crop_age_days is None:
        return None, "Uncertain stage (planting date or stage unconfirmed)", susceptible_stages

    # 1. Check by explicit crop stage name
    if current_stage and current_stage.strip() and current_stage.strip().lower() not in ("unknown", "none"):
        c_clean = current_stage.strip().lower()
        matched = any(s.lower() in c_clean or c_clean in s.lower() for s in susceptible_stages)
        if matched:
            return True, f"Eligible ({current_stage} is within susceptible window)", susceptible_stages
        else:
            return False, "Outside specified susceptible stage", susceptible_stages

    # 2. Check by derived crop age in days
    if crop_age_days is not None:
        min_d = mapping["min_days"]
        max_d = mapping["max_days"]
        if min_d <= crop_age_days <= max_d:
            return True, f"Eligible (crop age {crop_age_days} days is within {min_d}–{max_d} days)", susceptible_stages
        else:
            return False, "Outside specified susceptible stage", susceptible_stages

    return None, "Uncertain stage", susceptible_stages
