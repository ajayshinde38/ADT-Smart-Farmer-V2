import os
import logging
import httpx
from datetime import date, timedelta
from typing import Dict, Any, Optional
from app.core.config import settings
from app.modules.gis.schemas import CropHealthClassification

logger = logging.getLogger(__name__)

CDSE_TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"
CDSE_PROCESS_URL = "https://sh.dataspace.copernicus.eu/api/v1/process"


def get_s2_evalscript() -> str:
    """Evaluates Sentinel-2 L2A optical bands into 6 agricultural indices."""
    return """
    //VERSION=3
    function setup() {
        return {
            input: ["B02", "B03", "B04", "B05", "B08", "B11", "dataMask", "SCL"],
            output: [
                { id: "NDVI", bands: 1, sampleType: "FLOAT32" }, 
                { id: "EVI", bands: 1, sampleType: "FLOAT32" },
                { id: "NDRE", bands: 1, sampleType: "FLOAT32" }, 
                { id: "MSAVI", bands: 1, sampleType: "FLOAT32" },
                { id: "NDMI", bands: 1, sampleType: "FLOAT32" },
                { id: "NDWI", bands: 1, sampleType: "FLOAT32" }
            ]
        };
    }

    function evaluatePixel(sample) {
        if (sample.dataMask === 0 || [3, 8, 9, 10, 11].includes(sample.SCL)) {
            let nd = [-9999];
            return { NDVI: nd, EVI: nd, NDRE: nd, MSAVI: nd, NDMI: nd, NDWI: nd };
        }

        let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04);
        let evi = 2.5 * ((sample.B08 - sample.B04) / (sample.B08 + 6.0 * sample.B04 - 7.5 * sample.B02 + 1.0));
        let ndre = (sample.B08 - sample.B05) / (sample.B08 + sample.B05);
        let msavi = (2 * sample.B08 + 1 - Math.sqrt(Math.pow(2 * sample.B08 + 1, 2) - 8 * (sample.B08 - sample.B04))) / 2;
        let ndmi = (sample.B08 - sample.B11) / (sample.B08 + sample.B11);
        let ndwi = (sample.B03 - sample.B08) / (sample.B03 + sample.B08);

        return { NDVI: [ndvi], EVI: [evi], NDRE: [ndre], MSAVI: [msavi], NDMI: [ndmi], NDWI: [ndwi] };
    }
    """


async def get_cdse_token() -> Optional[str]:
    client_id = settings.CDSE_CLIENT_ID
    client_secret = settings.CDSE_CLIENT_SECRET
    if not client_id or not client_secret:
        return None
        
    data = {
        "grant_type": "client_credentials",
        "client_id": client_id,
        "client_secret": client_secret
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(CDSE_TOKEN_URL, data=data)
            if res.status_code == 200:
                return res.json().get("access_token")
    except Exception as e:
        logger.warning(f"CDSE OAuth failed: {e}")
    return None


def classify_crop_health(ndvi: Optional[float]) -> CropHealthClassification:
    """
    Describe an NDVI band. This heuristic does not diagnose crop health or stage.
    """
    if ndvi is None:
        return CropHealthClassification(
            status="No satellite observation",
            health_score=0,
            color_hex="#94a3b8",
            recommendation="No crop observation is recorded. Current crop condition must be checked in the field."
        )

    if ndvi >= 0.65:
        return CropHealthClassification(
            status="High greenness",
            health_score=min(100, int(70 + (ndvi - 0.65) * 85)),
            color_hex="#16a34a",
            recommendation="High greenness in this observation. Use recorded crop stage, soil results and field inspection for management decisions."
        )
    elif ndvi >= 0.50:
        return CropHealthClassification(
            status="Moderately high greenness",
            health_score=int(55 + (ndvi - 0.50) * 100),
            color_hex="#22c55e",
            recommendation="Moderately high greenness. This does not confirm crop health or a need for nitrogen. Check soil results and field conditions."
        )
    elif ndvi >= 0.35:
        return CropHealthClassification(
            status="Moderate greenness",
            health_score=int(40 + (ndvi - 0.35) * 100),
            color_hex="#eab308",
            recommendation="Moderate greenness. Crop stage, cover, water and other factors can influence this value. Confirm the cause in the field."
        )
    else:
        return CropHealthClassification(
            status="Low greenness",
            health_score=max(10, int(ndvi * 100)),
            color_hex="#ef4444",
            recommendation="Low greenness. Inspect crop cover and field conditions; this value alone does not establish stress, deficiency or disease."
        )
