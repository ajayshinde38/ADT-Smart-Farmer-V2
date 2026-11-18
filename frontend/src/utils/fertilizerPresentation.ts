import {FertigationPeriod} from '../types';

const names: Record<string,string> = {
  'ammonium sulphate':'अमोनियम सल्फेट','ammonium sulfate':'अमोनियम सल्फेट',
  'muriate of potash':'म्युरिएट ऑफ पोटॅश','sulphate of potash':'सल्फेट ऑफ पोटॅश',
  'potassium nitrate':'पोटॅशियम नायट्रेट','calcium nitrate':'कॅल्शियम नायट्रेट',
  'magnesium sulphate':'मॅग्नेशियम सल्फेट','magnesium sulfate':'मॅग्नेशियम सल्फेट',
  'diammonium phosphate':'डायअमोनियम फॉस्फेट','daiammonium phosphate':'डायअमोनियम फॉस्फेट',
  'micronutrient slurry':'सूक्ष्म अन्नद्रव्यांचे मिश्रण','humic + fulvic acid':'ह्युमिक + फुल्विक आम्ल',
  'phosphoric acid':'फॉस्फोरिक आम्ल','organic manure':'सेंद्रिय खत','organic carbon':'सेंद्रिय कर्ब',
  'neem cake':'निंबोळी पेंड','nimboli pend':'निंबोळी पेंड','poly sulphate':'पॉली सल्फेट',
  'poly sulfate':'पॉली सल्फेट','phosphogypsum':'फॉस्फोजिप्सम','mycorrhiza':'मायकोरायझा',
  'azotobacter':'अॅझोटोबॅक्टर','borax':'बोरॅक्स','boron':'बोरॉन',
  'fertera':'फरटेरा','corogen':'कोरोजन','coragen':'कोराजेन','urea':'युरिया',
  'sop':'सल्फेट ऑफ पोटॅश','mop':'म्युरिएट ऑफ पोटॅश','dap':'डायअमोनियम फॉस्फेट',
  'ssp':'सिंगल सुपर फॉस्फेट','can':'कॅल्शियम अमोनियम नायट्रेट','psb':'फॉस्फेट विरघळवणारे जीवाणू',
  'prome':'फॉस्फेट समृद्ध सेंद्रिय खत','promo':'फॉस्फेट समृद्ध सेंद्रिय खत',
};
const escape=(text:string)=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const pattern=new RegExp(`\\b(${Object.keys(names).sort((a,b)=>b.length-a.length).map(escape).join('|')})\\b`,'gi');

export const fertilizerName=(name:string,language:'en'|'mr')=>language==='mr'
  ? name.replace(pattern,match=>names[match.toLowerCase()]||match) : name;
export const fertilizerUnit=(unit:string,language:'en'|'mr')=>language==='en'?unit:
  ({kg:'किलो',g:'ग्रॅम',gm:'ग्रॅम',ml:'मिली',lit:'लिटर',l:'लिटर',liters:'लिटर'}[unit.toLowerCase()]||unit);
export const doseProducts=(dose:FertigationPeriod,language:'en'|'mr')=>{
  if(dose.products?.length)return dose.products.map(p=>({
    name:fertilizerName(p.fertilizer,language),
    quantity:typeof p.quantity==='number'&&Number.isFinite(p.quantity)?`${p.quantity} ${fertilizerUnit(p.unit,language)}`:'—',
    water:typeof p.water_liters==='number'&&Number.isFinite(p.water_liters)&&p.water_liters>0?`${language==='mr'?'पाणी':'Water'}: ${p.water_liters} ${language==='mr'?'लिटर':'L'}`:'',
  }));
  return (dose.recommendation_text||'').split('\n').filter(s=>s.trim()).map(line=>({name:fertilizerName(line,language),quantity:'',water:''}));
};
