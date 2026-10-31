import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { WeatherData } from '../types';
export const ForecastChart = ({ days, language }: { days: WeatherData['forecast_7_day']; language: 'en' | 'mr' }) => {
  const usable = days.slice(0,7).filter(day => Number.isFinite(day.temp_max_c) && Number.isFinite(day.temp_min_c));
  if (usable.length < 2) return null;
  const low = Math.min(...usable.map(day=>day.temp_min_c))-2;
  const high = Math.max(...usable.map(day=>day.temp_max_c))+2;
  const x=(i:number)=>26+i*268/Math.max(1,usable.length-1);
  const y=(value:number)=>88-((value-low)/(high-low))*60;
  const points=(key:'temp_max_c'|'temp_min_c')=>usable.map((day,i)=>`${x(i)},${y(day[key])}`).join(' ');
  const rainMax=Math.max(1,...usable.map(day=>day.rainfall_mm || 0));
  return <View style={{backgroundColor:'#fff',borderRadius:16,padding:12}} accessibilityLabel={language==='mr'?'सात दिवसांचा तापमान व पावसाचा कल':'Seven-day temperature and rainfall trend'}>
    <Text style={{fontSize:12,color:'#596b60',marginBottom:6}}>{language==='mr'?'केशरी: कमाल · हिरवा: किमान · निळा: पाऊस':'°C high / low · Blue bars: rain (mm)'}</Text>
    <Svg width="100%" height={170} viewBox="0 0 320 170">
      {usable.map((day,i)=><React.Fragment key={day.date}><Rect x={x(i)-6} y={137-20*(day.rainfall_mm||0)/rainMax} width={12} height={20*(day.rainfall_mm||0)/rainMax} fill="#74b7d1"/><SvgText x={x(i)} y={113} textAnchor="middle" fontSize={10} fill="#27617a">{Number.isFinite(day.rainfall_mm) ? `${day.rainfall_mm}mm` : '—'}</SvgText><SvgText x={x(i)} y={156} textAnchor="middle" fontSize={10} fill="#596b60">{day.date.slice(5).replace('-', '/')}</SvgText></React.Fragment>)}
      <Polyline points={points('temp_max_c')} fill="none" stroke="#bd7138" strokeWidth={2.5}/>
      <Polyline points={points('temp_min_c')} fill="none" stroke="#398153" strokeWidth={2.5}/>
      {usable.map((day,i)=><React.Fragment key={`values-${day.date}`}>
        <SvgText x={x(i)} y={y(day.temp_max_c)-7} textAnchor="middle" fontSize={10} fill="#9a5324">{day.temp_max_c}°</SvgText>
        <SvgText x={x(i)} y={y(day.temp_min_c)+13} textAnchor="middle" fontSize={10} fill="#28623d">{day.temp_min_c}°</SvgText>
      </React.Fragment>)}
    </Svg>
  </View>;
};
