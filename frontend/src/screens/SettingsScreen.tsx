import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { FarmerProfile, FieldContext } from '../types';
import { ApiClient } from '../services/apiClient';
import { shortDate, stageLabel } from '../utils/farmPresentation';
interface Props { farmer:FarmerProfile; language:'en'|'mr'; onToggleLanguage:(lang:'en'|'mr')=>void; onLogout:()=>void }
export const SettingsScreen:React.FC<Props> = ({farmer,language,onToggleLanguage,onLogout}) => {
  const mr=language==='mr';
  const [context,setContext]=useState<FieldContext|null>(null);
  useEffect(()=>{let active=true;setContext(null);if(farmer.farm_id) ApiClient.getDashboard(farmer.farm_id).then(value=>{if(active)setContext(value.field_context);}).catch(()=>{});return()=>{active=false;};},[farmer.farm_id]);
  const rows=[
    [mr?'क्षेत्रफळ':'Farm area',`${farmer.farm_area_acres ?? '—'} ${mr?'एकर':'acres'}`],
    [mr?'गाव':'Village',farmer.village || '—'],
    [mr?'मोबाईल':'Mobile',farmer.mobile],
    [mr?'नोंदणी क्रमांक':'PRN',farmer.prn || '—'],
    [mr?'लागवड तारीख':'Planting date',shortDate(context?.crop.plantation_date,language)],
    [mr?'पिकाची अवस्था':'Crop stage',stageLabel(context?.crop.stage,language)],
  ];
  return <ScrollView style={styles.container} contentContainerStyle={styles.content}>
    <Text style={styles.title}>{mr?'शेताची माहिती':'Farm details'}</Text><Text style={styles.name}>{farmer.name}</Text>
    <View style={styles.card}>{rows.map(([label,value])=><View key={label} style={styles.row}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View>)}</View>
    {context?.crop.stage_source==='planting_date_estimate' && <Text style={styles.note}>{mr?'अवस्था लागवड तारखेवरून अंदाजित आहे. शेतात खात्री करा.':'Stage is estimated from planting date. Confirm it in the field.'}</Text>}
    <Text style={styles.note}>{mr?'रिकाम्या नोंदी अद्याप उपलब्ध नाहीत. चुकीची नोंद असल्यास ADT टीमशी संपर्क करा.':'Missing records have not been supplied. Contact the ADT team to correct farm details.'}</Text>
    <View style={styles.card}><Text style={styles.name}>{mr?'भाषा':'Language'}</Text><View style={styles.languages}>{(['en','mr'] as const).map(lang=><TouchableOpacity key={lang} accessibilityRole="button" accessibilityState={{selected:language===lang}} style={[styles.button,language===lang && styles.selected]} onPress={()=>onToggleLanguage(lang)}><Text style={{color:language===lang?'#fff':'#285139'}}>{lang==='en'?'English':'मराठी'}</Text></TouchableOpacity>)}</View></View>
    <TouchableOpacity accessibilityRole="button" onPress={onLogout} style={styles.logout}><Text style={{color:'#943d35',fontWeight:'600'}}>{mr?'बाहेर पडा':'Sign out'}</Text></TouchableOpacity>
  </ScrollView>;
};
const styles=StyleSheet.create({container:{flex:1,backgroundColor:'#f7faf7'},content:{padding:18,paddingBottom:28,gap:16,width:'100%',maxWidth:800,alignSelf:'center'},title:{fontSize:23,fontWeight:'700',color:'#20432e'},name:{fontSize:17,fontWeight:'600',color:'#294a37'},card:{padding:18,borderRadius:18,backgroundColor:'#fff',gap:12},row:{gap:4,paddingVertical:8,borderBottomWidth:1,borderColor:'#edf2ec'},label:{fontSize:12,color:'#6d7d71'},value:{fontSize:16,color:'#294a37'},note:{fontSize:13,lineHeight:21,color:'#6d7d71'},languages:{flexDirection:'row',gap:12},button:{flex:1,minHeight:48,alignItems:'center',justifyContent:'center',borderRadius:12,backgroundColor:'#edf3e9'},selected:{backgroundColor:'#24593b'},logout:{minHeight:48,alignItems:'center',justifyContent:'center',backgroundColor:'#f9eae6',borderRadius:12}});
