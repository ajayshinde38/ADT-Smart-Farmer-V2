import React,{useState} from 'react';
import {registerRootComponent} from 'expo';
import {View,Text,TouchableOpacity,Dimensions} from 'react-native';
import {useFonts} from 'expo-font';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {DashboardScreen} from './src/screens/DashboardScreen';
import {WeatherScreen} from './src/screens/WeatherScreen';
import {PestDetectionScreen} from './src/screens/PestDetectionScreen';
import {GISScreen} from './src/screens/GISScreen';
import {ApiClient} from './src/services/apiClient';
// Isolated synthetic component preview. No credentials, network requests or real farm data.
const weather:any={farm_id:'preview',farmer_name:'Component preview',current_temp_c:28,current_humidity_pct:65,current_condition:'Partly Cloudy',current_wind_speed_kmh:8,current_vpd_kpa:1.32,current_et0_mm:4,apparent_temp_c:29,forecast_timezone:'Asia/Kolkata',last_updated_utc:new Date().toISOString(),forecast_7d_gdd:70,forecast_7_day:Array.from({length:7},(_,i)=>({date:`2026-10-${23+i}`,temp_max_c:30+i%3,temp_min_c:22,rainfall_mm:i%3,precipitation_probability:20,gdd:8,et0_mm:4,weather_condition:'Partly Cloudy',weather_icon:'cloud',vpd_kpa:1.3})),hourly_forecast:[],irrigation:null};
ApiClient.getDashboard=async()=>({farm_id:'preview',weather:null,gis:null,advisory:null,field_context:null} as any);
ApiClient.getWeather=async()=>weather;
ApiClient.getGISPlot=async()=>{throw new Error('Component preview: no geometry or observations')};
ApiClient.detectDisease=async()=>{throw new Error('Preview only: inference disabled')};
ApiClient.getScanHistory=async()=>({available:false,items:[]});
const farmer:any={name:'Component preview',farm_id:'preview',farmer_id:'preview'};
function Preview(){const [screen,setScreen]=useState('Home');const [language,setLanguage]=useState<'en'|'mr'>('en');const [loaded]=useFonts({...MaterialIcons.font,Inter:require('./src/assets/fonts/Inter-400.ttf')});if(!loaded)return null;return <View style={{position:'absolute',height:Dimensions.get('window').height,top:0,bottom:0,left:0,right:0,maxWidth:430,width:'100%',alignSelf:'center'}}><Text style={{padding:10,backgroundColor:'#fff0c2',fontSize:12}}>COMPONENT PREVIEW · synthetic/missing data · no live account</Text><View style={{flexDirection:'row',gap:10,padding:10,flexWrap:'wrap'}}>{['Home','Weather','Scan','GIS'].map(s=><TouchableOpacity key={s} onPress={()=>setScreen(s)}><Text>{s}</Text></TouchableOpacity>)}<TouchableOpacity onPress={()=>setLanguage(language==='en'?'mr':'en')}><Text>EN / मराठी</Text></TouchableOpacity></View>{screen==='Home'?<DashboardScreen farmer={farmer} language={language} onNavigate={setScreen}/>:screen==='Weather'?<WeatherScreen farmer={farmer} language={language}/>:screen==='Scan'?<PestDetectionScreen farmer={farmer} language={language}/>:<GISScreen farmer={farmer} language={language}/>}</View>}
registerRootComponent(Preview);
