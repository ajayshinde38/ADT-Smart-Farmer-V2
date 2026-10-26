import { FarmerProfile, GISData, WeatherData, AdvisoryData, DiseaseDetectionResult, DashboardData, HistoryData } from '../types';
import { Platform } from 'react-native';

// Dynamically resolve base URL: prioritize EXPO_PUBLIC_API_BASE_URL, then platform defaults
const getBaseUrl = (): string => {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (configured && /^https?:\/\//.test(configured)) return configured.replace(/\/$/,'');
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location && typeof window.location.origin === 'string' && window.location.origin.startsWith('http')) {
      return `${window.location.origin}/api/v1`;
    }
    return 'http://127.0.0.1:8000/api/v1';
  }
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000/api/v1';
  }
  return 'http://127.0.0.1:8000/api/v1';
};

export const API_BASE_URL = getBaseUrl();
export const getMapServerOrigin=()=>new URL(API_BASE_URL).origin;

export class ApiClient {
  private static token:string|null=null;
  static onUnauthorized:(()=>void)|null=null;
  static setToken(token:string|null){this.token=token;}
  static getToken(){return this.token;}
  private static async request<T>(path:string,options:RequestInit={},token:string|null=this.token):Promise<T>{
    const headers:Record<string,string>={...(options.body instanceof FormData?{}:{'Content-Type':'application/json'}),...(token?{Authorization:`Bearer ${token}`}:{})};
    const response=await fetch(API_BASE_URL+path,{...options,headers});
    if(!response.ok){if(response.status===401&&this.token&&token===this.token)this.onUnauthorized?.();const error=await response.json().catch(()=>({}));throw new Error(typeof error.detail==='string'?error.detail:'Request failed. Please try again.');}
    return response.json();
  }
  static login(phone:string){return this.request<any>('/auth/login',{method:'POST',body:JSON.stringify({phone})},null);}
  static sendOTP(phone:string){return this.request<{success:boolean;dev_hint?:string;message:string}>('/auth/send-otp',{method:'POST',body:JSON.stringify({phone})},null);}
  static verifyOTP(phone:string,otp:string){return this.request<any>('/auth/verify-otp',{method:'POST',body:JSON.stringify({phone,otp})},null);}
  static selectProfile(phone:string,farmerId:string,tempToken?:string){return this.request<any>('/auth/select-profile',{method:'POST',body:JSON.stringify({phone,farmer_id:farmerId})},tempToken||null);}
  static getDashboard(id:string){return this.request<DashboardData>(`/farmers/dashboard/${id}`);}
  static getGISPlot(id:string){return this.request<GISData>(`/gis/plot/${id}`);}
  static refreshGIS(id:string){return this.request<GISData>(`/gis/plot/${id}/refresh`,{method:'POST'});}
  static getWeather(id:string){return this.request<WeatherData>(`/weather/overview/${id}`);}
  static getAdvisory(id:string){return this.request<AdvisoryData>(`/advisory/farm/${id}`);}
  static detectDisease(form:FormData){return this.request<DiseaseDetectionResult>('/pest-disease/detect',{method:'POST',body:form});}
  static getScanHistory(id:string){return this.request<HistoryData>(`/pest-disease/history/${id}`);}
  static productComposition(id:string,product:string,quantity:number,unit:string){return this.request<{product_mass_kg:number;nutrients_kg:Record<string,number>;nutrients_kg_per_acre:Record<string,number>;note:string}>(`/advisory/farm/${id}/product-composition`,{method:'POST',body:JSON.stringify({product,quantity,unit})});}
  static async image(path:string){const response=await fetch(API_BASE_URL+path,{headers:this.token?{Authorization:`Bearer ${this.token}`}:{}});if(!response.ok)throw new Error('Image unavailable');return response.blob();}
}
export type GISPlotResponse=GISData;
