// Isolated component preview: synthetic schedule, no credentials or live API calls.
import React,{useState} from 'react';
import {registerRootComponent} from 'expo';
import {ScrollView,View,TouchableOpacity,Text} from 'react-native';
import {ActiveDoseBanner} from './src/components/ActiveDoseBanner';
import {ActiveFertigationTable} from './src/components/ActiveFertigationTable';
import {FertilizerWelcomeModal} from './src/components/FertilizerWelcomeModal';
import {ApiClient} from './src/services/apiClient';
const dose:any={dap:120,period:'120 DAP',application_date:'05-Nov-2026',products:[{fertilizer:'Ammonium Sulphate',quantity:79.4,unit:'kg',water_liters:100},{fertilizer:'09:24:24',quantity:47.6,unit:'kg'},{fertilizer:'Muriate of Potash',quantity:51.3,unit:'kg'},{fertilizer:'Poly Sulphate',quantity:28.5,unit:'kg'}],target_n:21,target_p:11,target_k:46,applied:false};
const schedule:any={active_upcoming_dose:dose,farmer_periods:[{...dose,dap:110,period:'110 DAP',applied:true},dose],area_acre:1.03,applied_till_date:{N:46,P:24,K:16},bounded_target_kg_acre:{N:192,P:78,K:82}};
ApiClient.getFertigationSchedule=async()=>schedule;
function Preview(){const[language,setLanguage]=useState<'en'|'mr'>('mr'),[popup,setPopup]=useState(false);return <View style={{flex:1,backgroundColor:'#f7faf7'}}><ScrollView contentContainerStyle={{padding:16,gap:16,maxWidth:700,width:'100%',alignSelf:'center'}}><Text>Component preview · synthetic data</Text><View style={{flexDirection:'row',gap:12}}><TouchableOpacity onPress={()=>setLanguage(v=>v==='mr'?'en':'mr')}><Text>English / मराठी</Text></TouchableOpacity><TouchableOpacity onPress={()=>setPopup(v=>!v)}><Text>Show welcome popup</Text></TouchableOpacity></View><ActiveDoseBanner dose={dose} farmArea={1.03} language={language} onToggleApplied={async()=>{}}/><ActiveFertigationTable schedule={schedule} farmArea={1.03} language={language} onToggleApplied={async()=>{}}/></ScrollView>{popup&&<FertilizerWelcomeModal farmer={{farm_id:'synthetic-preview',name:'Component preview'} as any} language={language} onAdvisory={()=>setPopup(false)}/>}</View>};
registerRootComponent(Preview);
