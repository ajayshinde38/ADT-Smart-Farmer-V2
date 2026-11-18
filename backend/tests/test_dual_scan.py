import os
from uuid import uuid4
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.modules.pest_disease import service, efficientnet_classifier
from app.modules.pest_disease.router import router
from app.core.security import require_authorized_farmer


def pair(segmented=None,classified=None):
    segmented=segmented or {};classified=classified or {}
    names=['Brown Rust','Mosaic','Red Rot']
    return ({'affected_percent':5,'model_result':{'model':'UNet / ResNet34','status':'complete',
        'predictions':[{'disease':n,'score':segmented.get(n,0),'detected':n in segmented,
                        'affected_percentage':5} for n in names]}},
        {'model':'EfficientNet-B0','status':'complete','predictions':[
            {'disease':n,'score':classified.get(n,0),'detected':n in classified} for n in names]})


def test_agreement_returns_both_models_and_conservative_score():
    result=service.combine_results(*pair({'Mosaic':.9},{'Mosaic':.82}))
    assert result.status=='disease_detected' and result.detected_disease=='Mosaic'
    assert result.confidence_score==.82 and len(result.model_results)==2
    assert result.affected_percentage==5
    assert result.disease_details.management_practices
    assert 'No chemical cure' in result.disease_details.treatment


@pytest.mark.parametrize('seg,cls',[({'Mosaic':.9},{'Red Rot':.9}),({'Brown Rust':.85},{'Red Rot':.9}),({'Red Rot':.8},{'Mosaic':.85})])
def test_conflicts_never_invent_confirmed_treatment(seg,cls):
    result=service.combine_results(*pair(seg,cls))
    assert result.status=='uncertain' and result.disease_details is None
    assert result.detected_diseases==[]


def test_high_confidence_detection_provides_advisory():
    result=service.combine_results(*pair({},{'Mosaic':.88}))
    assert result.status=='disease_detected' and result.detected_disease=='Mosaic'
    assert result.disease_details is not None
    assert 'No chemical cure' in result.disease_details.treatment


def test_negative_is_not_a_healthy_class():
    result=service.combine_results(*pair())
    assert result.status=='not_detected' and 'healthy' in result.decision_reason
    assert result.disease_details is None


def test_multilabel_agreement_retains_multiple_supported_diseases():
    result=service.combine_results(*pair({'Brown Rust':.8,'Mosaic':.9},{'Brown Rust':.75,'Mosaic':.85}))
    assert result.detected_diseases==['Mosaic','Brown Rust']


def test_missing_either_model_fails_instead_of_single_model_success(monkeypatch):
    seg,cls=pair({'Mosaic':.9},{'Mosaic':.8})
    monkeypatch.setattr('app.modules.pest_disease.unet_classifier.run_inference',lambda _:seg)
    def unavailable(_):raise RuntimeError('Second model unavailable')
    monkeypatch.setattr(efficientnet_classifier,'run_inference',unavailable)
    with pytest.raises(RuntimeError):service.diagnose_leaf_image(b'isolated fixture')


def test_guidance_all_supported_diseases_bilingual_and_reference_only():
    for detail in service.get_all_diseases():
        assert len(detail.management_practices)==5
        assert all(group.items and group.items_mr for group in detail.management_practices)
        assert detail.treatment_mr and detail.reference_note_mr
        assert all(row.verification_status=='supplied_reference_not_label_verified' for row in detail.chemical_references)


def test_history_evidence_rejects_another_farm_before_storage(monkeypatch):
    app=FastAPI();app.include_router(router)
    owner=uuid4();farm=uuid4();record=uuid4()
    monkeypatch.setattr('app.farmers.service.get_farm_by_id',lambda _:{'farm_id':farm,'farmer_id':owner})
    app.dependency_overrides[require_authorized_farmer]=lambda:uuid4()
    async def unexpected(*args):raise AssertionError('Unauthorized storage access')
    monkeypatch.setattr('app.modules.pest_disease.history.saved_scan',unexpected)
    assert TestClient(app).get(f'/pest-disease/history/{farm}/analysis/{record}').status_code==403


@pytest.mark.skipif(os.getenv('RUN_REAL_SCAN_TEST')!='1',reason='Explicit real local model smoke test')
def test_real_checkpoint_respects_metadata_and_sigmoid():
    import torch
    from PIL import Image
    import io
    torch.set_num_threads(1)
    model,metadata=efficientnet_classifier.load_classifier()
    assert metadata=={'class_names':['Brown Rust','Mosaic','Red Rot'],'img_size':224,'multi_label':True}
    data=io.BytesIO();Image.new('RGB',(256,256),'green').save(data,'PNG')
    result=efficientnet_classifier.run_inference(data.getvalue())
    assert len(result['predictions'])==3
    assert all(0<=p['score']<=1 for p in result['predictions'])
    assert efficientnet_classifier.load_classifier()[0] is model
