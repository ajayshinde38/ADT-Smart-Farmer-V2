import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { FieldConnections } from '../components/FieldConnections';
import { freshWeather, stageLabel } from '../utils/farmPresentation';
import { CropWatchCard } from '../components/CropWatchCard';
import { ForecastChart } from '../components/ForecastChart';
import { translations } from '../i18n/translations';
import { ApiClient } from '../services/apiClient';
import { FarmerProfile, WeatherData } from '../types';

interface WeatherScreenProps { farmer: FarmerProfile; language: 'en' | 'mr'; onScan?: () => void }
const amount = (value: number | null | undefined, unit = '') =>
  typeof value === 'number' && Number.isFinite(value) ? `${value}${unit}` : '—';
export const WeatherScreen: React.FC<WeatherScreenProps> = ({ farmer, language, onScan }) => {
  const t = translations[language];
  const mr = language === 'mr';
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | undefined>();
  const [expanded, setExpanded] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    let active = true;
    setData(null); setLoading(true); setExpanded(false); setSelectedDate(undefined);
    if (!farmer.farm_id) { setLoading(false); return; }
    ApiClient.getWeather(farmer.farm_id).then(result => { if (active) setData(result); })
      .catch(() => { if (active) setData(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [farmer.farm_id, retry]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
  if (loading) return <View style={styles.center}><ActivityIndicator color="#15803d" /></View>;
  if (!data) return <View style={styles.center}><Text style={styles.text}>{t.weatherLoadError}</Text>
    <TouchableOpacity style={styles.button} onPress={() => setRetry(x => x + 1)}><Text>{t.retry}</Text></TouchableOpacity></View>;

  const updatedMs = Date.parse(data.last_updated_utc || '');
  // The provider cache lasts 15 minutes. Recheck age while the screen stays open.
  const stale = !freshWeather(data, now);
  const timezone = data.forecast_timezone || 'Asia/Kolkata';
  const locale = mr ? 'mr-IN' : 'en-IN';
  const updatedLabel = Number.isFinite(updatedMs) ? new Date(updatedMs).toLocaleString(locale, {
    timeZone: timezone, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  }) : null;
  const todayDate = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const today = data.forecast_7_day?.find(day => day.date === todayDate);
  const chosen = data.forecast_7_day?.find(day => day.date === selectedDate) || today || data.forecast_7_day?.[0];
  const irrigation = data.irrigation;
  const conditionsMr: Record<string, string> = {
    'Clear Sky': 'निरभ्र आकाश', 'Mainly Clear': 'बहुतांश निरभ्र', 'Partly Cloudy': 'अंशतः ढगाळ',
    'Overcast': 'ढगाळ', 'Foggy': 'धुके', 'Depositing Rime Fog': 'दाट धुके',
    'Light Drizzle': 'हलकी रिमझिम', 'Moderate Drizzle': 'रिमझिम पाऊस', 'Dense Drizzle': 'जोरदार रिमझिम',
    'Slight Rain': 'हलका पाऊस', 'Moderate Rain': 'मध्यम पाऊस', 'Heavy Rain': 'जोरदार पाऊस',
    'Slight Snow': 'हलकी हिमवृष्टी', 'Rain Showers': 'पावसाच्या सरी', 'Moderate Showers': 'मध्यम सरी',
    'Violent Showers': 'जोरदार सरी', 'Thunderstorm': 'मेघगर्जनेसह पाऊस', 'Thunderstorm with Hail': 'मेघगर्जना व गारपीट',
  };
  const duration = mr ? irrigation?.irrigation_duration_label?.replace('hr', 'तास').replace('min', 'मिनिटे').replace('(Rain Sufficed)', '(पाऊस पुरेसा)') : irrigation?.irrigation_duration_label;
  const hourlyLabel = (label: string) => mr ? label.replace('Now', 'आता') : label;
  const dateLabel = (date: string) => new Date(`${date}T12:00:00+05:30`).toLocaleDateString(locale, {
    timeZone: timezone, weekday: 'short', day: 'numeric', month: 'short',
  });
  return <ScrollView style={styles.container} contentContainerStyle={styles.content}>
    <View style={styles.heroRow}><Text style={styles.title}>{t.weather}</Text><TouchableOpacity accessibilityRole="button" style={styles.button} onPress={() => setRetry(x => x + 1)}><Text style={styles.link}>{mr ? 'पुन्हा तपासा' : 'Refresh'} ↻</Text></TouchableOpacity></View>
    {updatedLabel && <Text style={styles.muted}>{t.updated}: {updatedLabel}</Text>}
    {stale && <Text style={styles.warning} accessibilityRole="alert">{t.weatherOutdated}</Text>}
    <View style={styles.hero}>
      <View style={styles.heroRow}><Text style={styles.temperature}>{amount(data.current_temp_c, '°C')}</Text>
        <Text style={styles.icon}>{data.current_icon}</Text></View>
      <Text style={styles.condition}>{mr ? conditionsMr[data.current_condition] || data.current_condition : data.current_condition}</Text>
      {data.apparent_temp_c != null && <Text style={styles.muted}>{mr ? 'जाणवणारे तापमान' : 'Feels like'} {amount(data.apparent_temp_c, '°C')}</Text>}
      <Text style={styles.text}>{mr ? 'आज कमाल / किमान' : 'Today’s high / low'}  {amount(today?.temp_max_c, '°')} / {amount(today?.temp_min_c, '°C')}</Text>
      <View style={styles.rain}><Text style={styles.text}>{mr ? 'पावसाची शक्यता' : 'Rain chance'}  {amount(today?.precipitation_probability, '%')}</Text>
        <Text style={styles.text}>{mr ? 'अपेक्षित पाऊस' : 'Expected rainfall'}  {amount(today?.rainfall_mm, ' mm')}</Text></View>
      <View style={styles.inline}><Text style={styles.muted}>{t.humidity} {amount(data.current_humidity_pct, '%')}</Text>
        <Text style={styles.muted}>{mr ? 'वारा' : 'Wind'} {amount(data.current_wind_speed_kmh, ' km/h')}</Text></View>
    </View>
    {data.current_vpd_kpa > 2.2 && <View style={styles.warning} accessibilityRole="alert">
      <Text style={styles.text}>{mr ? 'हवेतील कोरडेपणामुळे पाण्याची मागणी जास्त आहे. शेतातील ओलावा तपासा.' : 'High atmospheric drying demand. Check soil moisture in your field.'}</Text>
    </View>}
    <Text style={styles.sectionTitle}>{mr ? 'पुढील काही तास' : 'Next few hours'}</Text>
    {data.hourly_forecast?.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hourly}>
      {data.hourly_forecast.slice(0, 8).map(item => <View key={item.time} style={styles.hour}>
        <Text style={styles.muted}>{hourlyLabel(item.time_label)}</Text><Text style={styles.hourIcon}>{item.weather_icon}</Text>
        <Text style={styles.text}>{amount(item.temp_c, '°C')}</Text>
        <Text style={styles.rainText}>{amount(item.precipitation_probability_pct, '%')} {mr ? 'पाऊस' : 'rain'}</Text>
      </View>)}
    </ScrollView> : <Text style={styles.muted}>{mr ? 'तासागणिक माहिती उपलब्ध नाही.' : 'Hourly forecast unavailable.'}</Text>}
    <Text style={styles.sectionTitle}>{mr ? 'सात दिवसांचा अंदाज' : 'Seven-day outlook'}</Text>
    <ForecastChart days={data.forecast_7_day} language={language} />
    <View style={styles.card}>{data.forecast_7_day?.slice(0, 7).map(day => <TouchableOpacity key={day.date} accessibilityRole="button" accessibilityState={{selected:chosen?.date===day.date}} onPress={()=>setSelectedDate(day.date)} style={[styles.day,chosen?.date===day.date && {backgroundColor:'#edf4ea'}]}>
      <Text style={styles.dayDate}>{dateLabel(day.date)}</Text><Text>{day.weather_icon}</Text>
      <Text style={styles.dayValue}>{amount(day.temp_max_c, '°')} / {amount(day.temp_min_c, '°')}</Text>
      <Text style={styles.rainText}>{amount(day.rainfall_mm, ' mm')}</Text>
    </TouchableOpacity>)}</View>
    {chosen && <View style={styles.card}><Text style={styles.sectionTitle}>{dateLabel(chosen.date)}</Text><Text style={styles.text}>{mr ? 'सरासरी आर्द्रता' : 'Mean humidity'} {amount(chosen.humidity_pct,'%')} · {mr ? 'वारा' : 'Wind'} {amount(chosen.wind_kmh,' km/h')}</Text><Text style={styles.muted}>{mr ? 'पाऊस व पीक तपासणीसाठी वरील दिवस निवडा.' : 'Select a day above to review rainfall and crop watch.'}</Text></View>}
    <CropWatchCard data={data} language={language} onScan={onScan} selectedDate={chosen?.date} />
    <FieldConnections context={data.field_context} language={language} />
    {irrigation && <View style={styles.irrigation}>
      <Text style={styles.sectionTitle}>{mr ? 'सिंचनाचे नियोजन' : 'Irrigation planning'}</Text>
      <Text style={styles.text}>{mr ? 'पिकाची अंदाजे पाण्याची गरज' : 'Estimated crop water need'}: {amount(irrigation.net_irrigation_mm_day, mr ? ' मिमी/दिवस' : ' mm/day')}</Text>
      {irrigation.irrigation_duration_label && <Text style={styles.text}>{mr ? 'पंप चालवण्याचा अंदाजे वेळ' : 'Estimated pump time'}: {duration}</Text>}
      <Text style={styles.muted}>{mr ? 'पाणी देण्यापूर्वी मातीतील ओलावा व पाऊस तपासा.' : 'Check soil moisture and rainfall before watering.'}</Text>
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded }} style={styles.button} onPress={() => setExpanded(x => !x)}>
        <Text style={styles.link}>{mr ? 'या अंदाजाबद्दल' : 'About this estimate'} {expanded ? '−' : '+'}</Text>
      </TouchableOpacity>
      {expanded && <View style={styles.explanation}>
        <Text style={styles.muted}>{mr ? 'वेळ पंपाचा प्रवाह, पिकाची अवस्था आणि सिंचन कार्यक्षमतेनुसार बदलतो. सिंचन कार्यक्षमता माहीत नाही; पाण्याचा अपव्यय गणनेत धरलेला नाही. हा अंदाज आहे.' : 'Time depends on pump flow, crop stage and irrigation efficiency. Irrigation efficiency is unknown; water losses are not included. Unverified inputs make this an estimate.'}</Text>
        <Text style={styles.muted}>{mr ? 'पंपाचा वापरलेला प्रवाह' : 'Pump flow used'}: {amount(irrigation.pump_discharge_l_s, ' L/s')}</Text>
        <Text style={styles.muted}>{mr ? 'पिकाची वापरलेली अवस्था' : 'Crop stage used'}: {stageLabel(irrigation.crop_stage,language)}</Text>
        {data.field_context?.crop.stage_source === 'planting_date_estimate' && <Text style={styles.muted}>{mr ? 'अवस्था लागवड तारखेवरून अंदाजित आहे; शेतात खात्री करा.' : 'Stage is estimated from planting date; confirm it in the field.'}</Text>}
        <Text style={styles.muted}>{mr ? 'गणनेची गृहीतके' : 'Calculation assumptions'}: {irrigation.assumptions_note || (mr ? 'कार्यक्षमता निश्चित नाही.' : 'Efficiency has not been verified.')}</Text>
      </View>}
    </View>}
    <Text accessibilityRole="link" onPress={() => Linking.openURL('https://open-meteo.com/')} style={styles.footer}>Weather data © Open-Meteo</Text>
  </ScrollView>;
};
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7faf7' },
  content: { padding: 16, paddingBottom: 28, gap: 12, width: '100%', maxWidth: 900, alignSelf: 'center' },
  center: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 16 },
  title: { fontSize: 20, color: '#172c20', fontWeight: '700' },
  hero: { padding: 20, borderRadius: 20, backgroundColor: '#fff', gap: 10 },
  heroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  temperature: { fontSize: 48, fontWeight: '700', color: '#172c20' }, icon: { fontSize: 44 },
  condition: { fontSize: 20, color: '#254633' }, text: { fontSize: 15, lineHeight: 23, color: '#254633' },
  muted: { fontSize: 13, lineHeight: 20, color: '#596b60' },
  rain: { paddingVertical: 12, gap: 4, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#edf2ee' },
  inline: { flexDirection: 'row', flexWrap: 'wrap', gap: 18 },
  warning: { padding: 14, borderRadius: 12, backgroundColor: '#fff0cf', color: '#754b06', fontSize: 15 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#254633', marginTop: 4 },
  hourly: { gap: 8 }, hour: { padding: 12, minWidth: 86, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', gap: 6 },
  hourIcon: { fontSize: 23 }, rainText: { color: '#246585', fontSize: 12 },
  card: { borderRadius: 16, paddingHorizontal: 12, backgroundColor: '#fff' },
  day: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingVertical: 14, borderBottomWidth: 1, borderColor: '#edf2ee' },
  dayDate: { flex: 1, minWidth: 80, fontSize: 13, color: '#254633' }, dayValue: { fontSize: 13, color: '#254633' },
  irrigation: { padding: 16, borderRadius: 16, backgroundColor: '#eaf4ed', gap: 10 },
  button: { minHeight: 44, justifyContent: 'center', paddingVertical: 10 }, link: { color: '#185b35', fontSize: 14 },
  explanation: { gap: 8 }, footer: { fontSize: 12, color: '#596b60', paddingVertical: 10 },
});
