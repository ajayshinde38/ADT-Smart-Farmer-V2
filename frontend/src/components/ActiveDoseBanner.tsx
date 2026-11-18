import React,{useState} from 'react';
import {View,TouchableOpacity,StyleSheet} from 'react-native';
import {AppText as Text,Icon,amount,ui} from './ui';
import {FertigationPeriod} from '../types';
import {colors} from '../theme/colors';
import {doseProducts} from '../utils/fertilizerPresentation';

interface Props {
  dose:(FertigationPeriod&{is_applied_waiting_for_date?:boolean})|null;
  farmArea:number;
  language:'en'|'mr';
  onToggleApplied?:(period:string,currentlyApplied:boolean)=>Promise<void>;
  onScrollToVra?:()=>void;
}
export const ActiveDoseBanner=({dose,farmArea,language,onToggleApplied,onScrollToVra}:Props)=>{
  const mr=language==='mr', [busy,setBusy]=useState(false),[error,setError]=useState('');
  if(!dose)return null;
  const applied=!!dose.applied;
  const toggle=async()=>{
    if(busy||!onToggleApplied)return;
    setBusy(true);setError('');
    try{await onToggleApplied(dose.period,applied);}
    catch{setError(mr?'नोंद जतन झाली नाही. पुन्हा प्रयत्न करा.':'The application record could not be saved. Please retry.');}
    finally{setBusy(false);}
  };
  return <View style={styles.card}>
    <View style={styles.headingRow}>
      <View style={styles.icon}><Icon name="grass" size={24} color={colors.primary}/></View>
      <View style={{flex:1,gap:4}}><Text style={styles.eyebrow}>{mr?'चालू खत सल्ला':'Current fertilizer advice'}</Text><Text style={styles.heading}>{dose.dap} {mr?'लागवडीनंतरचे दिवस':'days after planting'}</Text></View>
      <View style={styles.badge}><Text style={styles.badgeText}>{applied?(mr?'✓ दिले आहे':'✓ Applied'):(mr?'आगामी हप्ता':'Upcoming dose')}</Text></View>
    </View>
    <Text style={ui.note}>{dose.application_date||'—'} · {amount(farmArea,2)} {mr?'एकर':'acres'}</Text>
    <Text style={ui.note}>{mr?'तुमच्या शेतासाठी खतांचे प्रमाण':'Fertilizer quantities for your whole farm'}</Text>
    <View style={{gap:8}}>{doseProducts(dose,language).map((p,i)=><View key={i} style={styles.product}><View style={{flex:1,minWidth:120}}><Text style={styles.productName}>{p.name}</Text>{!!p.water&&<Text style={ui.note}>{p.water}</Text>}</View><Text style={styles.quantity}>{p.quantity}</Text></View>)}</View>
    <View style={styles.nutrients}>{[['N',dose.target_n],['P',dose.target_p],['K',dose.target_k]].map(([key,value])=><View key={String(key)} style={styles.nutrient}><Text style={ui.note}>{key}</Text><Text style={styles.quantity}>{amount(value,1)} {mr?'किलो':'kg'}</Text></View>)}</View>
    {!!dose.is_applied_waiting_for_date && (
      <View style={{backgroundColor: '#e8f5e9', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#c8e6c9'}}>
        <Text style={{color: '#2e7d32', fontWeight: '700', fontSize: 13}}>
          {mr
            ? `✓ खत दिल्याची नोंद झाली आहे. पुढील खत सल्ला ${dose.application_date || ''} ची तारीख संपल्यानंतर उपलब्ध होईल.`
            : `✓ Applied. Next advisory will unlock after the date of this dose (${dose.application_date || ''}) has passed.`}
        </Text>
      </View>
    )}
    {onToggleApplied&&<TouchableOpacity accessibilityRole="button" disabled={busy} onPress={toggle} style={[ui.button,applied&&ui.secondary]}><Icon name={applied?'check-circle':'check'} color={applied?colors.primary:'#fff'}/><Text style={{color:applied?colors.primary:'#fff',fontWeight:'700',fontSize:14}}>{busy?(mr?'जतन होत आहे…':'Saving…'):applied?(mr?'दिल्याची नोंद बदला':'Undo applied record'):(mr?'खत दिल्याची नोंद करा':'Mark as applied')}</Text></TouchableOpacity>}
    {!!error&&<Text accessibilityRole="alert" style={{color:colors.error}}>{error}</Text>}
    {onScrollToVra&&<TouchableOpacity accessibilityRole="button" onPress={onScrollToVra} style={styles.link}><Icon name="map" color={colors.primary}/><Text style={styles.badgeText}>{mr?'शेतातील झोन पहा':'View field zones'}</Text></TouchableOpacity>}
  </View>;
};
const styles=StyleSheet.create({
  card:{padding:16,gap:12,borderRadius:20,backgroundColor:'#f1f8f2',borderWidth:1,borderColor:'#d8e9db'},
  headingRow:{flexDirection:'row',alignItems:'center',gap:10,flexWrap:'wrap'},
  icon:{width:44,height:44,borderRadius:14,backgroundColor:'#dff0e2',alignItems:'center',justifyContent:'center'},
  eyebrow:{fontSize:12,fontWeight:'700',color:colors.secondary},heading:{fontSize:17,fontWeight:'700',color:colors.textMain,lineHeight:24},
  badge:{backgroundColor:'#dff0e2',borderRadius:16,paddingHorizontal:10,paddingVertical:6},badgeText:{fontSize:12,fontWeight:'700',color:colors.primary},
  product:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:10,padding:12,borderRadius:12,backgroundColor:'#fff',borderWidth:1,borderColor:colors.borderLight},
  productName:{flex:1,minWidth:120,fontSize:14,lineHeight:22,color:colors.textMain},quantity:{fontSize:14,lineHeight:22,fontWeight:'700',color:colors.primary},
  nutrients:{flexDirection:'row',gap:8},nutrient:{flex:1,gap:3,padding:10,borderRadius:12,backgroundColor:'#e5f1e7'},link:{minHeight:44,flexDirection:'row',alignItems:'center',gap:8},
});
