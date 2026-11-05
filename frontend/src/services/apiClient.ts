
import {
  FarmerProfile,
  GISData,
  WeatherData,
  AdvisoryData,
  DiseaseDetectionResult,
  DashboardData,
  HistoryData,
  VraSummary,
  FertigationScheduleData,
} from '../types';

import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Supported genuine Sentinel-2 vegetation and moisture indices.
export type GISRasterIndex =
  | 'ndvi'
  | 'evi'
  | 'ndre'
  | 'msavi'
  | 'ndmi'
  | 'ndwi'
  | 'vra';

const getMetroHost = (): string | null => {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest?.debuggerHost ||
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;
  if (hostUri) {
    return hostUri.split(':')[0];
  }
  return null;
};

// Resolve the configured API URL for Web and Android.
const getBaseUrl = (): string => {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

  if (Platform.OS === 'web') {
    // The single-server LAN app serves both the UI and API on port 8002.
    // Prefer that origin even if an older build setting still names port 8000.
    if (typeof window !== 'undefined' && window.location?.port === '8002') {
      return `${window.location.origin}/api/v1`;
    }
    if (configured && /^https?:\/\//.test(configured)) {
      return configured.replace(/\/$/, '');
    }
    if (
      typeof window !== 'undefined' &&
      window.location &&
      typeof window.location.origin === 'string' &&
      window.location.origin.startsWith('http')
    ) {
      if (window.location.port === '8081' || window.location.port === '19006') {
        return `${window.location.protocol}//${window.location.hostname}:8002/api/v1`;
      }
      return `${window.location.origin}/api/v1`;
    }
    return 'http://127.0.0.1:8002/api/v1';
  }

  // Mobile (Android / iOS)
  const metroHost = getMetroHost();
  if (configured && /^https?:\/\//.test(configured)) {
    // If configured with loopback or 127.0.0.1 on mobile, route to the host machine
    if (/https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(configured)) {
      if (metroHost) {
        return configured.replace(/https?:\/\/(localhost|127\.0\.0\.1)/i, `http://${metroHost}`).replace(/\/$/, '');
      }
      if (Platform.OS === 'android') {
        return configured.replace(/https?:\/\/(localhost|127\.0\.0\.1)/i, 'http://10.0.2.2').replace(/\/$/, '');
      }
    }
    return configured.replace(/\/$/, '');
  }

  if (metroHost) {
    return `http://${metroHost}:8002/api/v1`;
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8002/api/v1';
  }

  return 'http://127.0.0.1:8002/api/v1';
};

export const API_BASE_URL = getBaseUrl();

export const getMapServerOrigin = () =>
  new URL(API_BASE_URL).origin;

export class ApiClient {
  private static token: string | null = null;

  static onUnauthorized: (() => void) | null = null;

  static setToken(token: string | null) {
    this.token = token;
  }

  static getToken() {
    return this.token;
  }

  private static async request<T>(
    path: string,
    options: RequestInit = {},
    token: string | null = this.token
  ): Promise<T> {
    const isForm =
      options.body instanceof FormData ||
      (options.body && typeof (options.body as any).append === 'function') ||
      Boolean((options.body as any)?._parts);

    const headers: Record<string, string> = {
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const response = await fetch(API_BASE_URL + path, {
      ...options,
      headers,
    });

    if (!response.ok) {
      if (
        response.status === 401 &&
        this.token &&
        token === this.token
      ) {
        this.onUnauthorized?.();
      }

      const error = await response.json().catch(() => ({}));
      let errorMessage = response.status >= 500 && path === '/pest-disease/detect'
        ? 'The scan service could not complete this photo. Your photo is kept; retry shortly.'
        : 'Request failed. Please try again.';
      if (typeof error.detail === 'string') {
        errorMessage = error.detail;
      } else if (Array.isArray(error.detail) && error.detail.length > 0) {
        errorMessage = error.detail.map((d: any) => d.msg || JSON.stringify(d)).join('; ');
      }
      console.warn('API error:', response.status, errorMessage, error);

      throw new Error(errorMessage);
    }

    return response.json();
  }

  // =====================================================
  // AUTHENTICATION
  // =====================================================

  static login(phone: string) {
    return this.request<any>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ phone }),
      },
      null
    );
  }

  static sendOTP(phone: string) {
    return this.request<{
      success: boolean;
      dev_hint?: string;
      message: string;
    }>(
      '/auth/send-otp',
      {
        method: 'POST',
        body: JSON.stringify({ phone }),
      },
      null
    );
  }

  static verifyOTP(phone: string, otp: string) {
    return this.request<any>(
      '/auth/verify-otp',
      {
        method: 'POST',
        body: JSON.stringify({ phone, otp }),
      },
      null
    );
  }

  static selectProfile(
    phone: string,
    farmerId: string,
    tempToken?: string
  ) {
    return this.request<any>(
      '/auth/select-profile',
      {
        method: 'POST',
        body: JSON.stringify({
          phone,
          farmer_id: farmerId,
        }),
      },
      tempToken || null
    );
  }

  // =====================================================
  // FARM DASHBOARD
  // =====================================================

  static getDashboard(id: string) {
    return this.request<DashboardData>(
      `/farmers/dashboard/${id}`
    );
  }

  // =====================================================
  // GIS AND SATELLITE IMAGERY
  // =====================================================

  // Read farm boundary, satellite averages, and raster metadata.
  static getGISPlot(id: string) {
    return this.request<GISData>(
      `/gis/plot/${id}`
    );
  }

  // Refresh genuine field-average satellite observations.
  // This does not generate per-pixel raster images.
  static refreshGIS(id: string) {
    return this.request<GISData>(
      `/gis/plot/${id}/refresh`,
      {
        method: 'POST',
      }
    );
  }

  // Returns NDVI-derived relative vigor zones. Never fertilizer prescriptions.
  static getVraSummary(farmId: string) {
    return this.request<VraSummary>(`/gis/plot/${farmId}/vra/summary`);
  }

  // Generate ONE genuine spatial satellite layer.
  //
  // This uses the currently authenticated farmer token.
  // The backend must verify that the farmer owns the farm.
  //
  // The server requests real cloud-masked Sentinel-2
  // pixels and stores the resulting PNG in private
  // Supabase Storage.
  //
  // Call this only after a user explicitly presses
  // "Generate Satellite Layer".
  static generateGISRaster(
    farmId: string,
    index: GISRasterIndex
  ): Promise<GISData> {
    const supported: GISRasterIndex[] = [
      'ndvi',
      'evi',
      'ndre',
      'msavi',
      'ndmi',
      'ndwi',
      'vra',
    ];

    if (!supported.includes(index)) {
      return Promise.reject(
        new Error('Unsupported satellite index.')
      );
    }

    if (!farmId) {
      return Promise.reject(
        new Error('Farm ID is required.')
      );
    }

    return this.request<GISData>(
      `/gis/plot/${encodeURIComponent(farmId)}` +
      `/raster/${index}/generate`,
      {
        method: 'POST',
      }
    );
  }

  // =====================================================
  // WEATHER
  // =====================================================

  static getWeather(id: string) {
    return this.request<WeatherData>(
      `/weather/overview/${id}`
    );
  }

  // =====================================================
  // ADVISORY
  // =====================================================

  static getAdvisory(id: string) {
    return this.request<AdvisoryData>(
      `/advisory/farm/${id}`
    );
  }

  // =====================================================
  // PEST AND DISEASE DETECTION
  // =====================================================

  static async detectDisease(form: FormData) {
    const controller = new AbortController();

    const timer = setTimeout(
      () => controller.abort(),
      180000
    );

    try {
      return await this.request<DiseaseDetectionResult>(
        '/pest-disease/detect',
        {
          method: 'POST',
          body: form,
          signal: controller.signal,
        }
      );
    } finally {
      clearTimeout(timer);
    }
  }

  static getDiseaseDetail(name: string) {
    return this.request<NonNullable<DiseaseDetectionResult['disease_details']>>('/pest-disease/catalog/'+encodeURIComponent(name));
  }

  static getScanHistory(id: string) {
    return this.request<HistoryData>(
      `/pest-disease/history/${id}`
    );
  }

  // =====================================================
  // PRODUCT COMPOSITION
  // =====================================================

  static productComposition(
    id: string,
    product: string,
    quantity: number,
    unit: string
  ) {
    return this.request<{
      product_mass_kg: number;
      nutrients_kg: Record<string, number>;
      nutrients_kg_per_acre: Record<string, number>;
      note: string;
    }>(
      `/advisory/farm/${id}/product-composition`,
      {
        method: 'POST',
        body: JSON.stringify({
          product,
          quantity,
          unit,
        }),
      }
    );
  }

  static fertilizerPlan(id: string, applied: Record<string, number>, cycle?: {crop_season?:string;plantation_date?:string}) {
    return this.request<AdvisoryData>(`/advisory/farm/${id}/plan`, {
      method: 'POST', body: JSON.stringify({applied_till_date: applied,...cycle}),
    });
  }

  static getFertigationSchedule(farmId: string) {
    return this.request<FertigationScheduleData>(`/advisory/farm/${farmId}/schedule`);
  }

  static getScanAnalysis(farmId:string,recordId:string) {
    return this.request<{available:boolean;analysis:DiseaseDetectionResult|null;reason:string|null}>(
      `/pest-disease/history/${farmId}/analysis/${recordId}`);
  }

  static confirmScheduleDose(
    farmId: string,
    period: string,
    applied: boolean,
    notes?: string
  ) {
    return this.request<{ status: string; record: any; schedule: FertigationScheduleData }>(
      `/advisory/farm/${farmId}/schedule/confirm`,
      {
        method: 'POST',
        body: JSON.stringify({ period, applied, notes }),
      }
    );
  }

  static getScheduleCompliance(farmId: string) {
    return this.request<{ by_period: Record<string, any> }>(
      `/advisory/farm/${farmId}/schedule/compliance`
    );
  }

  // =====================================================
  // AUTHENTICATED IMAGE FETCH
  // =====================================================

  static async image(path: string) {
    const response = await fetch(
      API_BASE_URL + path,
      {
        headers: this.token
          ? {
            Authorization: `Bearer ${this.token}`,
          }
          : {},
      }
    );

    if (!response.ok) {
      throw new Error('Image unavailable');
    }

    return response.blob();
  }
}

export type GISPlotResponse = GISData;
