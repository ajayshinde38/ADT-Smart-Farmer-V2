import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FieldContext } from '../types';
import { shortDate } from '../utils/farmPresentation';
export const FieldConnections = ({ context, language }: { context?: FieldContext | null; language:'en'|'mr' }) => {
  const [now,setNow] = useState(Date.now());
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(timer);},[]);
  if (!context) return null;
  const mr=language==='mr';
  const stamp=Date.parse(context.weather.updated_at || '');
  const fresh=context.weather.fresh && Number.isFinite(stamp) && now>=stamp && now-stamp<=900000;
  const items=[
    [mr?'उपग्रह':'Satellite',context.satellite.available ? shortDate(context.satellite.observed_on,language) : mr?'निरीक्षण नाही':'No observation',context.satellite.available && !context.satellite.historical],
    [mr?'हवामान':'Weather',fresh ? mr?'अद्ययावत':'Up to date' : mr?'पुन्हा तपासा':'Check latest',fresh],
    [mr?'माती अहवाल':'Soil record',context.soil.available ? mr?'उपलब्ध':'Available' : mr?'उपलब्ध नाही':'Not available',context.soil.available],
  ];
  return <View style={styles.row}>{items.map(([label,value,ready])=><View key={String(label)} style={styles.item}>
    <View style={styles.labelRow}><View style={[styles.dot,{backgroundColor:ready?'#39805c':'#b59a61'}]}/><Text style={styles.label}>{label}</Text></View>
    <Text style={styles.value}>{value}</Text>
  </View>)}</View>;
};
const styles=StyleSheet.create({row:{flexDirection:'row',flexWrap:'wrap',gap:12,padding:14,backgroundColor:'#fff',borderRadius:16,borderWidth:1,borderColor:'#e3ebe5'},item:{flex:1,minWidth:78,gap:5},labelRow:{flexDirection:'row',alignItems:'center',gap:5},dot:{width:6,height:6,borderRadius:3},label:{fontSize:11,color:'#697b70'},value:{fontSize:13,fontWeight:'600',color:'#294a37'}});
