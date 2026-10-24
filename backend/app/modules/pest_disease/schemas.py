from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from uuid import UUID


class ChemicalProduct(BaseModel):
    product_name: str
    active_ingredient: str
    dose_per_acre: str
    application_method: str = "Foliar Spray"


class DiseaseDetail(BaseModel):
    disease_name: str
    marathi_name: str
    pathogen: str
    severity: str
    symptoms: str
    symptoms_mr: str
    causes: str
    causes_mr: str
    prevention: str
    prevention_mr: str
    chemical_control: str
    chemical_control_mr: str
    recommended_products: List[ChemicalProduct] = []


class DiseaseDetectionResponse(BaseModel):
    detected_disease: str
    marathi_name: str
    confidence_score: float
    affected_percentage: float
    severity_level: str
    disease_details: Optional[DiseaseDetail] = None
    status: str = "disease_detected"
    overlay_data_url: Optional[str] = None
    image_url: Optional[str] = None
    field_context: Optional[Dict[str, Any]] = None
