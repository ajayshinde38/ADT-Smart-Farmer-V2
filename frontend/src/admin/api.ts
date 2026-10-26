import { API_BASE_URL } from '../services/apiClient';
import { HistoryData,WeatherData } from '../types';
import { AdminOverview,AdminSession,DirectoryData,FarmerDetail,OperationsData } from './types';
export class AdminAPI{
  private static token:string|null=null;
  static onExpired:(()=>void)|null=null;
  static setToken(token:string|null){this.token=token;}
  static getToken(){return this.token;}
  private static async request<T>(path:string,options:RequestInit={}):Promise<T>{
    const response=await fetch(API_BASE_URL+'/admin'+path,{...options,headers:{'Content-Type':'application/json',...(this.token?{Authorization:`Bearer ${this.token}`}:{})}});
    if(!response.ok){if((response.status===401||response.status===403)&&this.token)this.onExpired?.();const error=await response.json().catch(()=>({}));throw new Error(typeof error.detail==='string'?error.detail:'Administrator request failed.');}
    return response.json();
  }
  static login(email:string,password:string){return this.request<AdminSession>('/auth/login',{method:'POST',body:JSON.stringify({email,password})});}
  static me(){return this.request<AdminSession['user']>('/me');}
  static overview(){return this.request<AdminOverview>('/overview');}
  static farmers(params:Record<string,string>={}){return this.request<DirectoryData>('/farmers?'+new URLSearchParams(params));}
  static farmer(id:string){return this.request<FarmerDetail>(`/farmers/${id}`);}
  static weather(id:string){return this.request<WeatherData>(`/farms/${id}/weather`);}
  static composition(id:string,product:string,quantity:number,unit:string){return this.request<{product_mass_kg:number;nutrients_kg:Record<string,number>;nutrients_kg_per_acre:Record<string,number>}>(`/farms/${id}/product-composition`,{method:'POST',body:JSON.stringify({product,quantity,unit})});}
  static scans(params:Record<string,string>={}){return this.request<HistoryData>('/scans?'+new URLSearchParams(params));}
  static operations(){return this.request<OperationsData>('/operations');}
  static gis(){return this.request<import('../types').GISData[]>('/gis/farms');}
  static async protectedBlob(path:string){const response=await fetch(API_BASE_URL+'/admin'+path,{headers:this.token?{Authorization:`Bearer ${this.token}`}:{}});if(!response.ok)throw new Error('Protected file unavailable');return response.blob();}
}
