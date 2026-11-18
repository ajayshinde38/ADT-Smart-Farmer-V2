import React, {useEffect, useRef, useState} from 'react';
import {View, TouchableOpacity, Modal, Alert, StyleSheet, RefreshControl, ScrollView} from 'react-native';
import {FarmPage} from '../components/FarmPage';
import {AppText as Text, Icon, Card, amount, ui} from '../components/ui';
import {FieldConnections} from '../components/FieldConnections';
import {DiseaseGuidance} from '../components/DiseaseGuidance';
import {ActiveDoseBanner} from '../components/ActiveDoseBanner';
import {ActiveFertigationTable} from '../components/ActiveFertigationTable';
import {ApiClient} from '../services/apiClient';
import {AdvisoryData, FarmerProfile, WeatherData, ScanRecord, DiseaseDetectionResult, FieldContext, FertigationScheduleData} from '../types';
import {freshWeather, stageLabel} from '../utils/farmPresentation';

type Guidance = NonNullable<DiseaseDetectionResult['disease_details']>;
export const AdvisoryScreen = ({farmer, language, onScan}: {farmer:FarmerProfile; language:'en'|'mr'; onScan?:()=>void}) => {
  const mr=language==='mr';
  const [data,setData]=useState<AdvisoryData|null>(null), [weather,setWeather]=useState<WeatherData|null>(null);
  const [context,setContext]=useState<FieldContext|null>(null), [scan,setScan]=useState<ScanRecord|null>(null);
  const [guidance,setGuidance]=useState<Guidance|null>(null), [historyAvailable,setHistoryAvailable]=useState(false);
  const [scanAnalysis,setScanAnalysis]=useState<DiseaseDetectionResult|null>(null);
  const [fertSchedule, setFertSchedule] = useState<FertigationScheduleData | null>(null);
  const [busy,setBusy]=useState(true), [error,setError]=useState(''), [retry,setRetry]=useState(0), [modal,setModal]=useState(false);
  const generation=useRef(0);

  useEffect(()=>{
    const request=++generation.current;
    setData(null);setWeather(null);setContext(null);setScan(null);setGuidance(null);setScanAnalysis(null);setHistoryAvailable(false);setModal(false);setFertSchedule(null);setBusy(true);setError('');
    if(!farmer.farm_id){setBusy(false);return;}
    Promise.allSettled([ApiClient.getDashboard(farmer.farm_id),ApiClient.getScanHistory(farmer.farm_id)]).then(async ([dashboard,history])=>{
      if(request!==generation.current)return;
      if(dashboard.status==='fulfilled'){
        setData(dashboard.value.advisory);
        setWeather(dashboard.value.weather);
        setContext(dashboard.value.field_context);
        const sched = dashboard.value.advisory?.schedule || (dashboard.value.advisory?.planning as any)?.fertigation_schedule;
        if (sched) {
          setFertSchedule(sched);
        } else if (farmer.farm_id) {
          void ApiClient.getFertigationSchedule(farmer.farm_id)
            .then(s => {
              if (request === generation.current) setFertSchedule(s);
            })
            .catch(() => {});
        }
      }
      else setError(mr?'शेताची माहिती मिळाली नाही. पुन्हा प्रयत्न करा.':'Farm information could not be loaded. Please refresh.');
      if(history.status==='fulfilled'){
        setHistoryAvailable(history.value.available);
        const latest=history.value.items[0] || null;setScan(latest);
        if(latest&&farmer.farm_id){
          void ApiClient.getScanAnalysis(farmer.farm_id,latest.id).then(saved=>{
            if(request===generation.current)setScanAnalysis(saved.analysis);
          }).catch(()=>{});
        }
        if(latest?.status==='disease_detected'){
          try {const details=await ApiClient.getDiseaseDetail(latest.detected_disease);if(request===generation.current)setGuidance(details);}
          catch { /* Keep the saved result visible; do not invent missing catalog guidance. */ }
        }
      }
      if(request===generation.current)setBusy(false);
    });
    return()=>{generation.current++;};
  },[farmer.farm_id,retry,language]);

  const handleToggleApplied = async (period: string, currentlyApplied: boolean) => {
    if (!farmer.farm_id) return;
    try {
      const res = await ApiClient.confirmScheduleDose(farmer.farm_id, period, !currentlyApplied);
      if (res && res.schedule) {
        setFertSchedule(res.schedule);
      }
    } catch (e) {
      console.warn('Failed to toggle applied dose', e);
      throw e;
    }
  };

  const irrigation=weather?.irrigation;
  const fresh=!!weather && freshWeather(weather,Date.now());
  const waterReady=fresh && irrigation && Number.isFinite(irrigation.net_irrigation_mm_day) && !!data?.area_acres;
  const detected=scan?.status==='disease_detected';
  const title=(en:string,mrText:string)=>mr?mrText:en;
  const metric=(label:string,value:unknown,unitLabel='')=><View style={styles.metric}><Text style={ui.note}>{label}</Text><Text style={styles.value}>{amount(value,1)} {unitLabel}</Text></View>;

  return <FarmPage page="advisory" style={styles.page} contentContainerStyle={styles.content}
    refreshControl={<RefreshControl refreshing={busy} onRefresh={()=>setRetry(x=>x+1)}/>}>
    <View style={ui.row}><Text style={ui.heading}>{title('Advisory','शेती सल्ला')}</Text><TouchableOpacity accessibilityRole="button" onPress={()=>setRetry(x=>x+1)} style={styles.action}><Text>{title('Refresh','पुन्हा तपासा')}</Text></TouchableOpacity></View>
    {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {busy&&<View accessibilityLabel="Loading farm guidance" style={{gap:12}}>{[1,2,3].map(i=><View key={i} style={styles.skeleton}/>)}</View>}
    <Card>
      <Text style={styles.section}><Icon name="water-drop"/> 1. {title('Irrigation','सिंचन')}</Text>
      <Text style={styles.status}>{waterReady?title('Modeled water requirement','हवामानावर आधारित पाण्याचा अंदाज'):title('Insufficient data','अपुरेशी माहिती')}</Text>
      <Text style={ui.body}>{waterReady?title('Use this planning estimate with an actual soil-moisture check.','हा अंदाज वापरण्यापूर्वी शेतातील मातीचा ओलावा तपासा.'):title('A recent forecast, valid farm area and crop assumptions are needed. Refresh weather and verify the farm record.','नवीन हवामान अंदाज, शेताचे क्षेत्र व पिकाची माहिती आवश्यक आहे.')}</Text>
      <View style={styles.grid}>{metric(title('Net water estimate','निव्वळ पाण्याची गरज'),waterReady?irrigation?.net_irrigation_mm_day:null,'mm/day')}{metric(title('Whole farm','संपूर्ण शेत'),waterReady?irrigation?.water_required_liters:null,'L')}{metric('ET₀',fresh?weather?.current_et0_mm:null,'mm/day')}{metric(title('Forecast rainfall today','आजचा अंदाजित पाऊस'),fresh?weather?.forecast_7_day?.[0]?.rainfall_mm:null,'mm')}</View>
      <Text style={ui.note}>{title('Farm area','शेताचे क्षेत्र')}: {amount(data?.area_acres,2)} acres · {stageLabel(irrigation?.crop_stage,language)}</Text>
      <Text style={ui.note}>{title('Forecast timestamp','अंदाजाची वेळ')}: {weather?.last_updated_utc?new Date(weather.last_updated_utc).toLocaleString(mr?'mr-IN':'en-IN',{timeZone:'Asia/Kolkata'}):'—'} · {fresh?title('Recent','अद्ययावत'):title('Unavailable or stale','माहिती नाही किंवा जुनी आहे')}</Text>
      <Text style={ui.note}>{irrigation?.assumptions_note || title('Irrigation assumptions unavailable. No pump command or measured soil moisture is available.','सिंचनाची गृहीतके उपलब्ध नाहीत. पंप नियंत्रण किंवा मातीतील ओलाव्याची मोजणी उपलब्ध नाही.')}</Text>
      <Text style={ui.note}>{title('Forecast rain is deducted using the backend effective-rainfall assumption. ET₀ is reference atmospheric demand, not itself an irrigation dose.','प्रभावी पावसाच्या गृहीतकानुसार पाऊस विचारात घेतला आहे. ET₀ हा थेट सिंचनाचा आदेश नाही.')}</Text>
    </Card>
    <Card>
      <Text style={styles.section}><Icon name="grass"/> 2. {title('Fertilizer & Fertigation Advisory','खते व फर्टीगेशन सल्ला')}</Text>
      <Text style={styles.status}>{fertSchedule?.active_upcoming_dose ? title('FertiNex STCR Precision Fertigation Schedule', 'FertiNex अचूक फर्टीगेशन वेळापत्रक') : (data?.rdf ? title('STCR reference estimate','STCR संदर्भ अंदाज') : title('Insufficient data','अपुरेशी माहिती'))}</Text>

      {/* 1. Active Dose Highlight Banner */}
      <ActiveDoseBanner
        dose={fertSchedule?.active_upcoming_dose || null}
        farmArea={farmer.farm_area_acres || fertSchedule?.area_acre || 0}
        language={language}
        onToggleApplied={handleToggleApplied}
      />

      {/* 2. Active Fertigation Table */}
      <ActiveFertigationTable
        schedule={fertSchedule}
        farmArea={farmer.farm_area_acres || fertSchedule?.area_acre || 0}
        language={language}
        onToggleApplied={handleToggleApplied}
      />
    </Card>
    <Card>
      <Text style={styles.section}><Icon name="health-and-safety"/> 3. {title('Spraying / Disease Management','फवारणी / रोग व्यवस्थापन')}</Text>
      <Text style={ui.section}>{title('Crop Check Guidance','पीक तपासणी मार्गदर्शन')} · {farmer.name}</Text>
      {!historyAvailable?<Text style={ui.body}>{title('Private scan history is unavailable. Refresh to retry; no spraying prescription can be given.','खासगी तपासणी इतिहास उपलब्ध नाही. पुन्हा प्रयत्न करा.')}</Text>:!scan?<Text style={ui.body}>{title('No AI Scan result is available for this farm. Complete a leaf scan to receive disease-based guidance.','या शेताची AI तपासणी उपलब्ध नाही. रोगाशी संबंधित मार्गदर्शनासाठी पानाचा फोटो तपासा.')}</Text>:<>
        <Text style={ui.note}>{title('Last AI Scan','शेवटची AI तपासणी')}: {new Date(scan.created_at).toLocaleString(mr?'mr-IN':'en-IN',{timeZone:'Asia/Kolkata'})}</Text>
        <Text style={styles.status}>{detected?scan.detected_disease:title('No confirmed spraying indication','फवारणीचा निश्चित संकेत नाही')}</Text>
        <Text style={ui.body}>{title('Model match','मॉडेल जुळणी')}: {amount(scan.confidence_score*100,0)}% · {title('Affected image area','चित्रातील बाधित भाग')}: {amount(scan.affected_percentage,1)}%</Text>
        <Text style={ui.note}>{title('Severity','तीव्रता')}: {scan.severity_level} · {scan.status}</Text>
        <Text style={ui.body}>{title('Verify Finding','प्रत्यक्ष लक्षणांची पडताळणी करा')}: {title('A saved model result is not a confirmed field diagnosis. No supported detection does not establish a healthy crop.','मॉडेलचा निकाल म्हणजे निश्चित निदान नाही. रोग आढळला नाही म्हणजे पीक निरोगी असल्याची खात्री नाही.')}</Text>
        {detected&&<Text style={ui.body}>{title('Quick Advice','त्वरित सल्ला')}: {guidance?(mr?guidance.prevention_mr:guidance.prevention):title('Catalog guidance unavailable. Consult an agronomist.','रोग मार्गदर्शन उपलब्ध नाही. कृषितज्ज्ञांचा सल्ला घ्या.')}</Text>}
      </>}
      {detected&&guidance&&<TouchableOpacity accessibilityRole="button" onPress={()=>setModal(true)} style={styles.primary}><Text style={styles.white}>{title('View Guidance','तपशील पहा')}</Text></TouchableOpacity>}
      <TouchableOpacity accessibilityRole="button" onPress={()=>Alert.alert(title('Consult Agronomist','कृषितज्ज्ञांचा सल्ला'),title('Show your saved photograph and field symptoms to a local KVK or qualified agronomist. This action does not place a call or book an appointment.','जतन केलेला फोटो व शेतातील लक्षणे स्थानिक KVK किंवा कृषितज्ज्ञांना दाखवा.'))} style={styles.action}><Text>{title('Consult Agronomist','तज्ज्ञांशी बोला')}</Text></TouchableOpacity>
      {!!onScan&&<TouchableOpacity accessibilityRole="button" onPress={onScan} style={styles.primary}><Text style={styles.white}>{title('Complete a leaf scan','पानाची AI तपासणी करा')}</Text></TouchableOpacity>}
    </Card>
    <FieldConnections context={context} language={language}/>
    <Modal visible={modal} transparent animationType="slide" onRequestClose={()=>setModal(false)}>
      <View style={styles.modalShade}><View style={styles.modalCard}>
        <Text style={ui.heading}>{scan?.detected_disease} · {title('Scan Guidance','तपासणी मार्गदर्शन')}</Text>
        <TouchableOpacity accessibilityRole="button" onPress={()=>setModal(false)} style={styles.action}><Text>{title('Close','बंद करा')}</Text></TouchableOpacity>
        <ScrollView style={{flexShrink:1}} contentContainerStyle={{gap:12}}><DiseaseGuidance details={guidance} models={scanAnalysis?.model_results} status={scan?.status} language={language}/></ScrollView>
      </View></View>
    </Modal>
  </FarmPage>;
};
const styles=StyleSheet.create({page:{flex:1,backgroundColor:'#f7faf7'},content:{padding:16,gap:16,paddingBottom:32,maxWidth:960,width:'100%',alignSelf:'center'},section:{fontSize:20,fontWeight:'800',color:'#075b36'},status:{fontSize:16,fontWeight:'700',color:'#286a46'},grid:{flexDirection:'row',flexWrap:'wrap',gap:12},metric:{minWidth:100,flex:1,padding:12,backgroundColor:'#f1f7f2',borderRadius:12,gap:5},value:{fontSize:17,fontWeight:'700',color:'#164a30'},action:{padding:12,minHeight:44,backgroundColor:'#e6f3e8',borderRadius:12},primary:{padding:14,minHeight:48,backgroundColor:'#075b36',borderRadius:12,alignItems:'center'},white:{color:'#fff',fontWeight:'700'},error:{color:'#9a4428',lineHeight:21},skeleton:{height:90,borderRadius:16,backgroundColor:'#e2ebe4'},modalShade:{flex:1,justifyContent:'center',padding:20,backgroundColor:'#0008'},modalCard:{maxHeight:'90%',padding:20,gap:12,backgroundColor:'#fff',borderRadius:20}});
