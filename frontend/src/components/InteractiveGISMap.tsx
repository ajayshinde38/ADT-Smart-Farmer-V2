import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { ApiClient, getMapServerOrigin } from '../services/apiClient';
import { createNativeGISDocument, scriptJSON } from '../utils/nativeGISDocument';
import { getColorForIndex } from '../utils/gisColorScale';
import { GISMapLegend, GISMapToolbar } from './GISMapControls';
import { hasRasterForIndex, InteractiveGISMapProps } from './gisMapTypes';
export type { InteractiveGISMapProps } from './gisMapTypes';
export { PALETTE_VEG, PALETTE_WATER, getColorForIndex, getClassIndex, FALLBACK_COLOR } from '../utils/gisColorScale';
export const getIndexColorFromPalette=getColorForIndex;

export const InteractiveGISMap:React.FC<InteractiveGISMapProps> = (props) => {
  const {language='en',activeIndex,mode='A',overlayVisible=true,mapHeight=440,onToggleMode}=props;
  const webview=useRef<WebView>(null);
  const [ready,setReady]=useState(false),[failed,setFailed]=useState(false),[retry,setRetry]=useState(0);
  const [basemap,setBasemap]=useState<'satellite'|'street'>('satellite');
  const origin=getMapServerOrigin();
  const source=useMemo(()=>({html:createNativeGISDocument(origin),baseUrl:origin+'/'}),[origin]);
  const payload=useMemo(()=>({...props,basemap,color:getColorForIndex(activeIndex,props.indexValue),token:props.authorizationToken || ApiClient.getToken()}),[props,basemap]);
  useEffect(()=>{if(ready)webview.current?.injectJavaScript(`window.updateFarmMap && window.updateFarmMap(${scriptJSON(payload)});true;`);},[ready,payload]);
  const command=(action:string)=>webview.current?.injectJavaScript(`window.controlFarmMap && window.controlFarmMap(${scriptJSON(action)});true;`);
  const spatial=mode==='B' && hasRasterForIndex(props);
  const measured=!!props.captureDate && typeof props.indexValue==='number' && Number.isFinite(props.indexValue);
  return <View style={styles.wrapper}>
    <View style={{height:mapHeight}}>
      <WebView key={retry} ref={webview} source={source} originWhitelist={['*']}
        style={styles.webview} javaScriptEnabled domStorageEnabled={false} scrollEnabled={false}
        allowFileAccess={false} allowFileAccessFromFileURLs={false} allowUniversalAccessFromFileURLs={false}
        onShouldStartLoadWithRequest={request=>request.url==='about:blank'||request.url===origin||request.url.startsWith(origin+'/')}
        onMessage={event=>{try{const message=JSON.parse(event.nativeEvent.data);if(message.type==='map-ready'){setReady(true);setFailed(false);}if(message.type==='map-error'){setFailed(true);setReady(false);}}catch{setFailed(true);}}}
        onError={()=>{setFailed(true);setReady(false);}} onHttpError={()=>{setFailed(true);setReady(false);}}
      />
      {!ready && !failed && <View style={styles.loading} pointerEvents="none"><ActivityIndicator color="#285d3d"/><Text style={styles.note}>{language==='mr'?'नकाशा उघडत आहे…':'Opening farm map…'}</Text></View>}
      {failed && <View style={styles.loading}><Text style={styles.note}>{language==='mr'?'नकाशा उघडला नाही. इंटरनेट व अॅप सर्व्हर तपासा.':'Map unavailable. Check your connection and app server.'}</Text><TouchableOpacity style={styles.retry} onPress={()=>{setReady(false);setFailed(false);setRetry(value=>value+1);}}><Text style={styles.note}>{language==='mr'?'पुन्हा प्रयत्न करा':'Try again'}</Text></TouchableOpacity></View>}
      {ready && (spatial || measured) && overlayVisible && <GISMapLegend activeIndex={activeIndex} language={language} spatial={spatial} canCompare={hasRasterForIndex(props)&&measured} onToggleMode={onToggleMode}/>}
    </View>
    <GISMapToolbar language={language} basemap={basemap} onBasemap={setBasemap} onZoomIn={()=>command('in')} onZoomOut={()=>command('out')} onCenter={()=>command('center')}/>
  </View>;
};
const styles=StyleSheet.create({wrapper:{width:'100%',borderRadius:18,overflow:'hidden',backgroundColor:'#dfe8db',borderWidth:1,borderColor:'#dce6da'},webview:{flex:1,backgroundColor:'#dfe8db'},loading:{...StyleSheet.absoluteFillObject,alignItems:'center',justifyContent:'center',padding:24,gap:12,backgroundColor:'#f0f5ec'},note:{fontSize:14,lineHeight:21,color:'#3f6449',textAlign:'center'},retry:{padding:14,minHeight:44,borderRadius:10,backgroundColor:'#dcebd5'}});
