"""Verified arithmetic from the Fertigation reference; no name-based product assignment."""
import math

SEASON_TARGETS={'adsali':250.0,'pre-seasonal':220.0,'suru':200.0}
PRODUCTS={'Urea':(46.0,0.0,0.0),'19:19:19':(19.0,19.0,19.0),'12:61:00':(12.0,61.0,0.0),
          '13:00:45':(13.0,0.0,45.0),'10:26:26':(10.0,26.0,26.0),'SOP':(0.0,0.0,50.0),'MOP':(0.0,0.0,60.0)}


def product_nutrients(product,quantity,unit,area_acres):
    if product not in PRODUCTS or unit not in ('kg','g'):
        raise ValueError('Select a supported product and mass unit. Liquid conversion requires a verified density.')
    if any(isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value) or value<=0 for value in (quantity,area_acres)):
        raise ValueError('Positive, finite product mass and farm area are required')
    mass=quantity/1000 if unit=='g' else quantity
    n,p,k=PRODUCTS[product]
    totals={key:round(mass*percent/100,4) for key,percent in (('N',n),('P2O5',p),('K2O',k))}
    return {'product':product,'product_mass_kg':round(mass,4),'area_acres':area_acres,
            'nutrients_kg':totals,'nutrients_kg_per_acre':{key:round(value/area_acres,4) for key,value in totals.items()},
            'note':'Composition arithmetic for the supplied product mass; not an application recommendation. Verify the product label and nutrient basis.'}
