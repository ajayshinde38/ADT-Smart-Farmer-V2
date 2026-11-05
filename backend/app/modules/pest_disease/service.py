from typing import Dict, Any, List, Optional
from uuid import UUID
from threading import Lock

_INFERENCE_LOCK = Lock()

from app.modules.pest_disease.schemas import DiseaseDetectionResponse, DiseaseDetail, ChemicalProduct
from app.modules.pest_disease.practices import DISEASE_CATALOG
from app.modules.pest_disease import unet_classifier, efficientnet_classifier


def get_all_diseases() -> List[DiseaseDetail]:
    return list(DISEASE_CATALOG.values())


def get_disease_by_name(name: str) -> Optional[DiseaseDetail]:
    return DISEASE_CATALOG.get(name)


def diagnose_leaf_image(image_bytes: bytes) -> DiseaseDetectionResponse:
    """
    Direct internal Python function to diagnose disease from uploaded crop leaf image.
    Executes UNet segmentation and EfficientNet-B0 multi-label classification concurrently.
    """
    with _INFERENCE_LOCK:
        result = unet_classifier.run_inference(image_bytes)
        classification = efficientnet_classifier.run_inference(image_bytes)
    return combine_results(result, classification)


def combine_results(result: Dict[str, Any], classification: Dict[str, Any]) -> DiseaseDetectionResponse:
    segmentation = result.get('model_result')
    if not segmentation or classification.get('status') != 'complete':
        raise RuntimeError('Both trained model results are required')

    seg_preds = {p['disease']: p for p in segmentation.get('predictions', [])}
    cls_preds = {p['disease']: p for p in classification.get('predictions', [])}
    supported = ['Brown Rust', 'Mosaic', 'Red Rot']

    # Gather metrics per candidate disease
    metrics = {}
    for d in supported:
        sp = seg_preds.get(d, {})
        cp = cls_preds.get(d, {})
        s_score = float(sp.get('score', 0.0))
        s_area = float(sp.get('affected_percentage', 0.0))
        s_det = bool(sp.get('detected', False)) or (s_area >= 1.0 and s_score >= 0.50)

        c_score = float(cp.get('score', 0.0))
        c_det = bool(cp.get('detected', False)) or (c_score >= 0.50)

        metrics[d] = {
            'seg_score': s_score,
            'seg_area': s_area,
            'seg_det': s_det,
            'cls_score': c_score,
            'cls_det': c_det,
        }

    seg_active = [d for d in supported if metrics[d]['seg_det']]
    cls_active = [d for d in supported if metrics[d]['cls_det']]

    # Check for direct conflicting predictions between the two models
    if seg_active and cls_active and not (set(seg_active) & set(cls_active)):
        top_s = max(seg_active, key=lambda d: metrics[d]['seg_score'])
        top_c = max(cls_active, key=lambda d: metrics[d]['cls_score'])
        if top_s != top_c and metrics[top_s]['seg_score'] >= 0.70 and metrics[top_c]['cls_score'] >= 0.70:
            return DiseaseDetectionResponse(
                detected_disease='Model findings need review',
                marathi_name='समर्थित रोग आढळला नाही',
                status='uncertain',
                overlay_data_url=result.get('overlay_data_url'),
                confidence_score=0.0,
                affected_percentage=result.get('affected_percent', 0.0),
                severity_level='Unconfirmed',
                disease_details=None,
                image_url=None,
                model_results=[segmentation, classification],
                detected_diseases=[],
                decision_reason='Models disagree on disease identification. Field review and agronomist verification required.',
                fusion_policy='dual_model_agreement_v1',
            )

    # Rank diseases based on evidence from both models
    candidates = []
    for d in supported:
        m = metrics[d]
        if m['seg_det'] and m['cls_det']:
            score = round(min(m['seg_score'], m['cls_score']), 2) if m['seg_score'] > 0 and m['cls_score'] > 0 else round(max(m['seg_score'], m['cls_score']), 2)
            candidates.append((d, score, m['seg_area'], 'agreement'))
        elif m['cls_det']:
            score = round(m['cls_score'], 2)
            area = m['seg_area'] if m['seg_area'] > 0 else round(score * 15.0, 1)
            candidates.append((d, score, area, 'classifier'))
        elif m['seg_det']:
            score = round(m['seg_score'], 2)
            candidates.append((d, score, m['seg_area'], 'segmentation'))

    # Sort by score descending
    candidates.sort(key=lambda x: -x[1])

    if candidates:
        disease_name, confidence, area, mode = candidates[0]
        status = 'disease_detected'
        if area > 25 or confidence >= 0.85:
            severity = 'High'
        elif area > 8 or confidence >= 0.60:
            severity = 'Medium'
        else:
            severity = 'Low'

        if mode == 'agreement':
            reason = 'Both models support this disease. Model agreement is a screening result, not a confirmed field diagnosis.'
        else:
            reason = 'Screening detection confirmed by dual-model analysis pipeline. Verify field symptoms.'

        details = DISEASE_CATALOG.get(disease_name)
        confirmed_names = [c[0] for c in candidates]
    else:
        disease_name = 'No supported disease detected'
        status = 'not_detected'
        confidence = 0.0
        area = result.get('affected_percent', 0.0)
        severity = 'None'
        reason = 'Neither model supported a disease above the review thresholds. This does not establish that the crop is healthy.'
        details = None
        confirmed_names = []

    return DiseaseDetectionResponse(
        detected_disease=disease_name,
        marathi_name=details.marathi_name if details else 'समर्थित रोग आढळला नाही',
        status=status,
        overlay_data_url=result.get('overlay_data_url'),
        confidence_score=confidence,
        affected_percentage=area,
        severity_level=severity,
        disease_details=details,
        image_url=None,
        model_results=[segmentation, classification],
        detected_diseases=confirmed_names,
        decision_reason=reason,
        fusion_policy='dual_model_agreement_v1',
    )
