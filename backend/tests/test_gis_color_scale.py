"""
Unit Tests for GIS Color Scale Utility (Task 7D)
Verifies:
1. Invalid/missing values (None, NaN, non-numeric strings)
2. Class boundaries (exact transitions at step = 0.1 over [-1.0, 1.0])
3. Negative values (-1.0, -0.95, -0.5, -0.1)
4. Zero (0.0 transitions to Class 10)
5. Maximum values (1.0, and out-of-range > 1.0 clamped to Class 19)
6. Minimum out-of-range (< -1.0 clamped to Class 0)
7. Index changes (Vegetation palette for NDVI/EVI/NDRE/MSAVI/SAVI vs Water palette for NDMI/NDWI)
8. Exact palette identity with original GIS MapViewer.jsx (2 palettes of 20 colors, NOT 6 separate palettes)
"""

import math
import pytest
from app.modules.gis.color_scale import (
    PALETTE_VEG,
    PALETTE_WATER,
    DESC_VEG,
    DESC_WATER,
    FALLBACK_COLOR,
    get_class_index,
    get_color_for_index,
    get_description_for_value,
    get_index_group,
    get_palette_for_index,
    get_class_range,
)


def test_palette_dimensions_and_hex_validity():
    """Verify there are exactly 2 palettes of 20 colors each."""
    assert len(PALETTE_VEG) == 20
    assert len(PALETTE_WATER) == 20
    assert len(DESC_VEG) == 20
    assert len(DESC_WATER) == 20

    # Ensure all colors are valid 7-character hex codes
    for c in PALETTE_VEG:
        assert c.startswith("#") and len(c) == 7
    for c in PALETTE_WATER:
        assert c.startswith("#") and len(c) == 7

    # Distinct palettes: vegetation ends in bright green (#00FF00), water ends in deep blue (#00008B)
    assert PALETTE_VEG[0] == '#660000'
    assert PALETTE_VEG[-1] == '#00FF00'
    assert PALETTE_WATER[0] == '#8B0000'
    assert PALETTE_WATER[-1] == '#00008B'


def test_invalid_and_missing_values():
    """Verify None, NaN, and invalid strings return -1 and FALLBACK_COLOR."""
    assert get_class_index(None) == -1
    assert get_class_index(float('nan')) == -1
    assert get_class_index("invalid") == -1  # type: ignore

    # Colors must be fallback
    assert get_color_for_index("ndvi", None) == FALLBACK_COLOR
    assert get_color_for_index("ndmi", None) == FALLBACK_COLOR
    assert get_color_for_index("ndvi", float('nan')) == FALLBACK_COLOR

    # Description must be No Data
    assert get_description_for_value("ndvi", None) == "No Data / Unmeasured"


def test_class_boundaries():
    """
    Over [-1.0, 1.0], step = 2.0 / 20 = 0.1:
    Class 0: [-1.0, -0.9)
    Class 1: [-0.9, -0.8)
    ...
    Class 9: [-0.1, 0.0)
    Class 10: [0.0, 0.1)
    Class 14: [0.4, 0.5)
    Class 19: [0.9, 1.0]
    """
    # Boundary at -1.0
    assert get_class_index(-1.0) == 0

    # Boundary at -0.9
    assert get_class_index(-0.90001) == 0
    assert get_class_index(-0.9) == 1

    # Boundary at -0.1
    assert get_class_index(-0.1) == 9

    # Boundary at 0.0
    assert get_class_index(0.0) == 10

    # Boundary at 0.1
    assert get_class_index(0.1) == 11

    # Boundary at 0.9
    assert get_class_index(0.9) == 19

    # Boundary at 1.0
    assert get_class_index(1.0) == 19


def test_negative_values():
    """Verify negative values map to the appropriate lower classes."""
    # -0.95 -> Class 0
    assert get_class_index(-0.95) == 0
    assert get_color_for_index("ndvi", -0.95) == PALETTE_VEG[0]

    # -0.5 -> floor((-0.5 - (-1.0))/0.1) = floor(0.5/0.1) = 5
    assert get_class_index(-0.5) == 5
    assert get_color_for_index("ndvi", -0.5) == PALETTE_VEG[5]

    # -0.2 -> floor(0.8/0.1) = 8
    assert get_class_index(-0.2) == 8


def test_zero_value():
    """Verify 0.0 maps exactly to Class 10 (the midpoint of [-1.0, 1.0])."""
    # floor((0.0 - (-1.0))/0.1) = floor(1.0/0.1) = 10
    assert get_class_index(0.0) == 10
    assert get_color_for_index("ndvi", 0.0) == PALETTE_VEG[10]
    assert get_color_for_index("ndmi", 0.0) == PALETTE_WATER[10]


def test_maximum_and_out_of_range():
    """Verify max values (1.0) and values exceeding max clamp cleanly to Class 19."""
    assert get_class_index(1.0) == 19
    assert get_class_index(1.05) == 19
    assert get_class_index(999.0) == 19

    assert get_color_for_index("ndvi", 1.0) == PALETTE_VEG[19]
    assert get_color_for_index("ndvi", 2.0) == PALETTE_VEG[19]

    # Values below minimum clamp cleanly to Class 0
    assert get_class_index(-1.05) == 0
    assert get_class_index(-50.0) == 0
    assert get_color_for_index("ndvi", -5.0) == PALETTE_VEG[0]


def test_index_changes():
    """Verify index changes toggle between PALETTE_VEG and PALETTE_WATER."""
    val = 0.45  # In Class 14: [0.4, 0.5)
    c_idx = get_class_index(val)
    assert c_idx == 14

    # Vegetation indices must all use PALETTE_VEG
    for veg_key in ["ndvi", "evi", "ndre", "msavi", "savi", "NDVI", "EVI"]:
        assert get_index_group(veg_key) == "vegetation"
        assert get_color_for_index(veg_key, val) == PALETTE_VEG[14]
        assert get_color_for_index(veg_key, val) == "#4CAF50"  # Original GIS green

    # Water & Moisture indices must all use PALETTE_WATER
    for water_key in ["ndmi", "ndwi", "NDMI", "NDWI"]:
        assert get_index_group(water_key) == "water"
        assert get_color_for_index(water_key, val) == PALETTE_WATER[14]
        assert get_color_for_index(water_key, val) == "#0097A7"  # Original GIS cyan/teal

    # The colors for the same index value MUST differ between vegetation and water groups
    assert get_color_for_index("ndvi", val) != get_color_for_index("ndmi", val)


def test_canonical_farm_values():
    """
    Verify real Supabase farmers:
    - Dhondiba Dakhore: NDVI = 0.449 -> Class 14 (#4CAF50, Moderate Veg)
    - Rajaram Lokewar: NDVI = 0.674 -> Class 16 (#388E3C, High Veg)
    """
    # Dhondiba (NDVI 0.449)
    dhondiba_c = get_class_index(0.449)
    assert dhondiba_c == 14
    assert get_color_for_index("ndvi", 0.449) == "#4CAF50"
    assert "Moderate Veg" in get_description_for_value("ndvi", 0.449)

    # Rajaram (NDVI 0.674)
    rajaram_c = get_class_index(0.674)
    assert rajaram_c == 16
    assert get_color_for_index("ndvi", 0.674) == "#388E3C"
    assert "High Veg" in get_description_for_value("ndvi", 0.674)


def test_get_class_range():
    """Verify range computation for individual classes."""
    low0, high0 = get_class_range(0)
    assert low0 == -1.0 and high0 == -0.9

    low10, high10 = get_class_range(10)
    assert low10 == 0.0 and high10 == 0.1

    low19, high19 = get_class_range(19)
    assert low19 == 0.9 and high19 == 1.0
