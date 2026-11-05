import React,{useEffect,useState} from 'react';
import {View,Modal,ScrollView,TouchableOpacity,ActivityIndicator,StyleSheet} from 'react-native';
import {AppText as Text,Icon,ui} from './ui';
import {ActiveDoseBanner} from './ActiveDoseBanner';
import {ApiClient} from '../services/apiClient';
import {FarmerProfile,FertigationScheduleData} from '../types';
import {colors} from '../theme/colors';

export const FertilizerWelcomeModal=({farmer,language,onAdvisory}:{farmer:FarmerProfile;language:'en'|'mr';onAdvisory:()=>void})=>{
  const mr=language==='mr';
  const [visible,setVisible]=useState(true),[busy,setBusy]=useState(true),[failed,setFailed]=useState(false);
  const [schedule,setSchedule]=useState<FertigationScheduleData|null>(null),[retry,setRetry]=useState(0);
  useEffect(()=>{setVisible(true);},[farmer.farm_id]);
  useEffect(()=>{
    let active=true;setSchedule(null);setBusy(true);setFailed(false);
    if(!farmer.farm_id){setBusy(false);return;}
    ApiClient.getFertigationSchedule(farmer.farm_id).then(value=>{if(active)setSchedule(value);})
      .catch(()=>{if(active)setFailed(true);}).finally(()=>{if(active)setBusy(false);});
    return()=>{active=false;};
  },[farmer.farm_id,retry]);
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={()=>setVisible(false)}>
    <View style={styles.shade}><View style={styles.card} accessibilityViewIsModal>
      <View style={styles.header}><View style={styles.icon}><Icon name="grass" color={colors.primary} size={25}/></View><View style={{flex:1}}><Text style={ui.heading}>{mr?'तुमचा खत सल्ला':'Your fertilizer advice'}</Text><Text style={ui.note}>{farmer.name}</Text></View><TouchableOpacity accessibilityRole="button" accessibilityLabel={mr?'बंद करा':'Close fertilizer advice'} onPress={()=>setVisible(false)} style={styles.close}><Icon name="close" color={colors.textSecondary}/></TouchableOpacity></View>
      <ScrollView contentContainerStyle={{gap:14,paddingBottom:8}}>
        {busy?<View style={{padding:24,gap:12,alignItems:'center'}}><ActivityIndicator color={colors.primary}/><Text style={ui.note}>{mr?'तुमच्या शेताचा सल्ला मिळवत आहे…':'Loading advice for your farm…'}</Text></View>:failed?<View style={{gap:12}}><Text accessibilityRole="alert" style={ui.body}>{mr?'खत सल्ला मिळाला नाही. पुन्हा प्रयत्न करा.':'Fertilizer advice could not be loaded. Please retry.'}</Text><TouchableOpacity accessibilityRole="button" onPress={()=>setRetry(x=>x+1)} style={ui.secondary}><Text style={{padding:14,color:colors.primary}}>{mr?'पुन्हा प्रयत्न करा':'Try again'}</Text></TouchableOpacity></View>:schedule?.active_upcoming_dose?<ActiveDoseBanner dose={schedule.active_upcoming_dose} farmArea={schedule.area_acre} language={language}/>:<Text style={ui.body}>{mr?'या शेतासाठी सध्या कोणताही सक्रिय खत हप्ता उपलब्ध नाही. सल्ला विभागात वेळापत्रक व पिकाची माहिती तपासा.':'No active fertilizer dose is available for this farm. Open Advisory to review the schedule and crop details.'}</Text>}
      </ScrollView>
      <TouchableOpacity accessibilityRole="button" onPress={()=>{setVisible(false);onAdvisory();}} style={ui.button}><Text style={styles.white}>{mr?'संपूर्ण खत सल्ला पहा':'View full advisory'}</Text><Icon name="arrow-forward" color="#fff"/></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" onPress={()=>setVisible(false)} style={styles.dismiss}><Text style={{color:colors.textSecondary,fontSize:14}}>{mr?'नंतर पाहू':'Continue to dashboard'}</Text></TouchableOpacity>
    </View></View>
  </Modal>;
};
const styles=StyleSheet.create({shade:{flex:1,backgroundColor:'#102b1b77',justifyContent:'center',alignItems:'center',padding:20},card:{width:'100%',maxWidth:520,maxHeight:'88%',backgroundColor:'#fff',borderRadius:24,padding:20,gap:16,...colors.cardShadow},header:{flexDirection:'row',alignItems:'center',gap:10},icon:{width:46,height:46,borderRadius:15,backgroundColor:'#e6f3e8',alignItems:'center',justifyContent:'center'},close:{width:44,height:44,alignItems:'center',justifyContent:'center'},dismiss:{minHeight:44,justifyContent:'center',alignItems:'center'},white:{color:'#fff',fontSize:15,fontWeight:'700'}});
