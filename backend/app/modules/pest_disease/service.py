from typing import Dict, Any, List, Optional
from uuid import UUID
from threading import Lock

_INFERENCE_LOCK = Lock()

from app.modules.pest_disease.schemas import DiseaseDetectionResponse, DiseaseDetail, ChemicalProduct
from app.modules.pest_disease.practices import DISEASE_CATALOG
from app.modules.pest_disease import unet_classifier


def get_all_diseases() -> List[DiseaseDetail]:
    return list(DISEASE_CATALOG.values())


def get_disease_by_name(name: str) -> Optional[DiseaseDetail]:
    return DISEASE_CATALOG.get(name)


def diagnose_leaf_image(image_bytes: bytes) -> DiseaseDetectionResponse:
    """
    Direct internal Python function to diagnose disease from uploaded crop leaf image.
    Executes UNet segmentation and returns treatment recommendations.
    """
    with _INFERENCE_LOCK:
        result = unet_classifier.run_inference(image_bytes)
    disease_name = result["disease"]
    
    details = DISEASE_CATALOG.get(disease_name)
    
    return DiseaseDetectionResponse(
        detected_disease=disease_name,
        marathi_name=details.marathi_name if details else "समर्थित रोग आढळला नाही",
        status=result.get("status", "uncertain"),
        overlay_data_url=result.get("overlay_data_url"),
        confidence_score=result["confidence"],
        affected_percentage=result["affected_percent"],
        severity_level=result["severity"],
        disease_details=details,
        image_url=None
    )
