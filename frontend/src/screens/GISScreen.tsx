import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, SafeAreaView, useWindowDimensions } from 'react-native';
import { ApiClient } from '../services/apiClient';
import { FarmerProfile, GISData } from '../types';
import { translations } from '../i18n/translations';
import { InteractiveGISMap } from '../components/InteractiveGISMap';
import { hasRasterForIndex } from '../components/gisMapTypes';
import { shortDate } from '../utils/farmPresentation';

interface Props { farmer:FarmerProfile;language:'en'|'mr' }
const labels={ndvi:['Greenness','हिरवेपणा'],evi:['Crop vigour','पिकाची जोमदार वाढ'],ndre:['Leaf greenness','पानांचा हिरवेपणा'],msavi:['Crop cover','पिकाचे आच्छादन'],ndmi:['Crop moisture','पिकातील ओलावा'],ndwi:['Water indicator','पाण्याचा संकेत']};
type IndexKey=keyof typeof labels;
export const GISScreen:React.FC<Props>=({farmer,language})=>{
  const t=translations[language],mr=language==='mr';
  const {height,width}=useWindowDimensions();
  const [data,setData]=useState<GISData|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(false);
  const [retry,setRetry]=useState(0),[selectedIndex,setSelectedIndex]=useState<IndexKey>('ndvi');
  const [overlayVisible,setOverlayVisible]=useState(true),[mapMode,setMapMode]=useState<'A'|'B'>('B');
  const [updating,setUpdating]=useState(false),[updateNotice,setUpdateNotice]=useState('');
  const [showHistory,setShowHistory]=useState(false),[layersOpen,setLayersOpen]=useState(false),[fullScreen,setFullScreen]=useState(false);
  const generation=useRef(0);
  useEffect(()=>{
    const request=++generation.current;setData(null);setLoading(true);setError(false);setSelectedIndex('ndvi');setMapMode('B');setLayersOpen(false);setShowHistory(false);setUpdateNotice('');setUpdating(false);
    if(!farmer.farm_id){setLoading(false);setError(true);return;}
    ApiClient.getGISPlot(farmer.farm_id).then(value=>{if(request===generation.current)setData(value);}).catch(()=>{if(request===generation.current)setError(true);}).finally(()=>{if(request===generation.current)setLoading(false);});
    return()=>{generation.current++;};
  },[farmer.farm_id,retry]);
  const updateObservation=async()=>{
    if(!farmer.farm_id||updating)return;
    const request=generation.current;setUpdating(true);setUpdateNotice('');
    try{const next=await ApiClient.refreshGIS(farmer.farm_id);if(request!==generation.current)return;setData(next);setUpdateNotice(next.indices?.capture_date?(mr?'उपलब्ध निरीक्षण तपासले.':'Available observation checked.'):(mr?'वापरण्यायोग्य निरीक्षण मिळाले नाही.':'No usable observation found in the checked period.'));}
    catch{if(request===generation.current)setUpdateNotice(mr?'उपग्रह माहिती आता मिळाली नाही. सध्याची माहिती जतन आहे.':'Satellite update unavailable. Existing information is preserved.');}
    finally{if(request===generation.current)setUpdating(false);}
  };
  const hasAverage=(key:IndexKey)=>!!data?.indices?.capture_date&&typeof data.indices[key]==='number'&&Number.isFinite(data.indices[key]);
  const hasRaster=(key:IndexKey)=>hasRasterForIndex({activeIndex:key,rasterInfo:data?.raster});
  const available=(Object.keys(labels) as IndexKey[]).filter(key=>hasAverage(key)||hasRaster(key));
  const activeIndex=available.includes(selectedIndex)?selectedIndex:available[0]||'ndvi';
  const value=hasAverage(activeIndex)?data?.indices[activeIndex]:null;
  const spatial=mapMode==='B'&&hasRaster(activeIndex);
  const observationDate=spatial?data?.raster?.acquisition_date:data?.indices?.capture_date;
  const historical=!!observationDate && Date.now()-Date.parse(observationDate+'T12:00:00+05:30')>21*86400000;
  const dateCaption=observationDate?new Date(observationDate+'T12:00:00+05:30').toLocaleDateString(mr?'mr-IN':'en-IN',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Kolkata'}):null;
  const layerControls=()=> available.length ? <View style={styles.layerSection}>
    <View style={styles.layerRow}>
      <TouchableOpacity accessibilityRole="button" accessibilityState={{expanded:layersOpen}} style={styles.layerPicker} onPress={()=>setLayersOpen(value=>!value)}><View style={{flex:1}}><Text style={styles.caption}>{mr?'नकाशाचा थर':'MAP LAYER'}</Text><Text style={styles.layerName}>{activeIndex.toUpperCase()} · {labels[activeIndex][mr?1:0]}</Text></View><Text style={styles.chevron}>{layersOpen?'⌃':'⌄'}</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" accessibilityState={{selected:!overlayVisible}} style={styles.compare} onPress={()=>setOverlayVisible(value=>!value)}><Text style={styles.action}>{overlayVisible?(mr?'फक्त चित्र':'Photo only'):(mr?'रंग दाखवा':'Show colours')}</Text></TouchableOpacity>
    </View>
    {layersOpen && <View style={styles.layerList}>{available.map(key=><TouchableOpacity key={key} accessibilityRole="button" accessibilityState={{selected:key===activeIndex}} style={[styles.layerOption,key===activeIndex&&styles.selected]} onPress={()=>{setSelectedIndex(key);setLayersOpen(false);setOverlayVisible(true);}}><Text style={styles.optionCode}>{key.toUpperCase()}</Text><Text style={styles.optionName}>{labels[key][mr?1:0]}</Text><Text style={styles.action}>{key===activeIndex?'✓':'›'}</Text></TouchableOpacity>)}</View>}
    <View style={styles.dateRow}><Text style={styles.date}>{mr?'निरीक्षण':'Observed'} · {dateCaption}</Text>{historical&&<Text style={styles.historyBadge}>{mr?'जुने निरीक्षण':'Historical'}</Text>}</View>
  </View> : null;
  const renderMap=(mapHeight:number)=><InteractiveGISMap coordinates={data?.geometry?.coordinates?.[0]||[]} geojson={data?.geometry} farmerName={farmer.name} farmId={farmer.farm_id} areaAcres={data?.area_acres} latitude={data?.latitude} longitude={data?.longitude} activeIndex={activeIndex} overlayVisible={overlayVisible} indexValue={value} captureDate={observationDate} language={language} rasterInfo={data?.raster} mode={spatial?'B':'A'} onToggleMode={setMapMode} mapHeight={mapHeight}/>;
  if(loading)return <View style={styles.center}><ActivityIndicator color="#285d3d"/></View>;
  return <>
    <ScrollView style={styles.container} contentContainerStyle={styles.content} nestedScrollEnabled>
      <View style={styles.header}><Text style={styles.title}>{t.myFarm}</Text><Text style={styles.area}>{data?.area_acres??farmer.farm_area_acres??'—'} {t.acres}</Text></View>
      {error?<View style={styles.summary}><Text style={styles.text}>{t.mapLoadError}</Text><TouchableOpacity style={styles.button} onPress={()=>setRetry(value=>value+1)}><Text>{t.retry}</Text></TouchableOpacity></View>:<>
        {!fullScreen&&layerControls()}
        {!fullScreen&&renderMap(Math.min(540,Math.max(360,height*0.57)))}
        <View style={styles.mapActions}><Text style={styles.mapHint}>{mr?'जवळून पाहण्यासाठी दोन बोटे वापरा.':'Pinch to zoom and drag to explore.'}</Text><TouchableOpacity accessibilityRole="button" style={styles.button} onPress={()=>{setLayersOpen(false);setFullScreen(true);}}><Text style={styles.action}>⤢ {mr?'पूर्ण नकाशा':'Expand map'}</Text></TouchableOpacity></View>
        {available.length?<View style={styles.summary}>
          <Text style={styles.summaryTitle}>{spatial?(mr?'शेतातील रंगीत निरीक्षण':'Within-field colour map'):(mr?'शेताची सरासरी':'Field average')}{!spatial&&value!=null?' · '+value.toFixed(2):''}</Text>
          <Text style={styles.note}>{spatial?(mr?'रंग उपग्रह चित्रातील मोजलेले बदल दाखवतात. मागील निरीक्षण सध्याची स्थिती दर्शवेलच असे नाही.':'Colours show variation in the measured satellite image. A historical observation may not reflect today’s field.'):(mr?'एकच रंग संपूर्ण शेताची सरासरी दाखवतो. तो शेतातील बदलांचे मोजमाप नाही.':'One colour represents the field average. It does not measure variation within the field.')}</Text>
          {spatial&&value!=null&&<Text style={styles.note}>{mr?'नोंदलेली शेत सरासरी':'Recorded field average'} · {value.toFixed(2)} · {data?.indices.capture_date}</Text>}
        </View>:<Text style={styles.notice}>{t.cropHealthUnavailable}</Text>}
        {(data?.field_context?.satellite.observation_count||0)>1&&<View style={styles.summary}><TouchableOpacity accessibilityRole="button" style={styles.button} accessibilityState={{expanded:showHistory}} onPress={()=>setShowHistory(value=>!value)}><Text style={styles.action}>{mr?'आधीची निरीक्षणे':'Previous observations'} {showHistory?'−':'+'}</Text></TouchableOpacity>{showHistory&&data?.field_context?.satellite.history.map(row=><View key={row.date} style={styles.header}><Text style={styles.note}>{shortDate(row.date,language)}</Text><Text style={styles.text}>{row.ndvi?.toFixed(2)??'—'}</Text></View>)}</View>}
        <TouchableOpacity accessibilityRole="button" style={styles.button} disabled={updating} onPress={updateObservation}><Text style={styles.action}>{updating?(mr?'निरीक्षण तपासत आहे…':'Checking satellite data…'):(mr?'नवीन उपग्रह निरीक्षण तपासा':'Check satellite observation')} ↻</Text></TouchableOpacity>
        <Text style={styles.note}>{mr?'तपासण्यासाठी शेताची हद्द Copernicus कडे पाठवली जाते.':'Checking sends this farm boundary to Copernicus for a real observation.'}</Text>
        {!!updateNotice&&<Text style={styles.notice}>{updateNotice}</Text>}
      </>}
    </ScrollView>
    <Modal visible={fullScreen} animationType="slide" onRequestClose={()=>setFullScreen(false)}><SafeAreaView style={{flex:1,backgroundColor:'#f5f8f2'}}><View style={styles.fullScreen}>
      <View style={styles.header}><Text style={styles.summaryTitle}>{t.myFarm}</Text><TouchableOpacity accessibilityRole="button" style={styles.button} onPress={()=>setFullScreen(false)}><Text style={styles.action}>✕ {mr?'बंद करा':'Close'}</Text></TouchableOpacity></View>
      <ScrollView nestedScrollEnabled contentContainerStyle={{gap:10}}>{fullScreen&&layerControls()}{fullScreen&&renderMap(Math.max(220,height-(layersOpen?560:260)))}</ScrollView>
    </View></SafeAreaView></Modal>
  </>;
};
const styles=StyleSheet.create({container:{flex:1,backgroundColor:'#f5f8f2'},content:{padding:14,paddingBottom:28,gap:12,width:'100%',maxWidth:1100,alignSelf:'center'},center:{flex:1,justifyContent:'center',alignItems:'center'},header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},title:{fontSize:23,fontWeight:'700',color:'#214b31'},area:{fontSize:14,color:'#4e7258'},layerSection:{gap:8},layerRow:{flexDirection:'row',alignItems:'center',gap:8},layerPicker:{flex:1,minHeight:64,padding:12,borderRadius:12,backgroundColor:'#fff',borderWidth:1,borderColor:'#dbe8d6',flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:5},caption:{fontSize:10,fontWeight:'700',letterSpacing:0.6,color:'#72826f'},layerName:{fontSize:14,fontWeight:'700',color:'#244d30',marginTop:4},chevron:{fontSize:20,color:'#426c4a'},compare:{minHeight:48,paddingHorizontal:10,justifyContent:'center',borderRadius:10,backgroundColor:'#e9f1e3'},dateRow:{flexDirection:'row',flexWrap:'wrap',gap:8,alignItems:'center'},date:{fontSize:12,color:'#5e7760'},historyBadge:{fontSize:10,color:'#83641e',backgroundColor:'#f6edcc',paddingHorizontal:8,paddingVertical:4,borderRadius:8},layerList:{padding:6,borderRadius:14,backgroundColor:'#fff',gap:4,borderWidth:1,borderColor:'#dce8d5'},layerOption:{flexDirection:'row',alignItems:'center',gap:10,minHeight:48,padding:12,borderRadius:10},selected:{backgroundColor:'#e8f2df'},optionCode:{fontSize:13,fontWeight:'700',color:'#285138',width:52},optionName:{flex:1,fontSize:14,color:'#48654b'},mapActions:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',justifyContent:'space-between',gap:8},mapHint:{fontSize:11,color:'#75856d',flex:1},button:{minHeight:44,padding:10,justifyContent:'center'},action:{fontSize:13,fontWeight:'600',color:'#2c633c'},summary:{padding:16,borderRadius:16,backgroundColor:'#fff',gap:8},summaryTitle:{fontSize:16,fontWeight:'700',color:'#294e34'},text:{fontSize:15,color:'#3f6247',lineHeight:22},note:{fontSize:12,color:'#697f65',lineHeight:20},notice:{fontSize:14,color:'#5c745d',lineHeight:22,paddingVertical:8},fullScreen:{flex:1,padding:12,gap:10,backgroundColor:'#f5f8f2'}});
