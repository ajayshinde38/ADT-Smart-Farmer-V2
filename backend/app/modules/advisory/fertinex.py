"""FertiNex reference planning, with explicit unknown inputs and balance residuals.

The supplied tables are reference scenarios, not proof of an application or a
locally validated prescription. No pesticide or unknown liquid density is used.
"""
import itertools
import json
from datetime import timedelta
from pathlib import Path

import numpy as np

from app.farmers.context import as_date, local_today

REFERENCE = json.loads(Path(__file__).with_name('fertinex_reference.json').read_text(encoding='utf-8'))
SEASONS = {
    'adsali': (250., (160., 68., 68.), 450),
    'pre-seasonal': (220., (136., 68., 68.), 420),
    'suru': (200., (100., 46., 46.), 360),
}
NUTRIENTS = ('N', 'P2O5', 'K2O')


def season_context(value, planted=None):
    text = str(value or '').strip().lower()
    if 'adsali' in text or 'आडसाली' in text: return 'adsali', 'recorded'
    if 'pre' in text or 'पूर्वहंगामी' in text: return 'pre-seasonal', 'recorded'
    if text in ('suru', 'seasonal', 'सुरू', 'सुरु', 'हंगामी'): return 'suru', 'recorded'
    if planted:
        return ('adsali' if 6 <= planted.month <= 9 else 'pre-seasonal' if planted.month in (10,11) else 'suru'), 'planting_month_estimate'
    return None, 'unknown'


def nonnegative_fit(matrix, target):
    """Solve three dominant groups on [0,8], enumerating active bounds.
    Reference scaling caps remain explicit; residuals are reported downstream.
    """
    best = np.zeros(3)
    error = float(np.dot(target, target))
    for states in itertools.product(('zero','free','upper'), repeat=3):
        free = [i for i,state in enumerate(states) if state == 'free']
        candidate = np.array([8. if state == 'upper' else 0. for state in states])
        if free:
            values = np.linalg.lstsq(matrix[:,free], target-matrix@candidate, rcond=None)[0]
            if np.any(values < -1e-9) or np.any(values > 8.+1e-9): continue
            candidate[free] = np.clip(values,0,8)
        # A zero remaining nutrient may not be added through another carrier.
        if np.any((matrix@candidate)[np.asarray(target)<=1e-9]>1e-9): continue
        score = float(np.sum((matrix @ candidate - target) ** 2))
        if score < error: best, error = candidate, score
    return best


def plan(farm, raw, measured):
    planted = as_date(farm.get('plantation_date'))
    today = local_today()
    if planted and planted > today: planted = None
    season, season_source = season_context(farm.get('crop_season'), planted)
    area = measured(farm.get('area_acre'))
    ph = measured((farm.get('soil') or {}).get('ph'))
    age = (today - planted).days if planted else None
    source_applied = farm.get('applied_till_date')
    applied = {k: measured((source_applied or {}).get(k)) for k in NUTRIENTS}
    history_known = isinstance(source_applied, dict) and all(v is not None for v in applied.values())
    missing = ([] if season else ['crop_season']) + ([] if planted else ['plantation_date'])
    if not area: missing.append('area_acre')
    if ph is None or not 6 <= ph <= 8.9: missing.append('soil_ph_in_reference_range_6_to_8.9')
    if not history_known: missing.append('confirmed_applied_N_P2O5_K2O_kg_per_acre')
    target = None
    if season and raw:
        # FertiNex uses the following per-acre standards (not ha / 2.5).
        std = SEASONS[season][1]
        target = {k: round(max(.8*s, min(1.2*s, .8*raw[f'rdf_{n}_kg_acre'])), 2)
                  for k,n,s in zip(NUTRIENTS, ('n','p','k'), std)}
    remaining = {k: round(max(0, target[k]-applied[k]), 2) for k in NUTRIENTS} if target and history_known else None
    out = {'model': 'FertiNex bounded STCR + pH/DAP reference schedule',
           'season': season, 'season_source': season_source, 'current_dap': age,
           'season_cutoff_dap': SEASONS[season][2] if season else None,
           'ph_band': '6.0–8.2' if ph is not None and 6 <= ph <= 8.2 else 'above 8.2–8.9' if ph is not None and 8.2 < ph <= 8.9 else None,
           'nutrient_basis': list(NUTRIENTS), 'bounded_target_kg_acre': target,
           'applied_kg_acre': applied if history_known else None, 'remaining_kg_acre': remaining,
           'remaining_kg_farm': {k: round(v*area,2) for k,v in remaining.items()} if remaining and area else None,
           'missing_inputs': missing, 'application_history_available': history_known,
           'status': 'missing_inputs', 'schedule': [], 'balance': None,
           'note': 'Planning scenario from the supplied reference. Confirm soil P/K basis, product label, local suitability and mixing compatibility with an agronomist. Past dates never establish completed applications.'}
    if not raw: out['missing_inputs'].append('complete_soil_N_P_K_OC'); return out
    if missing: return out
    if age > SEASONS[season][2]: out['status'] = 'crop_cycle_finished'; return out
    entries = REFERENCE['_SCHEDULE_PH_HIGH' if ph > 8.2 else '_SCHEDULE_PH_LOW']
    groups, matrix, excluded = {}, np.zeros((3,3)), set()
    for entry in entries:
        if not age <= entry['dap'] <= SEASONS[season][2]: continue
        composition = REFERENCE['_FERTILIZER_NUTRIENTS'].get(entry['fertilizer'].lower())
        if not composition or entry['unit'] not in ('kg','gm','g'):
            excluded.add(entry['fertilizer']); continue
        mass = entry['quantity'] / (1000 if entry['unit'] in ('g','gm') else 1)
        nutrients = np.asarray(composition) * mass / 100
        column = 1 if nutrients[1] > nutrients[0] and nutrients[1] >= nutrients[2] else 2 if nutrients[2] > nutrients[0] and nutrients[2] > nutrients[1] else 0
        matrix[:,column] += nutrients
        groups.setdefault(entry['dap'], []).append((entry, mass, nutrients, column))
    factors = nonnegative_fit(matrix, np.array([remaining[k] for k in NUTRIENTS]))
    delivered = np.zeros(3)
    for dap, items in sorted(groups.items()):
        products = []
        for entry,mass,nutrients,column in items:
            qty = round(mass*factors[column], 4)
            if qty <= 0: continue
            delivered += np.asarray(REFERENCE['_FERTILIZER_NUTRIENTS'][entry['fertilizer'].lower()])*qty/100
            products.append({'product':entry['fertilizer'], 'kg_per_acre':qty, 'kg_farm':round(qty*area,4)})
        if products:
            out['schedule'].append({'dap':dap, 'date':(planted+timedelta(days=dap)).isoformat(),
                'status':'due_today' if dap == age else 'upcoming', 'products':products})
    residual = {k: round(remaining[k]-float(delivered[i]),4) for i,k in enumerate(NUTRIENTS)}
    out['balance'] = {'delivered_kg_acre':{k:round(float(delivered[i]),4) for i,k in enumerate(NUTRIENTS)},
                      'unmet_kg_acre':{k:max(0,v) for k,v in residual.items()},
                      'excess_kg_acre':{k:max(0,-v) for k,v in residual.items()}}
    out['status'] = 'reference_plan' if all(abs(v)<.05 for v in residual.values()) else 'agronomist_review_required'
    out['excluded_reference_products'] = sorted(excluded)
    return out
