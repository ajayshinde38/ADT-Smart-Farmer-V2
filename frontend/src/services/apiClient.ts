
import {
  FarmerProfile,
  GISData,
  WeatherData,
  AdvisoryData,
  DiseaseDetectionResult,
  DashboardData,
  HistoryData,
} from '../types';

import { Platform } from 'react-native';

// Supported genuine Sentinel-2 vegetation and moisture indices.
export type GISRasterIndex =
  | 'ndvi'
  | 'evi'
  | 'ndre'
  | 'msavi'
  | 'ndmi'
  | 'ndwi';

// Resolve the configured API URL for Web and Android.
const getBaseUrl = (): string => {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL;

  if (configured && /^https?:\/\//.test(configured)) {
    return configured.replace(/\/$/, '');
  }

  if (Platform.OS === 'web') {
    if (
      typeof window !== 'undefined' &&
      window.location &&
      typeof window.location.origin === 'string' &&
      window.location.origin.startsWith('http')
    ) {
      return `${window.location.origin}/api/v1`;
    }

    return 'http://127.0.0.1:8000/api/v1';
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000/api/v1';
  }

  return 'http://127.0.0.1:8000/api/v1';
};


export const API_BASE_URL =
  Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    window.location.port === '8002'
    ? `${window.location.origin}/api/v1`
    : getBaseUrl();

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
    const headers: Record<string, string> = {
      ...(options.body instanceof FormData
        ? {}
        : { 'Content-Type': 'application/json' }),
      ...(token
        ? { Authorization: `Bearer ${token}` }
        : {}),
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

      throw new Error(
        typeof error.detail === 'string'
          ? error.detail
          : 'Request failed. Please try again.'
      );
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
