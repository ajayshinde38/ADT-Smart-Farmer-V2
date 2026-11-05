"""
Schedule Compliance Storage
===========================
Stores farmer dose application confirmations (e.g., '110 DAP': applied=True).
Persists to local JSON cache and supports in-memory fallback.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional

COMPLIANCE_FILE = Path(__file__).resolve().parent.parent.parent / ".cache" / "compliance.json"
COMPLIANCE_FILE.parent.mkdir(parents=True, exist_ok=True)

_MEMORY_COMPLIANCE: Dict[str, Dict[str, Any]] = {}


def _load_all() -> Dict[str, Dict[str, Any]]:
    global _MEMORY_COMPLIANCE
    if not COMPLIANCE_FILE.exists():
        return _MEMORY_COMPLIANCE
    try:
        text = COMPLIANCE_FILE.read_text(encoding="utf-8")
        data = json.loads(text) if text.strip() else {}
        _MEMORY_COMPLIANCE = data
        return data
    except Exception:
        return _MEMORY_COMPLIANCE


def _save_all(data: Dict[str, Dict[str, Any]]) -> None:
    global _MEMORY_COMPLIANCE
    _MEMORY_COMPLIANCE = data
    try:
        COMPLIANCE_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")
    except Exception:
        pass


def get_compliance_for_farm(farm_or_phone: str) -> Dict[str, Any]:
    all_data = _load_all()
    key = str(farm_or_phone).strip()
    return all_data.get(key, {})


def set_compliance_dose(
    farm_or_phone: str,
    period: str,
    applied: bool,
    notes: Optional[str] = None
) -> Dict[str, Any]:
    all_data = _load_all()
    key = str(farm_or_phone).strip()
    farm_logs = all_data.setdefault(key, {})

    record = {
        "period": period,
        "applied": bool(applied),
        "notes": notes or ("Applied by farmer" if applied else "Cancelled"),
        "logged_at": datetime.utcnow().isoformat(),
    }
    farm_logs[period] = record
    _save_all(all_data)
    return record

