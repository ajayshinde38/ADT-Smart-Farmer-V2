import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ApiClient } from '../services/apiClient';
import { DiseaseDetectionResult, FarmerProfile, WeatherData, FieldContext } from '../types';
import { FieldConnections } from '../components/FieldConnections';
import { CropWatchCard } from '../components/CropWatchCard';

interface Props { farmer: FarmerProfile; language: 'en' | 'mr'; onWeather?: () => void }
export const PestDetectionScreen: React.FC<Props> = ({ farmer, language, onWeather }) => {
  const mr = language === 'mr';
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiseaseDetectionResult | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [context, setContext] = useState<FieldContext | null>(null);
  const [weatherError, setWeatherError] = useState(false);
  const [showAdvice, setShowAdvice] = useState(false);
  const fileInputRef = useRef<any>(null);
  const generation = useRef(0);
  useEffect(() => {
    let active = true;
    setWeather(null); setContext(null); setWeatherError(false); setLoading(false); setResult(null); setPreviewUri(null); setError('');
    if (farmer.farm_id) ApiClient.getDashboard(farmer.farm_id).then(value => { if (active) { setWeather(value.weather); setContext(value.field_context); setWeatherError(!value.weather); } }).catch(() => { if (active) setWeatherError(true); });
    return () => { active = false; generation.current++; };
  }, [farmer.farm_id]);
  useEffect(() => () => { if (Platform.OS === 'web' && previewUri?.startsWith('blob:')) URL.revokeObjectURL(previewUri); }, [previewUri]);
  const scan = async (form: FormData, uri: string) => {
    if (farmer.farm_id) form.append('farm_id', farmer.farm_id);
    const request = ++generation.current;
    setPreviewUri(uri); setResult(null); setError(''); setShowAdvice(false); setLoading(true);
    try { const value = await ApiClient.detectDisease(form); if (request === generation.current) setResult(value); }
    catch { if (request === generation.current) setError(mr ? 'फोटो तपासता आला नाही. स्पष्ट फोटो निवडून पुन्हा प्रयत्न करा.' : 'Unable to analyse this photo. Try again with a clear image.'); }
    finally { if (request === generation.current) setLoading(false); }
  };
  const nativePhoto = async (camera: boolean) => {
    try {
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) { setError(mr ? 'फोटो घेण्यासाठी कॅमेरा परवानगी आवश्यक आहे.' : 'Camera permission is needed to take a photo.'); return; }
      }
      const photo = camera ? await ImagePicker.launchCameraAsync({ quality:0.8 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes:['images'], quality:0.8 });
      if (photo.canceled || !photo.assets?.[0]) return;
      const asset = photo.assets[0];
      if ((asset.fileSize || 0) > 8*1024*1024) { setError(mr ? '८ MB पेक्षा लहान फोटो निवडा.' : 'Choose an image smaller than 8 MB.'); return; }
      const form = new FormData();
      form.append('file', { uri:asset.uri, name:asset.fileName || 'leaf.jpg', type:asset.mimeType || 'image/jpeg' } as any);
      await scan(form, asset.uri);
    } catch { setError(mr ? 'फोटो उघडता आला नाही.' : 'Unable to open the camera or photo.'); }
  };
  const choose = (camera: boolean) => {
    if (Platform.OS !== 'web') { void nativePhoto(camera); return; }
    if (camera) fileInputRef.current?.setAttribute('capture','environment');
    else fileInputRef.current?.removeAttribute('capture');
    fileInputRef.current?.click();
  };
  const selected = async (event: any) => {
    const file = event.target?.files?.[0]; event.target.value = '';
    if (!file) return;
    if (file.size > 8*1024*1024) { setError(mr ? '८ MB पेक्षा लहान फोटो निवडा.' : 'Choose an image smaller than 8 MB.'); return; }
    const form = new FormData(); form.append('file',file);
    await scan(form,URL.createObjectURL(file));
  };
  const detected = result?.status === 'disease_detected' && result.disease_details != null;
  const details = detected ? result?.disease_details : null;
  return <ScrollView style={styles.container} contentContainerStyle={styles.content}>
    <Text style={styles.title}>{mr ? 'पीक तपासणी' : 'Crop care'}</Text>
    <Text style={styles.text}>{mr ? 'शेताचे हवामान पाहा आणि दिसणारी लक्षणे फोटोमधून तपासा.' : 'Use your farm’s weather and a clear photo to guide field inspection.'}</Text>
    {Platform.OS === 'web' && <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{display:'none'}} onChange={selected} />}
    <View style={styles.card}>
      <Text style={styles.subtitle}>{mr ? 'पिकाचा फोटो तपासा' : 'Check a crop photo'}</Text>
      {previewUri ? <Image source={{uri:previewUri}} style={styles.photo} resizeMode="contain" /> : <View style={styles.placeholder}><Text style={{fontSize:42}}>🍃</Text><Text style={styles.text}>{mr ? 'चांगल्या प्रकाशात एक पान जवळून दाखवा.' : 'Photograph one leaf closely in good light.'}</Text></View>}
      <View style={styles.actions}>
        <TouchableOpacity accessibilityRole="button" style={styles.button} disabled={loading} onPress={()=>choose(true)}><Text style={styles.actionText}>{mr ? 'फोटो घ्या' : 'Take photo'}</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" style={styles.secondary} disabled={loading} onPress={()=>choose(false)}><Text style={styles.actionTextDark}>{mr ? 'फोटो निवडा' : 'Choose photo'}</Text></TouchableOpacity>
      </View>
      <Text style={styles.note}>{mr ? 'तांबेरा, मोझॅक व लाल कूज या तीन रोगांचे नमुने तपासले जातात. इतर किडी व रोगांसाठी शेत तपासणी आवश्यक आहे.' : 'Checks patterns associated with Brown Rust, Mosaic and Red Rot. Other pests and diseases need field inspection.'}</Text>
      {loading && <View style={styles.loading}><ActivityIndicator color="#185b35"/><Text style={styles.text}>{mr ? 'फोटो तपासत आहे…' : 'Checking photo…'}</Text></View>}
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    </View>
    {result && <View style={styles.card}>
      <Text style={styles.subtitle}>{detected ? (mr ? result.marathi_name : result.detected_disease) : (mr ? 'समर्थित रोगाचा स्पष्ट नमुना आढळला नाही' : 'No clear supported disease pattern detected')}</Text>
      <Text style={styles.text}>{detected ? (mr ? 'या फोटोतील लक्षणे या रोगाशी जुळू शकतात. शेतात खात्री करा.' : 'Photo patterns may match this disease. Confirm symptoms in the field.') : (mr ? 'याचा अर्थ पीक निरोगी असल्याची खात्री नाही. लक्षणे कायम असल्यास तज्ज्ञांना दाखवा.' : 'This does not confirm a healthy crop. Ask an agronomist if symptoms persist.')}</Text>
      {detected && <Text style={styles.note}>{mr ? 'फोटोतील अंदाजे बाधित भाग' : 'Estimated affected image area'}: {result.affected_percentage}% · {mr ? 'मॉडेल जुळणी' : 'Model match'} {Math.round(result.confidence_score*100)}%</Text>}
      {detected && result.overlay_data_url && <><Image source={{uri:result.overlay_data_url}} style={styles.photo} resizeMode="contain"/><Text style={styles.note}>{mr ? 'रंगीत भाग मॉडेलने ओळखलेले नमुने दर्शवतात.' : 'Highlighted areas show model detections in this image.'}</Text></>}
      {details && <>
        <Text style={styles.subtitle}>{mr ? 'शेतात काय तपासावे' : 'What to look for'}</Text><Text style={styles.text}>{mr ? details.symptoms_mr : details.symptoms}</Text>
        <Text style={styles.subtitle}>{mr ? 'पुढील काळजी' : 'Next care steps'}</Text><Text style={styles.text}>{mr ? details.prevention_mr : details.prevention}</Text>
        <TouchableOpacity style={styles.link} onPress={()=>setShowAdvice(x=>!x)} accessibilityState={{expanded:showAdvice}}><Text style={styles.actionTextDark}>{mr ? 'उपचाराची संदर्भ माहिती' : 'Treatment reference'} {showAdvice ? '−' : '+'}</Text></TouchableOpacity>
        {showAdvice && <><Text style={styles.note}>{mr ? 'फवारणीपूर्वी रोगाची खात्री व स्थानिक तज्ज्ञांचा सल्ला घ्या. उत्पादनाच्या लेबलचे पालन करा.' : 'Confirm the diagnosis with a local agronomist before treatment. Follow the product label.'}</Text><Text style={styles.text}>{mr ? details.chemical_control_mr : details.chemical_control}</Text></>}
      </>}
    </View>}
    <FieldConnections context={result?.field_context || context} language={language} />
    {weather && <CropWatchCard data={weather} language={language} />}
    {weatherError && <Text style={styles.note}>{mr ? 'हवामानावर आधारित तपासणी उपलब्ध नाही. फोटो तपासू शकता.' : 'Weather-based crop watch is unavailable. Photo checking is still available.'}</Text>}
    {onWeather && <TouchableOpacity style={styles.link} onPress={onWeather}><Text style={styles.actionTextDark}>{mr ? 'संपूर्ण हवामान पाहा' : 'View full weather'} →</Text></TouchableOpacity>}
  </ScrollView>;
};
const styles=StyleSheet.create({container:{flex:1,backgroundColor:'#f7faf7'},content:{padding:16,paddingBottom:28,gap:14,maxWidth:900,width:'100%',alignSelf:'center'},title:{fontSize:22,fontWeight:'700',color:'#173d28'},subtitle:{fontSize:17,fontWeight:'600',color:'#204b32'},text:{fontSize:15,lineHeight:23,color:'#405b49'},note:{fontSize:12,lineHeight:19,color:'#627569'},card:{backgroundColor:'#fff',padding:16,borderRadius:18,gap:12},photo:{height:240,width:'100%',borderRadius:14,backgroundColor:'#f1f5f1'},placeholder:{height:180,justifyContent:'center',alignItems:'center',padding:24,gap:12,backgroundColor:'#f1f5f1',borderRadius:14},actions:{flexDirection:'row',flexWrap:'wrap',gap:10},button:{flex:1,minWidth:120,minHeight:48,padding:12,justifyContent:'center',alignItems:'center',backgroundColor:'#185b35',borderRadius:12},secondary:{flex:1,minWidth:120,minHeight:48,padding:12,justifyContent:'center',alignItems:'center',backgroundColor:'#e8f1e9',borderRadius:12},actionText:{color:'#fff',fontSize:15,fontWeight:'600'},actionTextDark:{color:'#185b35',fontSize:15,fontWeight:'600'},link:{minHeight:44,justifyContent:'center'},loading:{flexDirection:'row',gap:12,alignItems:'center'},error:{fontSize:14,lineHeight:21,color:'#9e3030'}});
