import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { ApiClient } from '../services/apiClient';
import { FarmerProfile, FieldContext, GISData, WeatherData } from '../types';
import { FieldConnections } from '../components/FieldConnections';
import { conditionLabel, freshWeather, shortDate } from '../utils/farmPresentation';
interface Props { farmer:FarmerProfile; language:'en'|'mr'; onNavigate:(tab:string)=>void }
export const DashboardScreen:React.FC<Props>=({farmer,language,onNavigate})=>{
  const mr=language==='mr';
  const [data,setData]=useState<{gis?:GISData;weather?:WeatherData;field_context?:FieldContext}|null>(null);
  const [loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false),[error,setError]=useState(false);
  const request=useRef(0);
  const load=async()=>{
    const version=++request.current; setError(false);
    if (!farmer.farm_id) { setLoading(false); return; }
    try { const next=await ApiClient.getDashboard(farmer.farm_id); if(version===request.current)setData(next); }
    catch { if(version===request.current)setError(true); }
    finally { if(version===request.current){setLoading(false);setRefreshing(false);} }
  };
  useEffect(()=>{setData(null);setLoading(true);void load();return()=>{request.current++;};},[farmer.farm_id]);
  const [now,setNow]=useState(Date.now());
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(timer);},[]);
  if(loading)return <View style={styles.center}><ActivityIndicator color="#246440"/></View>;
  const weather=data?.weather,plot=data?.gis,context=data?.field_context;
  const measured=!!plot?.indices?.capture_date && typeof plot?.indices.ndvi==='number' && Number.isFinite(plot.indices.ndvi);
  const steps=context?.next_steps.slice(0,3)||[];
  const today=new Date(now).toLocaleDateString(mr?'mr-IN':'en-IN',{timeZone:'Asia/Kolkata',weekday:'long',day:'numeric',month:'short'});
  return <ScrollView style={styles.container} contentContainerStyle={styles.content}
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);void load();}}/>}>
    <View style={styles.heading}><View><Text style={styles.eyebrow}>{today}</Text><Text style={styles.title}>{mr?'आजचे शेत':'Your farm today'}</Text></View>
      <Text style={styles.area}>{farmer.farm_area_acres ?? '—'} {mr?'एकर':'acres'}</Text></View>
    {error&&<TouchableOpacity style={styles.notice} onPress={()=>{setRefreshing(true);void load();}}><Text style={styles.body}>{mr?'माहिती मिळाली नाही. पुन्हा प्रयत्न करा.':'Unable to update your farm. Tap to try again.'}</Text></TouchableOpacity>}
    <View style={styles.grid}>
      <TouchableOpacity style={styles.farmCard} onPress={()=>onNavigate('gis')} accessibilityRole="button">
        <View style={styles.cardTop}><Text style={styles.lightLabel}>{mr?'माझे शेत':'MY FARM'}</Text><Text style={styles.lightArrow}>↗</Text></View>
        <Text style={styles.farmNumber}>{measured?plot!.indices.ndvi!.toFixed(2):'—'}</Text>
        <Text style={styles.lightBody}>{measured?(mr?'पिकाचा हिरवेपणा':'Crop greenness'):(mr?'शेताचा नकाशा पाहा':'Explore your farm map')}</Text>
        <Text style={styles.lightNote}>{measured?`${mr?'निरीक्षण':'Observed'} ${shortDate(plot?.indices.capture_date,language)}`:(mr?'उपग्रह निरीक्षण अद्याप उपलब्ध नाही.':'Crop observations are not available yet.')}</Text>
        <View style={styles.mapLink}><Text style={styles.lightBody}>{mr?'नकाशा उघडा':'Open farm map'} →</Text></View>
      </TouchableOpacity>
      <TouchableOpacity style={styles.weatherCard} onPress={()=>onNavigate('weather')} accessibilityRole="button">
        <View style={styles.cardTop}><Text style={styles.eyebrow}>{mr?'हवामान':'WEATHER'}</Text><Text style={styles.weatherIcon}>{weather?.current_icon||'🌦️'}</Text></View>
        <Text style={styles.temp}>{weather?.current_temp_c ?? '—'}<Text style={styles.unit}>°C</Text></Text>
        <Text style={styles.body}>{conditionLabel(weather?.current_condition,language)}</Text>
        <Text style={styles.small}>{weather?`${mr?'पाऊस':'Rain'} ${weather.forecast_7_day?.[0]?.precipitation_probability ?? '—'}% · ${weather.forecast_7_day?.[0]?.rainfall_mm ?? '—'} mm`:(mr?'नवीन हवामान तपासा':'Check the latest weather')}</Text>
        {weather&&!freshWeather(weather,now)&&<Text style={styles.warning}>{mr?'ही माहिती जुनी असू शकते.':'This information may be outdated.'}</Text>}
        <Text style={styles.weatherLink}>{mr?'संपूर्ण अंदाज':'Full forecast'} →</Text>
      </TouchableOpacity>
    </View>
    <View style={styles.quickRow}>{[
      ['pest','🍃',mr?'पीक तपासणी':'Check crop'],['advisory','🌱',mr?'माती व खते':'Soil & nutrients'],['settings','⚙',mr?'शेताची माहिती':'Farm details'],
    ].map(([tab,icon,label])=><TouchableOpacity key={tab} style={styles.quick} onPress={()=>onNavigate(tab)} accessibilityRole="button"><Text style={styles.quickIcon}>{icon}</Text><Text style={styles.quickLabel}>{label}</Text></TouchableOpacity>)}</View>
    {!!steps.length&&<View style={styles.steps}><Text style={styles.section}>{mr?'पुढील उपयोगी पाऊल':'What to check next'}</Text>
      {steps.map((step,i)=><TouchableOpacity key={step.code} style={styles.step} onPress={()=>onNavigate(step.target)} accessibilityRole="button"><Text style={styles.stepNumber}>{i+1}</Text><Text style={styles.stepText}>{mr?step.text_mr:step.text_en}</Text><Text style={styles.arrow}>›</Text></TouchableOpacity>)}
    </View>}
    <Text style={styles.section}>{mr?'या शेतासाठी उपलब्ध माहिती':'Connected to your farm'}</Text>
    <FieldConnections context={context} language={language}/>
    <Text style={styles.small}>{mr?'उपग्रह, हवामान व फोटो वेगवेगळे संकेत देतात. खत किंवा उपचार ठरवण्यापूर्वी शेतात खात्री करा.':'Satellite, weather and photos offer different clues. Confirm field conditions before deciding on nutrients or treatment.'}</Text>
  </ScrollView>;
};
const styles=StyleSheet.create({container:{flex:1,backgroundColor:'#f5f7f2'},content:{padding:18,paddingBottom:32,gap:18,width:'100%',maxWidth:1060,alignSelf:'center'},center:{flex:1,alignItems:'center',justifyContent:'center'},heading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},eyebrow:{fontSize:12,color:'#6b7c70',fontWeight:'600'},title:{fontSize:26,fontWeight:'700',color:'#1c3c2a',marginTop:5},area:{fontSize:13,color:'#486451',backgroundColor:'#e7eee4',padding:10,borderRadius:18},grid:{flexDirection:'row',flexWrap:'wrap',gap:14},farmCard:{flex:1,flexBasis:300,minWidth:230,padding:22,borderRadius:24,backgroundColor:'#214c36',gap:7},weatherCard:{flex:1,flexBasis:300,minWidth:230,padding:22,borderRadius:24,backgroundColor:'#f2ead9',gap:7},cardTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},lightLabel:{fontSize:12,letterSpacing:1,color:'#d1e4cf'},lightArrow:{fontSize:23,color:'#e0edda'},farmNumber:{fontSize:48,fontWeight:'600',color:'#fff',marginTop:10},lightBody:{fontSize:16,color:'#edf5e7',lineHeight:23},lightNote:{fontSize:12,color:'#bcd0bc',lineHeight:19},mapLink:{marginTop:12,paddingTop:12,borderTopWidth:1,borderColor:'#52755d'},temp:{fontSize:48,fontWeight:'600',color:'#253c2b'},unit:{fontSize:24},weatherIcon:{fontSize:27},body:{fontSize:16,lineHeight:23,color:'#34503e'},small:{fontSize:12,lineHeight:20,color:'#65796a'},weatherLink:{fontSize:15,color:'#254e35',fontWeight:'600',marginTop:12},quickRow:{flexDirection:'row',gap:10},quick:{flex:1,minHeight:86,justifyContent:'center',alignItems:'center',padding:10,backgroundColor:'#fff',borderRadius:18,gap:8,borderWidth:1,borderColor:'#e5ece3'},quickIcon:{fontSize:23},quickLabel:{fontSize:12,color:'#31533d',fontWeight:'600',textAlign:'center'},steps:{backgroundColor:'#fff',borderRadius:20,padding:16,gap:8},section:{fontSize:17,fontWeight:'600',color:'#294b36'},step:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:12,minHeight:52,borderTopWidth:1,borderColor:'#edf1e9'},stepNumber:{color:'#5e7e64',fontSize:13},stepText:{flex:1,fontSize:14,lineHeight:21,color:'#405c48'},arrow:{fontSize:24,color:'#4d7759'},notice:{padding:16,backgroundColor:'#f8e9d1',borderRadius:14},warning:{fontSize:12,color:'#83521d',lineHeight:18}});
