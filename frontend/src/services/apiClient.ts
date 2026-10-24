import { FarmerProfile, GISData, WeatherData, AdvisoryData, DiseaseDetectionResult } from '../types';
import { Platform } from 'react-native';

// Dynamically resolve base URL: on web use window origin, on Android emulator use 10.0.2.2
const getBaseUrl = (): string => {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location && typeof window.location.origin === 'string' && window.location.origin.startsWith('http')) {
      return `${window.location.origin}/api/v1`;
    }
    return 'http://127.0.0.1:8000/api/v1';
  }
  const configured=process.env.EXPO_PUBLIC_API_BASE_URL;
  if (configured && /^https?:\/\//.test(configured)) return configured.replace(/\/$/,'');
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000/api/v1';
  }
  return 'http://127.0.0.1:8000/api/v1';
};

const API_BASE_URL = getBaseUrl();
export const getMapServerOrigin=()=>new URL(API_BASE_URL).origin;

export class ApiClient {
  private static token: string | null = null;

  static setToken(token: string | null) {
    this.token = token;
  }

  static getToken(): string | null {
    return this.token;
  }

  private static getHeaders(extraHeaders: Record<string, string> = {}) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...extraHeaders,
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  // Auth: Phone login (initiate verification challenge)
  static async login(phone: string) {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ phone }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to sign in. Please verify phone number.');
    }
    return res.json();
  }

  // Auth: Select profile for family account
  static async selectProfile(phone: string, farmerId: string, tempToken?: string) {
    const headers = this.getHeaders();
    if (tempToken) {
      headers['Authorization'] = `Bearer ${tempToken}`;
    }
    const res = await fetch(`${API_BASE_URL}/auth/select-profile`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ phone, farmer_id: farmerId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Profile selection failed.');
    }
    return res.json();
  }

  // Unified Dashboard (Aggregates GIS, Weather, and Advisory in 1 in-process backend call)
  static async getDashboard(farmId: string) {
    const res = await fetch(`${API_BASE_URL}/farmers/dashboard/${farmId}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load dashboard metrics.');
    return res.json();
  }

  // GIS: Satellite Plot Data
  static async getGISPlot(farmId: string): Promise<GISPlotResponse> {
    const res = await fetch(`${API_BASE_URL}/gis/plot/${farmId}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load GIS observations.');
    return res.json();
  }

  static async refreshGIS(farmId: string): Promise<GISPlotResponse> {
    const res = await fetch(`${API_BASE_URL}/gis/plot/${farmId}/refresh`, { method: 'POST', headers: this.getHeaders() });
    if (!res.ok) throw new Error('Satellite update unavailable');
    return res.json();
  }

  // Weather: 7-Day & Irrigation Physics
  static async getWeather(farmId: string): Promise<WeatherData> {
    const res = await fetch(`${API_BASE_URL}/weather/overview/${farmId}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load agro-weather metrics.');
    return res.json();
  }

  // Advisory: Soil STCR & Fertigation Schedule
  static async getAdvisory(farmId: string): Promise<AdvisoryData> {
    const res = await fetch(`${API_BASE_URL}/advisory/farm/${farmId}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load soil advisory.');
    return res.json();
  }

  // Pest & Disease: Real Image Upload Detection (PyTorch UNet)
  static async detectDisease(formData: FormData): Promise<DiseaseDetectionResult> {
    const headers: Record<string, string> = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    const res = await fetch(`${API_BASE_URL}/pest-disease/detect`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Disease scan failed.');
    }
    return res.json();
  }
}

export type GISPlotResponse = GISData;
