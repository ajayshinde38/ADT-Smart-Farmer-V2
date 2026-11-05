import React,{useEffect,useRef,useState} from 'react';
import {View,TextInput,TouchableOpacity} from 'react-native';
import {AppText as Text,amount,ui} from './ui';
import {ApiClient} from '../services/apiClient';
import {AdvisoryData} from '../types';
import {fertilizerName} from '../utils/fertilizerPresentation';

export const FertinexPanel=({farmId,data,language}:{farmId:string;data:AdvisoryData|null;language:'en'|'mr'})=>{
  const mr=language==='mr', words=(en:string,ma:string)=>mr?ma:en;
  const [preview,setPreview]=useState<AdvisoryData|null>(null),[applied,setApplied]=useState(['','','']);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[expanded,setExpanded]=useState(false);
  const [planting,setPlanting]=useState(''),[season,setSeason]=useState('');
  const generation=useRef(0);
  useEffect(()=>{generation.current++;setPreview(null);setApplied(['','','']);setPlanting('');setSeason('');setError('');setBusy(false);setExpanded(false);return()=>{generation.current++;};},[farmId,data]);
  const plan=(preview||data)?.planning.fertinex;
  const nutrients=['N','P2O5','K2O'];
  const invalidate=()=>{generation.current++;setPreview(null);setBusy(false);setError('');};
  const calculate=async()=>{
    const values=applied.map(v=>v.trim()===''?NaN:Number(v));
    if(values.some(v=>!Number.isFinite(v)||v<0)){setError(words('Enter all three applied nutrient amounts; enter 0 only if confirmed none applied.','तिन्ही वापरलेल्या अन्नद्रव्यांची प्रमाणे भरा. वापरले नसल्याची खात्री असल्यासच 0 भरा.'));return;}
    if(planting.trim()&&!/^\d{4}-\d{2}-\d{2}$/.test(planting.trim())){setError(words('Use YYYY-MM-DD for the planting date.','लागवडीची तारीख YYYY-MM-DD स्वरूपात भरा.'));return;}
    const request=generation.current;setBusy(true);setError('');
    try{const result=await ApiClient.fertilizerPlan(farmId,Object.fromEntries(nutrients.map((k,i)=>[k,values[i]])),{...(season?{crop_season:season}:{}),...(planting.trim()?{plantation_date:planting.trim()}:{})});if(request===generation.current)setPreview(result);}
    catch(e){if(request===generation.current)setError(e instanceof Error?e.message:'Plan unavailable');}
    finally{if(request===generation.current)setBusy(false);}
  };
  const row=(label:string,values:Record<string,number>|null|undefined)=><View style={{gap:4}}><Text style={ui.section}>{label}</Text><Text style={ui.body}>{nutrients.map(k=>`${k}: ${amount(values?.[k],2)}`).join(' · ')}</Text></View>;
  return <View style={{gap:12}}>
    <Text style={ui.section}>FertiNex · {words('Season & nutrient balance','हंगाम आणि अन्नद्रव्यांचा ताळेबंद')}</Text>
    {!plan?<Text style={ui.note}>{words('Planning model unavailable from this server.','या सर्व्हरवर खत नियोजन उपलब्ध नाही.')}</Text>:<>
      <Text style={ui.note}>{plan.season||'—'} · {plan.season_source} · pH {plan.ph_band||'—'} · DAP {plan.current_dap??'—'} / {plan.season_cutoff_dap??'—'}</Text>
      {row(words('Bounded seasonal target · kg/acre','हंगामाचे मर्यादित उद्दिष्ट · किलो/एकर'),plan.bounded_target_kg_acre)}
      {row(words('Confirmed applied · kg/acre','खात्री केलेला वापर · किलो/एकर'),plan.applied_kg_acre)}
      {row(words('Remaining nutrients · kg/acre','उर्वरित अन्नद्रव्ये · किलो/एकर'),plan.remaining_kg_acre)}
      {row(words('Remaining nutrients · whole farm kg','संपूर्ण शेतासाठी उर्वरित अन्नद्रव्ये · किलो'),plan.remaining_kg_farm)}
      <Text style={ui.note}>{words('Status','स्थिती')}: {plan.status.replace(/_/g,' ')}</Text>
      {!!plan.missing_inputs.length&&<Text style={ui.note}>{words('Needed','आवश्यक')}: {plan.missing_inputs.join(', ')}</Text>}
      {plan.status==='crop_cycle_finished'&&<Text style={ui.body}>{words('Recorded crop age exceeds this season’s schedule. Verify the current planting or ratoon cycle before planning new applications.','नोंदवलेल्या पिकाचे वय हंगामाच्या मर्यादेबाहेर आहे. नवीन लागवड किंवा खोडवा नोंद तपासा.')}</Text>}
      {plan.balance&&<>{row(words('Schedule delivery · kg/acre','वेळापत्रकातील अन्नद्रव्ये · किलो/एकर'),plan.balance.delivered_kg_acre)}{row(words('Unmet balance · kg/acre','अपूर्ण गरज · किलो/एकर'),plan.balance.unmet_kg_acre)}{row(words('Excess · kg/acre','अधिक मात्रा · किलो/एकर'),plan.balance.excess_kg_acre)}</>}
      <Text style={ui.note}>{plan.note}</Text>
      {plan.schedule.slice(0,expanded?undefined:4).map(group=><View key={group.dap} style={{backgroundColor:'#eff7f0',padding:12,borderRadius:12,gap:6}}>
        <Text style={ui.section}>{group.date} · {group.dap} DAP · {group.status}</Text>
        {group.products.map(product=><Text key={product.product} style={ui.body}>{fertilizerName(product.product,language)}: {amount(product.kg_per_acre,3)} {words('kg/acre','किलो/एकर')} · {amount(product.kg_farm,3)} {words('kg whole farm','किलो संपूर्ण शेत')}</Text>)}
      </View>)}
      {plan.schedule.length>4&&<TouchableOpacity accessibilityRole="button" onPress={()=>setExpanded(v=>!v)} style={{padding:12}}><Text>{expanded?words('Show less','कमी पहा'):words('Show complete schedule','संपूर्ण वेळापत्रक पहा')}</Text></TouchableOpacity>}
    </>}
    <Text style={ui.section}>{words('Confirm nutrients already applied','आधी वापरलेली अन्नद्रव्ये भरा')}</Text>
    <Text style={ui.note}>{words('Optional current-cycle preview: leave these blank to use the farm record.','सध्याच्या पिकाचे नियोजन: शेतातील नोंद वापरण्यासाठी हे रिकामे ठेवा.')}</Text>
    <TextInput accessibilityLabel="Current planting date YYYY-MM-DD" placeholder="YYYY-MM-DD" value={planting} onChangeText={v=>{invalidate();setPlanting(v);}} style={ui.input}/>
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{['','adsali','pre-seasonal','suru'].map(value=><TouchableOpacity key={value} accessibilityRole="button" accessibilityState={{selected:season===value}} onPress={()=>{invalidate();setSeason(value);}} style={{padding:10,borderRadius:10,backgroundColor:season===value?'#bee6ca':'#f0f5f1'}}><Text>{value||words('Farm season','नोंदवलेला हंगाम')}</Text></TouchableOpacity>)}</View>
    <Text style={ui.note}>{words('Use nutrient kg/acre, not fertilizer product weight. All three amounts are required. This preview does not record an application or change farm records.','खताच्या उत्पादनाचे वजन नव्हे तर अन्नद्रव्यांचे किलो/एकर भरा. हे नियोजन वापराची किंवा शेताची नोंद बदलत नाही.')}</Text>
    {nutrients.map((k,i)=><TextInput key={k} accessibilityLabel={`${k} already applied kg per acre`} placeholder={`${k} kg/acre`} value={applied[i]} keyboardType="decimal-pad" onChangeText={v=>{invalidate();setApplied(old=>old.map((x,j)=>j===i?v:x));}} style={ui.input}/>)}
    <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={calculate} style={{padding:14,backgroundColor:'#e6f3e8',borderRadius:12}}><Text>{busy?words('Calculating…','मोजत आहे…'):words('Preview fertilizer plan','खत नियोजन पहा')}</Text></TouchableOpacity>
    {!!error&&<Text accessibilityRole="alert" style={{color:'#9a4428'}}>{error}</Text>}
  </View>;
};
