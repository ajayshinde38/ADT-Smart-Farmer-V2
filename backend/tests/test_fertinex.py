from datetime import timedelta
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.farmers.context import local_today
from app.modules.advisory import service
from app.modules.advisory.fertinex import plan, season_context
from app.modules.advisory.router import router
from app.core.security import require_authorized_farmer


def farm(**overrides):
    return {'farm_id':str(uuid4()),'farmer_id':str(uuid4()),'name':'Isolated fixture','area_acre':2,
        'crop_season':'Adsali','plantation_date':str(local_today()-timedelta(days=30)),
        'soil':{'ph':7.2,'oc':.5,'nitrogen_kg_ha':100,'phosphorus_kg_ha':10,'potassium_kg_ha':300},**overrides}


def test_preseasonal_does_not_match_suru_substring():
    assert season_context('pre-seasonal')[0]=='pre-seasonal'
    assert season_context('आडसाली')[0]=='adsali'
    assert season_context('unknown')==(None,'unknown')


@pytest.mark.parametrize('season,expected',[('adsali',(192,81.6,81.6)),('pre-seasonal',(163.2,81.6,81.6)),('suru',(120,55.2,55.2))])
def test_reference_bounds_and_unknown_history(season,expected):
    f=farm(crop_season=season)
    raw={f'rdf_{n}_kg_acre':1000 for n in ('n','p','k')}
    result=plan(f,raw,service.measured)
    assert tuple(result['bounded_target_kg_acre'].values())==expected
    assert result['remaining_kg_acre'] is None
    assert result['schedule']==[]


def test_confirmed_zero_is_distinct_from_missing_and_area_scales():
    raw={f'rdf_{n}_kg_acre':100 for n in ('n','p','k')}
    f=farm(applied_till_date={'N':0,'P2O5':0,'K2O':0})
    result=plan(f,raw,service.measured)
    assert result['remaining_kg_acre']==result['bounded_target_kg_acre']
    assert result['schedule']
    for k,v in result['remaining_kg_acre'].items(): assert result['remaining_kg_farm'][k]==round(v*2,2)
    for group in result['schedule']:
        assert group['dap']>=30
        assert group['status']!='completed'
        for product in group['products']:
            assert product['kg_per_acre']>=0
            assert product['kg_farm']==round(product['kg_per_acre']*2,4)
            assert product['product'] not in ('Fertera','Corogen')


def test_zero_remaining_nutrient_is_not_reintroduced_and_residual_is_honest():
    f=farm(applied_till_date={'N':999,'P2O5':0,'K2O':0})
    result=plan(f,{f'rdf_{n}_kg_acre':100 for n in ('n','p','k')},service.measured)
    assert result['remaining_kg_acre']['N']==0
    assert result['balance']['delivered_kg_acre']['N']==0
    for k in ('N','P2O5','K2O'):
        balance=result['balance']
        assert balance['delivered_kg_acre'][k]+balance['unmet_kg_acre'][k]-balance['excess_kg_acre'][k]==pytest.approx(result['remaining_kg_acre'][k],abs=.001)


def test_old_cycle_does_not_issue_catchup_schedule():
    f=farm(plantation_date=str(local_today()-timedelta(days=500)),applied_till_date={'N':0,'P2O5':0,'K2O':0})
    result=plan(f,{f'rdf_{n}_kg_acre':100 for n in ('n','p','k')},service.measured)
    assert result['status']=='crop_cycle_finished' and result['schedule']==[]


def test_plan_route_auth_ownership_and_finite_inputs(monkeypatch):
    app=FastAPI();app.include_router(router)
    f=farm()
    monkeypatch.setattr(service.farmer_service,'get_farm_by_id',lambda _:f)
    client=TestClient(app)
    url=f"/advisory/farm/{f['farm_id']}/plan"
    payload={'applied_till_date':{'N':0,'P2O5':0,'K2O':0}}
    assert client.post(url,json=payload).status_code==401
    app.dependency_overrides[require_authorized_farmer]=lambda:uuid4()
    assert client.post(url,json=payload).status_code==403
    app.dependency_overrides[require_authorized_farmer]=lambda:f['farmer_id']
    monkeypatch.setattr('app.modules.advisory.router.verify_farm_ownership',lambda f,c:True)
    assert client.post(url,json={'applied_till_date':{'N':-1,'P2O5':0,'K2O':0}}).status_code==422
    assert client.post(url,json=payload).status_code==200
    assert 'applied_till_date' not in f  # Preview must not mutate canonical farm data.
    cycle={**payload,'plantation_date':str(local_today()-timedelta(days=1)),'crop_season':'suru'}
    response=client.post(url,json=cycle)
    assert response.status_code==200
    assert response.json()['planning']['fertinex']['season_cutoff_dap']==360
    assert response.json()['planning']['fertinex']['current_dap']==1
    assert client.post(url,json={**payload,'plantation_date':str(local_today()+timedelta(days=1))}).status_code==422
