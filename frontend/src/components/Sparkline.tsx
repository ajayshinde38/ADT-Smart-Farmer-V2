import React from 'react';
import { View } from 'react-native';
import Svg,{Path,Polyline,Line} from 'react-native-svg';
export const Sparkline=({values,color='#00772d',height=90}:{values:Array<number|null|undefined>;color?:string;height?:number})=>{
  const measured=values.filter((value):value is number=>typeof value==='number'&&Number.isFinite(value));
  if(measured.length<2)return null;
  const lo=Math.min(...measured),hi=Math.max(...measured),span=hi-lo||1;
  const points=values.map((value,index)=>typeof value==='number'&&Number.isFinite(value)?[10+index/Math.max(1,values.length-1)*300,height-12-(value-lo)/span*(height-25)]:null);
  // Missing samples break the line; they are never interpolated into observations.
  const segments:number[][][]=[];let segment:number[][]=[];
  points.forEach(point=>{if(point)segment.push(point);else if(segment.length){segments.push(segment);segment=[];}});if(segment.length)segments.push(segment);
  return <View style={{width:'100%',height}}><Svg width="100%" height={height} viewBox={`0 0 320 ${height}`}><Line x1={10} y1={height-10} x2={310} y2={height-10} stroke="#dceadd"/>{segments.map((group,index)=><Polyline key={index} points={group.map(p=>p.join(',')).join(' ')} stroke={color} strokeWidth={2.5} fill="none"/>)}</Svg></View>;
};
