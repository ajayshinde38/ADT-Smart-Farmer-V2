import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { freshWeather, shortDate } from '../utils/farmPresentation';
import { WeatherData } from '../types';
export const CropWatchCard = ({ data, language, onScan, selectedDate }: { selectedDate?: string; data: WeatherData; language: 'en' | 'mr'; onScan?: () => void }) => {
  const mr = language === 'mr';
  const [expanded, setExpanded] = useState(false);
  const [now,setNow] = useState(Date.now());
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(timer);},[]);
  const day = selectedDate || new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const checks = data.crop_watch_outlook?.find(item => item.date === day)?.checks || (!selectedDate ? data.crop_watch : undefined);
  if (!checks?.length) return null;
  const stale = !freshWeather(data,now);
  const matches = checks.filter(item => item.criteria_tested >= 2 && (item.score ?? 0) >= 50 && item.stage_eligible !== false)
    .sort((a,b) => (b.score ?? 0)-(a.score ?? 0)).slice(0,3);
  const names: Record<string,string> = { D7:'कांडी कूज', P4:'हुमणी', D2:'तांबेरा', D4:'काणी', D1:'पोक्का बोईंग', P2:'शेंडा पोखरणारी अळी', D3:'लाल कूज', P7:'पिठ्या ढेकूण' };
  const symptoms: Record<string,string> = { D7:'उगवण कमी होणे किंवा कुजलेल्या कांड्या तपासा.', P4:'वाळणाऱ्या बेटांच्या मुळांजवळ हुमणी तपासा.', D2:'पानांवर तांबूस पुटकुळ्या तपासा.', D4:'काळ्या चाबकासारखी वाढ तपासा.', D1:'वाकडी, पिवळसर कोवळी पाने तपासा.', P2:'शेंड्यात छिद्रे व वाळलेला गाभा तपासा.', D3:'कांडीत लालसर रंग व पांढरे पट्टे तपासा.', P7:'पानांच्या आवरणाखाली पांढरे ढेकूण तपासा.' };
  const cues: Record<string,string> = {
    D7:'Check poorly germinated or rotting setts.', P4:'Check roots around wilting cane for C-shaped grubs.',
    D2:'Look for reddish-brown pustules on leaves.', D4:'Look for black whip-like growth at the shoot tip.',
    D1:'Check twisted, yellowing young leaves and the growing point.', P2:'Check shoot holes and dead central shoots.',
    D3:'Inspect affected stalks for red tissue with white patches.', P7:'Check under leaf sheaths for white, waxy insects.',
  };
  const unknownStage = checks.some(item => item.stage_eligible == null);
  return <View style={styles.card}>
    <Text style={styles.title}>{mr ? 'कीड व रोगांवर लक्ष ठेवा' : 'Crop watch'} · {shortDate(day, language)}</Text>
    <Text style={styles.text}>{mr ? 'हवामानावर आधारित तपासणी; रोगाचे निदान नाही.' : 'Weather-based scouting, separate from a photo diagnosis.'}</Text>
    {stale ? <Text style={styles.text}>{mr ? 'हवामान जुने आहे. नवीन माहिती मिळाल्यावर तपासा.' : 'Weather is outdated. Refresh weather before using crop-watch guidance.'}</Text> : matches.length ? matches.map(item => <View key={item.rule_id} style={styles.item}>
      <Text style={styles.name}>{mr ? names[item.rule_id] || item.name : item.name.split(' (')[0]}</Text>
      <Text style={styles.text}>{mr ? symptoms[item.rule_id] : expanded ? item.symptoms : cues[item.rule_id]}</Text>
    </View>) : <Text style={styles.text}>{mr ? 'सध्याच्या उपलब्ध हवामानात ठळक जुळणारे संकेत नाहीत. नियमित शेत तपासा.' : 'No strong weather match in the available checks. Continue routine field inspection.'}</Text>}
    {unknownStage && <Text style={styles.note}>{mr ? 'पिकाची अवस्था नोंदलेली नाही; मार्गदर्शन मर्यादित आहे.' : 'Crop stage is not recorded, so guidance is limited.'}</Text>}
    {onScan && <TouchableOpacity accessibilityRole="button" style={styles.action} onPress={onScan}><Text style={styles.actionText}>{mr ? 'पिकाचा फोटो तपासा' : 'Check a crop photo'} →</Text></TouchableOpacity>}
    <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(x=>!x)} style={styles.info}><Text style={styles.note}>{mr ? 'हे कसे ठरवले?' : 'How this is checked'} {expanded ? '−' : '+'}</Text></TouchableOpacity>
    {expanded && <Text style={styles.note}>{mr ? 'संदर्भातील आठ नियम वापरून तापमान व आर्द्रता तपासली जाते. पानांचा ओलावा मोजलेला नाही. पावसाच्या नियमांचा कालावधी निश्चित नसल्याने तो वगळला आहे. हे रोग होण्याची टक्केवारी नाही. फक्त हवामान पाहून फवारणी करू नका.' : 'Uses eight rules from the reference project with forecast temperature and humidity. Leaf wetness is unmeasured; rainfall thresholds with unspecified time periods are excluded. This is not disease probability. Do not spray based only on weather.'}</Text>}
  </View>;
};
const styles=StyleSheet.create({card:{backgroundColor:'#edf4ee',padding:16,borderRadius:18,gap:10}, title:{fontSize:18,fontWeight:'700',color:'#204b32'},text:{fontSize:14,lineHeight:21,color:'#405b49'},item:{paddingVertical:10,borderTopWidth:1,borderColor:'#d8e5db',gap:4},name:{fontSize:16,fontWeight:'600',color:'#204b32'},note:{fontSize:12,lineHeight:19,color:'#5d7163'},action:{padding:12,minHeight:44,backgroundColor:'#185b35',borderRadius:12,alignItems:'center'},actionText:{color:'#fff',fontSize:15,fontWeight:'600'},info:{minHeight:44,justifyContent:'center'}});
