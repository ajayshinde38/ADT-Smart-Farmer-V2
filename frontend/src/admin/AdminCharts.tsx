import React from 'react';
import { View,StyleSheet } from 'react-native';
import Svg,{Circle} from 'react-native-svg';
import { AppText as Text,Card,ui,amount } from '../components/ui';
export const SummaryMetric=({label,value,note}:{label:string;value:number|string|null|undefined;note?:string})=><Card style={styles.metric}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value??'—'}</Text>{note&&<Text style={ui.note}>{note}</Text>}</Card>;
export const DataBars=({items,unit='records'}:{items:Array<{label:string;value:number}>;unit?:string})=>{
 const max=Math.max(1,...items.map(item=>item.value));
 return <View style={{gap:12}}>{items.length?items.map((item,index)=><View key={item.label+index} style={{gap:5}}><View style={ui.row}><Text style={[ui.note,{flex:1}]} numberOfLines={1}>{item.label}</Text><Text style={styles.barValue}>{amount(item.value,unit==='acres'?2:0)} {unit}</Text></View><View style={styles.track}><View style={{width:`${item.value/max*100}%`,height:7,borderRadius:4,backgroundColor:'#1b8a56'}}/></View></View>):<Text style={ui.note}>No recorded data to chart.</Text>}</View>;
};
export const Coverage=({available,total}:{available:number;total:number})=>{
 const percent=total?available/total:0,circumference=2*Math.PI*46;
 return <View style={{flexDirection:'row',alignItems:'center',gap:24,flexWrap:'wrap'}}><View style={{height:120,width:120,alignItems:'center',justifyContent:'center'}}><Svg width={120} height={120} viewBox="0 0 120 120"><Circle cx={60} cy={60} r={46} fill="none" stroke="#e7ede5" strokeWidth={11}/><Circle cx={60} cy={60} r={46} fill="none" stroke="#198955" strokeWidth={11} strokeDasharray={`${circumference*percent} ${circumference}`} rotation={-90} origin="60,60"/></Svg><View style={{position:'absolute',alignItems:'center'}}><Text style={{fontSize:24,fontWeight:'700',color:'#14482b'}}>{Math.round(percent*100)}%</Text><Text style={ui.note}>available</Text></View></View><View style={{gap:8,flex:1,minWidth:130}}><Text style={ui.body}>{available} with observations</Text><Text style={ui.note}>{total-available} without observations</Text><Text style={ui.note}>Coverage of recorded fields; not a crop-health score.</Text></View></View>;
};
const styles=StyleSheet.create({metric:{flex:1,minWidth:170,flexBasis:180,padding:18,gap:8},label:{fontSize:12,fontWeight:'600',color:'#687b6c'},value:{fontSize:30,fontWeight:'700',color:'#194c2d'},track:{height:7,borderRadius:4,backgroundColor:'#eaf0e7',overflow:'hidden'},barValue:{fontSize:12,color:'#1a6135',fontWeight:'700'}});
