import React,{useEffect,useState} from 'react';
import { Image,Platform,TouchableOpacity,View } from 'react-native';
import { AppText as Text,Badge,Card,ui,amount } from './ui';
import { API_BASE_URL,ApiClient } from '../services/apiClient';
import { AdminAPI } from '../admin/api';
import { HistoryData } from '../types';
export const RecordedImage=({id,admin=false}:{id:string;admin?:boolean})=>{
 const [uri,setURI]=useState<string|null>(null),[error,setError]=useState(false);
 useEffect(()=>{let active=true,objectURL:string|undefined;setURI(null);setError(false);const path=admin?`/admin/scans/${id}/image`:`/pest-disease/history-image/${id}`;
  if(Platform.OS!=='web'){setURI(API_BASE_URL+path);return;}
  const load=admin?AdminAPI.protectedBlob(`/scans/${id}/image`):ApiClient.image(path);
  load.then(blob=>{if(active){objectURL=URL.createObjectURL(blob);setURI(objectURL);}}).catch(()=>{if(active)setError(true);});
  return()=>{active=false;if(objectURL)URL.revokeObjectURL(objectURL);};
 },[id,admin]);
 return error?<Text style={ui.note}>Recorded image unavailable.</Text>:uri?<Image source={Platform.OS==='web'?{uri}:{uri,headers:{Authorization:`Bearer ${admin?AdminAPI.getToken():ApiClient.getToken()}`}}} style={{height:220,width:'100%',borderRadius:14,backgroundColor:'#eef4ed'}} resizeMode="contain" onError={()=>setError(true)}/>:<Text style={ui.note}>Loading private image…</Text>;
};
export const ScanHistory=({history,language='en',admin=false}:{history:HistoryData;language?:'en'|'mr';admin?:boolean})=>{
 const mr=language==='mr',[image,setImage]=useState<string|null>(null),[limit,setLimit]=useState(8);
 if(!history.available)return <Text style={ui.note}>{mr?'नोंदवलेला तपासणी इतिहास आता उपलब्ध नाही.':'Stored scan history is currently unavailable.'}</Text>;
 if(!history.items.length)return <Text style={ui.note}>{mr?'अद्याप फोटो तपासणीची नोंद नाही.':'No photo analyses have been recorded yet.'}</Text>;
 return <View style={{gap:12}}>{history.items.slice(0,limit).map(row=><Card key={row.id} style={{backgroundColor:'#f7faf6',padding:14}}><View style={ui.row}><Text style={[ui.section,{flex:1}]}>{row.status==='not_detected'?(mr?'समर्थित रोगाचा नमुना आढळला नाही':'No supported pattern detected'):row.detected_disease}</Text><Badge text={row.status||'recorded'} tone={row.status==='disease_detected'?'amber':'gray'}/></View><Text style={ui.note}>{new Date(row.created_at).toLocaleString(mr?'mr-IN':'en-IN',{timeZone:'Asia/Kolkata'})}</Text>{row.status!=='failed'&&<Text style={ui.note}>{mr?'मॉडेल जुळणी':'Model match'} {amount(row.confidence_score*100,0)}% · {mr?'चित्रातील बाधित भाग':'Affected image area'} {amount(row.affected_percentage,1)}%</Text>}{admin&&<Text style={ui.note}>Farmer {row.farmer_id} · Farm {row.farm_id}</Text>}{row.has_image&&<TouchableOpacity accessibilityRole="button" style={{minHeight:44,justifyContent:'center'}} onPress={()=>setImage(image===row.id?null:row.id)}><Text style={{color:'#006e1c',fontWeight:'700'}}>{mr?'नोंदवलेला फोटो':'Recorded image'} {image===row.id?'−':'+'}</Text></TouchableOpacity>}{image===row.id&&<RecordedImage id={row.id} admin={admin}/>}</Card>)}{history.items.length>limit&&<TouchableOpacity accessibilityRole="button" style={{minHeight:44,padding:12}} onPress={()=>setLimit(value=>value+8)}><Text style={{color:'#006e1c'}}>Show more recorded results</Text></TouchableOpacity>}</View>;
};
