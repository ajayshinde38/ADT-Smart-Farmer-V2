import { WeatherData } from '../types';
export const shortDate = (value: string | null | undefined, language: 'en' | 'mr') => {
  if (!value) return '—';
  const date = new Date(value.length === 10 ? `${value}T12:00:00+05:30` : value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString(language === 'mr' ? 'mr-IN' : 'en-IN', { timeZone:'Asia/Kolkata', day:'numeric', month:'short' }) : '—';
};
export const freshWeather = (data: WeatherData | null | undefined, now=Date.now()) => {
  const updated = Date.parse(data?.last_updated_utc || '');
  return Number.isFinite(updated) && updated <= now && now-updated <= 900000 && data?.cache_expires_in_seconds !== 0;
};
export const stageLabel = (stage: string | null | undefined, language: 'en' | 'mr') => {
  if (!stage || stage === 'Unknown') return language === 'mr' ? 'नोंदलेली नाही' : 'Not recorded';
  const mr: Record<string,string> = {Sprouting:'उगवण',Tillering:'फुटवे अवस्था','Grand Growth':'जोमदार वाढ',Vegetative:'वाढीची अवस्था',Maturity:'पक्वता','Harvest Ready':'तोडणीची अवस्था'};
  return language === 'mr' ? mr[stage] || stage : stage;
};
export const conditionLabel = (condition: string | undefined, language: 'en' | 'mr') => {
  const mr: Record<string,string> = {'Clear Sky':'निरभ्र आकाश','Mainly Clear':'बहुतांश निरभ्र','Partly Cloudy':'अंशतः ढगाळ',Overcast:'ढगाळ',Foggy:'धुके','Depositing Rime Fog':'दाट धुके','Light Drizzle':'हलकी रिमझिम','Moderate Drizzle':'रिमझिम पाऊस','Dense Drizzle':'जोरदार रिमझिम','Slight Rain':'हलका पाऊस','Moderate Rain':'मध्यम पाऊस','Heavy Rain':'जोरदार पाऊस','Rain Showers':'पावसाच्या सरी','Moderate Showers':'मध्यम सरी','Violent Showers':'जोरदार सरी',Thunderstorm:'मेघगर्जनेसह पाऊस','Thunderstorm with Hail':'मेघगर्जना व गारपीट'};
  return condition ? language === 'mr' ? mr[condition] || condition : condition : '—';
};
