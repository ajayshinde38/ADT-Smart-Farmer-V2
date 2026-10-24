"""
ADT Smart Farmer V2 - GIS Color Scale Module
Direct extraction from original GIS MapViewer.jsx.

PALETTE_VEG: 20 classes for vegetation indices (NDVI, EVI, NDRE, MSAVI, SAVI)
PALETTE_WATER: 20 classes for moisture/water indices (NDMI, NDWI)
Both scale over 20 equal classes from -1.0 to +1.0 (step size: 0.1).
"""

import math
from typing import Optional, List, Dict, Any, Tuple

# Original 20-class vegetation palette from MapViewer.jsx
PALETTE_VEG: Tuple[str, ...] = (
    '#660000', '#8B0000', '#B22222', '#CD5C5C', '#FF0000', '#FF4500',
    '#FF8C00', '#FFA500', '#FFD700', '#FFFF00', '#E8F48C', '#D4E157',
    '#AED581', '#81C784', '#4CAF50', '#43A047', '#388E3C', '#2E7D32',
    '#1B5E20', '#00FF00'
)

DESC_VEG: Tuple[str, ...] = (
    "Deep Water/Snow", "Water", "Clear Water", "Shallow Water", "Wet Soil",
    "Moist Bare Soil", "Bare Soil", "Dry Sand/Rock", "Sparse Vegetation",
    "Dead/Stressed Veg", "Very Low Veg", "Early Growth", "Low Veg",
    "Moderate-Low Veg", "Moderate Veg", "Moderate-High Veg", "High Veg",
    "Dense Canopy", "Very Dense Canopy", "Peak Bright Vegetation"
)

# Original 20-class moisture/water palette from MapViewer.jsx
PALETTE_WATER: Tuple[str, ...] = (
    '#8B0000', '#B22222', '#FF0000', '#FF4500', '#FF8C00', '#FFA500',
    '#FFD700', '#FFFF00', '#FAFAD2', '#E0F7FA', '#B2EBF2', '#80DEEA',
    '#4DD0E1', '#00BCD4', '#0097A7', '#1E90FF', '#4169E1', '#0000FF',
    '#0000CD', '#00008B'
)

DESC_WATER: Tuple[str, ...] = (
    "Dense Vegetation / Very Dry", "Moderate Vegetation", "Sparse Vegetation",
    "Dry Bare Soil", "Moist Bare Soil", "Slightly Moist", "Moist Soil",
    "Very Moist Soil", "Wet Surface", "Saturated Soil", "Shallow / Turbid Water",
    "Shallow Water", "Moderate Water", "Clear Shallow Water", "Deepening Water",
    "Deep Water", "Very Deep Water", "Open Water", "Deep Open Water",
    "Deepest Clear Water"
)

FALLBACK_COLOR = '#94a3b8'  # Neutral Slate Grey


def get_index_group(index_key: str) -> str:
    """Return 'water' for NDMI and NDWI, 'vegetation' for others."""
    k = (index_key or "").lower().strip()
    if k in ("ndmi", "ndwi"):
        return "water"
    return "vegetation"


def get_palette_for_index(index_key: str) -> Tuple[str, ...]:
    """Get the appropriate 20-color palette for the given index."""
    if get_index_group(index_key) == "water":
        return PALETTE_WATER
    return PALETTE_VEG


def get_descriptions_for_index(index_key: str) -> Tuple[str, ...]:
    """Get the appropriate 20 scientific descriptions for the given index."""
    if get_index_group(index_key) == "water":
        return DESC_WATER
    return DESC_VEG


def get_class_index(value: Optional[float], min_val: float = -1.0, max_val: float = 1.0) -> int:
    """
    Exact implementation of getClassIndex from original MapViewer.jsx:
    
    function getClassIndex(value, min, max) {
        if (value <= min) return 0;
        if (value >= max) return 19;
        const step = (max - min) / 20.0;
        const index = Math.floor((value - min) / step);
        return Math.min(19, Math.max(0, index));
    }
    
    Returns -1 for None, NaN, or non-finite numbers.
    """
    if value is None:
        return -1
    try:
        val = float(value)
    except (ValueError, TypeError):
        return -1

    if math.isnan(val) or not math.isfinite(val):
        return -1

    if val <= min_val:
        return 0
    if val >= max_val:
        return 19

    step = (max_val - min_val) / 20.0
    # Guard against IEEE-754 floating point imprecision (e.g. 0.09999999999999998 / 0.1 -> 0.9999999999999998)
    idx = math.floor(round((val - min_val) / step, 8))
    return max(0, min(19, idx))


def get_color_for_index(index_key: str, value: Optional[float], min_val: float = -1.0, max_val: float = 1.0) -> str:
    """Return the hex color from the original palette, or FALLBACK_COLOR if missing/invalid."""
    c_idx = get_class_index(value, min_val, max_val)
    if c_idx == -1:
        return FALLBACK_COLOR
    palette = get_palette_for_index(index_key)
    return palette[c_idx]


def get_description_for_value(index_key: str, value: Optional[float], min_val: float = -1.0, max_val: float = 1.0) -> str:
    """Return the scientific description for the value."""
    c_idx = get_class_index(value, min_val, max_val)
    if c_idx == -1:
        return "No Data / Unmeasured"
    descriptions = get_descriptions_for_index(index_key)
    return descriptions[c_idx]


def get_class_range(class_index: int, min_val: float = -1.0, max_val: float = 1.0) -> Tuple[float, float]:
    """Return the (low, high) boundary for a given class index."""
    idx = max(0, min(19, class_index))
    step = (max_val - min_val) / 20.0
    low = round(min_val + idx * step, 2)
    high = round(max_val if idx == 19 else (min_val + (idx + 1) * step), 2)
    return (low, high)
