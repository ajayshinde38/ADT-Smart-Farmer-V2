from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from uuid import UUID


class ChemicalProduct(BaseModel):
    product_name: str
    active_ingredient: str
    dose_per_acre: str
    application_method: str = "Foliar Spray"


class ManagementPractice(BaseModel):
    category: str
    title: str
    title_mr: str
    items: List[str]
    items_mr: List[str]


class ChemicalReference(BaseModel):
    product: str
    dosage: str
    group: str
    verification_status: str = 'supplied_reference_not_label_verified'


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
    treatment: str = ''
    treatment_mr: str = ''
    management_practices: List[ManagementPractice] = []
    chemical_references: List[ChemicalReference] = []
    reference_note: str = ''
    reference_note_mr: str = ''


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
    record_id: Optional[UUID] = None
    record_saved: bool = False
    history_note: Optional[str] = None
    model_results: List[Dict[str,Any]] = []
    detected_diseases: List[str] = []
    decision_reason: Optional[str] = None
    fusion_policy: Optional[str] = None
