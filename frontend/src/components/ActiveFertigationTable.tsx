import React,{useState} from 'react';
import {View,TouchableOpacity,StyleSheet} from 'react-native';
import {AppText as Text,Icon,amount,ui} from './ui';
import {FertigationPeriod,FertigationScheduleData} from '../types';
import {colors} from '../theme/colors';
import {doseProducts} from '../utils/fertilizerPresentation';
interface Props {schedule:FertigationScheduleData|null;farmArea:number;language:'en'|'mr';onToggleApplied:(period:string,currentlyApplied:boolean)=>Promise<void>}
export const ActiveFertigationTable=({schedule,farmArea,language,onToggleApplied}:Props)=>{
  const mr=language==='mr', [busy,setBusy]=useState<string|null>(null),[error,setError]=useState('');
  if(!schedule)return null;
  const periods=schedule.farmer_periods||[];
  const toggle=async(item:FertigationPeriod)=>{
    if(busy)return;setBusy(item.period);setError('');
    try{await onToggleApplied(item.period,!!item.applied);}
    catch{setError(mr?'खत दिल्याची नोंद जतन झाली नाही.':'The application record could not be saved. Please retry.');}
    finally{setBusy(null);}
  };
  const summary=(label:string,values:{N:number;P:number;K:number}|null|undefined,perAcre=false)=><View style={styles.summary}>
    <Text style={styles.summaryTitle}>{label}</Text>
    <Text style={styles.summaryValue}>{['N','P','K'].map(k=>`${k}: ${amount(values?.[k as 'N'|'P'|'K']!=null?(values[k as 'N'|'P'|'K']*(perAcre?(farmArea>0?farmArea:NaN):1)):null,1)}`).join(' · ')} {mr?'किलो':'kg'}</Text>
    <Text style={ui.note}>{mr?'संपूर्ण शेत':'Whole farm'} · {amount(farmArea,2)} {mr?'एकर':'acres'}</Text>
  </View>;
  const advised=periods.length?{N:periods.reduce((n,p)=>n+p.target_n,0),P:periods.reduce((n,p)=>n+p.target_p,0),K:periods.reduce((n,p)=>n+p.target_k,0)}:null;
  return <View style={{gap:14}}>
    <View style={styles.titleRow}><View style={styles.icon}><Icon name="event-note" size={22}/></View><View style={{flex:1}}><Text style={ui.section}>{mr?'खतांचे वेळापत्रक':'Fertilizer schedule'}</Text><Text style={ui.note}>{mr?'मागील हप्ते आणि पुढील खत सल्ला':'Recent doses and your next fertilizer advice'}</Text></View></View>
    {summary(mr?'आजवर दिलेली अन्नद्रव्ये':'Nutrients applied to date',schedule.applied_till_date,true)}
    {periods.map((item,i)=>{
      const active=item.period===schedule.active_upcoming_dose?.period;
      return <View key={`${item.period}-${i}`} style={[styles.dose,active&&styles.active]}>
        <View style={styles.row}><Text style={styles.dap}>{item.dap} {mr?'लागवडीनंतरचे दिवस':'days after planting'}</Text><Text style={styles.status}>{item.applied?(mr?'✓ दिले आहे':'✓ Applied'):active?(mr?'पुढील हप्ता':'Next dose'):(mr?'मागील हप्ता':'Previous dose')}</Text></View>
        <Text style={ui.note}>{item.application_date||'—'}</Text>
        {doseProducts(item,language).map((p,j)=><View key={j} style={styles.product}><View style={{flex:1,minWidth:120}}><Text style={styles.name}>{p.name}</Text>{!!p.water&&<Text style={ui.note}>{p.water}</Text>}</View><Text style={styles.mass}>{p.quantity}</Text></View>)}
        <Text style={ui.note}>N {amount(item.target_n,1)} · P {amount(item.target_p,1)} · K {amount(item.target_k,1)} {mr?'किलो · संपूर्ण शेत':'kg · whole farm'}</Text>
        <TouchableOpacity accessibilityRole="button" disabled={busy!==null} onPress={()=>toggle(item)} style={[ui.button,ui.secondary]}><Text style={styles.action}>{busy===item.period?(mr?'जतन होत आहे…':'Saving…'):item.applied?(mr?'दिल्याची नोंद बदला':'Undo applied record'):(mr?'खत दिल्याची नोंद करा':'Mark as applied')}</Text></TouchableOpacity>
      </View>;
    })}
    {!periods.length&&<Text style={ui.note}>{mr?'या शेतासाठी कोणताही हप्ता उपलब्ध नाही.':'No scheduled doses are available for this farm.'}</Text>}
    {!!error&&<Text accessibilityRole="alert" style={{color:colors.error}}>{error}</Text>}
    <View style={styles.summaries}>{summary(mr?'दाखवलेल्या हप्त्यांची बेरीज':'Total of shown doses',advised)}{summary(mr?'हंगामाचे अन्नद्रव्य उद्दिष्ट':'Season nutrient target',schedule.bounded_target_kg_acre,true)}</View>
  </View>;
};
const styles=StyleSheet.create({
  titleRow:{flexDirection:'row',alignItems:'center',gap:10},icon:{width:42,height:42,borderRadius:13,backgroundColor:'#e7f3e9',alignItems:'center',justifyContent:'center'},
  dose:{borderRadius:18,borderWidth:1,borderColor:colors.border,backgroundColor:'#fff',padding:16,gap:10},active:{borderColor:'#b6d8bd',backgroundColor:'#f5faf5'},
  row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8},dap:{fontSize:15,lineHeight:23,fontWeight:'700',color:colors.textMain},status:{fontSize:12,fontWeight:'700',color:colors.secondary,backgroundColor:'#e4f1e6',paddingHorizontal:10,paddingVertical:5,borderRadius:16},
  product:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:8,paddingVertical:7,borderBottomWidth:1,borderBottomColor:colors.borderLight},name:{fontSize:14,lineHeight:23,color:colors.textMain,flex:1,minWidth:120},mass:{fontSize:14,lineHeight:23,color:colors.primary,fontWeight:'700'},
  summaries:{gap:10},summary:{borderRadius:14,padding:14,backgroundColor:'#eef6ef',gap:5},summaryTitle:{fontSize:13,fontWeight:'700',color:colors.textSecondary},summaryValue:{fontSize:16,lineHeight:24,fontWeight:'700',color:colors.primary},action:{fontSize:14,fontWeight:'700',color:colors.primary},
});
