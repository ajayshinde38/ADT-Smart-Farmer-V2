from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import date


class VegetationIndices(BaseModel):
    ndvi: Optional[float] = Field(None, description="Normalized Difference Vegetation Index (-1.0 to 1.0)")
    evi: Optional[float] = Field(None, description="Enhanced Vegetation Index")
    ndre: Optional[float] = Field(None, description="Red Edge NDVI (chlorophyll indicator)")
    msavi: Optional[float] = Field(None, description="Modified Soil Adjusted Vegetation Index")
    ndmi: Optional[float] = Field(None, description="Normalized Difference Moisture Index")
    ndwi: Optional[float] = Field(None, description="Normalized Difference Water Index")
    capture_date: Optional[date] = None
    cloud_coverage_pct: Optional[float] = None


class CropHealthClassification(BaseModel):
    status: str = Field(..., description="NDVI greenness band, not a confirmed crop-health diagnosis")
    health_score: int = Field(..., description="Legacy 0–100 NDVI heuristic; uncalibrated, not a health probability; 0 is a placeholder when no observation exists")
    color_hex: str = "#22c55e"
    recommendation: str


class GeoJSONGeometry(BaseModel):
    type: str = "Polygon"
    coordinates: List[List[List[float]]]


class RasterOverlayInfo(BaseModel):
    is_available: bool = False
    scene_id: Optional[str] = None
    acquisition_date: Optional[str] = None
    resolution_meters: Optional[float] = None
    bounds: Optional[List[List[float]]] = None  # [[south, west], [north, east]]
    overlay_urls: Optional[Dict[str, str]] = None
    geotiff_path: Optional[str] = None


class GISPlotResponse(BaseModel):
    farm_id: UUID
    farmer_id: UUID
    farmer_name: str
    latitude: float
    longitude: float
    area_acres: float
    geometry: Optional[GeoJSONGeometry] = None
    indices: VegetationIndices
    health: CropHealthClassification
    raster: Optional[RasterOverlayInfo] = None
    field_context: Optional[Dict[str, Any]] = None

