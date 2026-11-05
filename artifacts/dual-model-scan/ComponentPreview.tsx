// Synthetic preview of layout and catalog content; never calls detection or farmer APIs.
import React,{useState} from 'react';
import {registerRootComponent} from 'expo';
import {View,ScrollView,Text,TouchableOpacity} from 'react-native';
import {DiseaseGuidance} from './src/components/DiseaseGuidance';
import fixture from './DiseaseGuidanceFixture.json';
const models:any=[{model:'UNet / ResNet34',task:'segmentation',status:'complete',threshold:.75,predictions:[{disease:'Brown Rust',score:.03,detected:false},{disease:'Mosaic',score:.88,detected:true},{disease:'Red Rot',score:.02,detected:false}]},{model:'EfficientNet-B0',task:'multi_label_classification',status:'complete',threshold:.6,predictions:[{disease:'Brown Rust',score:.12,detected:false},{disease:'Mosaic',score:.91,detected:true},{disease:'Red Rot',score:.06,detected:false}]}];
function Preview(){const[language,setLanguage]=useState<'en'|'mr'>('en');return <View style={{flex:1,backgroundColor:'#f7faf7'}}><ScrollView contentContainerStyle={{padding:16,gap:14,width:'100%',maxWidth:800,alignSelf:'center'}}><Text>Component preview · synthetic model scores</Text><TouchableOpacity onPress={()=>setLanguage(v=>v==='en'?'mr':'en')}><Text>English / मराठी</Text></TouchableOpacity><DiseaseGuidance details={fixture} models={models} status="disease_detected" language={language}/></ScrollView></View>};
registerRootComponent(Preview);
