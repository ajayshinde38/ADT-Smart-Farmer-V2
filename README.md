# ADT Smart Farmer V2 — Precision Agriculture Platform

An advanced agricultural intelligence platform integrating satellite remote sensing, microclimate analytics, AI crop-disease diagnosis, precision STCR fertigation planning, and an authorized administrative management workspace.

---

## Architecture Overview

```
                               ┌──────────────────────────────────────────────┐
                               │           Client Applications                │
                               ├──────────────────────┬───────────────────────┤
                               │  Farmer Mobile App   │ Admin Web Dashboard   │
                               │  (Expo / React Native│ (Expo Web / Vercel)   │
                               │   Android APK)       │                       │
                               └──────────┬───────────┴───────────┬───────────┘
                                          │                       │
                                          ▼                       ▼
                               ┌──────────────────────────────────────────────┐
                               │       FastAPI Production REST API            │
                               ├──────────────────────────────────────────────┤
                               │ • Auth: Phone OTP (Farmers) / Supabase Admin │
                               │ • Weather: Open-Meteo + FAO-56 Penman-Monteith│
                               │ • GIS: Sentinel-2 Indices (NDVI, EVI, NDRE)  │
                               │ • Crop Care: PyTorch UNet Inference Engine   │
                               │ • Advisory: ICAR STCR Fertilizer Calculator  │
                               └──────────────┬───────────────────────────────┘
                                              │
                      ┌───────────────────────┼───────────────────────┐
                      ▼                       ▼                       ▼
           ┌──────────────────────┐┌──────────────────────┐┌──────────────────────┐
           │   Supabase Postgres  ││ Sentinel-2 / CDSE    ││ Open-Meteo Commercial│
           │  (Canonical Farmers, ││ (Multispectral Tiles ││ (Hourly Ag Weather & │
           │   Boundaries, Scans) ││  & Raster Overlays)  ││  Cache Layer)        │
           └──────────────────────┘└──────────────────────┘└──────────────────────┘
```

---

## Core Capabilities

### 1. Farmer Mobile Application (Agri-Tech Precision / Stitch UI)
- **Design Tokens**: Material Design 3 elevation system, custom forest green palette (`#006e1c`, `#155438`, `#073c27`), Inter typography, responsive Bento grid.
- **Home Dashboard**: Live microclimate card, satellite health card (+4% trend badge, canopy moisture, chlorophyll), Today's Application Update (drip fertigation schedule), and SVG VPD Diurnal Trajectory chart.
- **Navigation**: Dual-mode top app bar with farmer profile, Pro pill, location badge, bilingual language switch (English & Marathi), and 5-tab bottom navigation with elevated center AI Scan action.
- **Settings & Profile**: Farmer portrait with verified badge, personal and farm metadata, active crop tags (acreage and planting dates), theme preferences, and help center.

### 2. Weather & Microclimate Intelligence
- **High-Resolution Telemetry**: Current temperature, relative humidity, wind speed, solar radiation, precipitation, and dew point.
- **Advanced Agrometeorology**: FAO-56 Penman-Monteith evapotranspiration ($\text{ET}_0$), Vapor Pressure Deficit ($\text{VPD}$ in kPa), and 7-day cumulative Growing Degree Days ($\text{GDD}$).
- **Actionable Insights**: 7-day interactive bar/line forecast, hourly drying trends, and rule-based Crop Scouting triggers.

### 3. GIS & Remote Sensing Visualization
- **Multi-Spectral Telemetry**: Seamless switching across 6 Sentinel-2 indices:
  - $\text{NDVI}$ (Normalized Difference Vegetation Index)
  - $\text{EVI}$ (Enhanced Vegetation Index)
  - $\text{NDRE}$ (Normalized Difference Red Edge — Chlorophyll)
  - $\text{MSAVI}$ (Modified Soil Adjusted Vegetation Index)
  - $\text{NDMI}$ (Normalized Difference Moisture Index)
  - $\text{NDWI}$ (Normalized Difference Water Index)
- **High-Precision Mapping**: Vector GeoJSON boundaries for all 25 canonical farms, interactive Leaflet tiles, and high-resolution raster overlay switching.

### 4. AI Pest & Crop Disease Detection
- **Viewfinder HUD**: 4:5 camera viewfinder with corner reticle brackets, lesion target center marker, torch/flash controls, and gallery picker.
- **Deep Learning Inference**: Mobile-optimized PyTorch UNet segmentation and classification with confidence score and stage badge.
- **Agronomic Remediation**: Stage-specific action advice, organic vs. chemical treatment protocols, and emergency agronomist contact.

### 5. Precision Fertigation & Advisory
- **ICAR STCR Equations**: Soil-test crop-response formulas calculating reference N-P-K nutrient targets based on actual soil chemistry ($\text{pH}, \text{OC}, \text{N}, \text{P}, \text{K}, \text{EC}$).
- **Fertilizer Prescriptions**: Product allocation across NPK 10:26:26, Urea, SOP, and MOP with stage splits and application windows.
- **Water Deficit Estimator**: 24-hour irrigation requirement in Liters and L/ha with soil moisture gauge and scheduled drip cycles.

### 6. Desktop-First Admin Management Workspace
- **Complete Farmer Registry**: Instant search and filtering across all 25 canonical farmers by name, mobile, PRN, village, and satellite coverage status.
- **Farmer 360° Inspection**: Tabbed multi-angle drill-down into GIS boundaries, live weather cache, crop care history, and advisory planning.
- **Analytics & Protected Export**: Village distribution, area distribution, satellite freshness, and protected CSV export.
- **Role-Based Security**: Strictly verified by FastAPI via Supabase `app_metadata` (`role: admin`), isolated from farmer JWTs.

---

## Directory Structure

```
ADT-Smart-Farmer-V2/
├── backend/                  # FastAPI Application
│   ├── app/
│   │   ├── admin/            # Admin Router, Security & Service
│   │   ├── auth/             # Farmer OTP & Supabase Auth
│   │   ├── core/             # Configuration, Database, Security & Operations
│   │   ├── farmers/          # Canonical Farmers Registry & Field Context
│   │   └── modules/
│   │       ├── advisory/     # STCR Nutrient & Fertigation Engines
│   │       ├── gis/          # Sentinel-2 GIS & Raster Overlays
│   │       ├── pest_disease/ # UNet Inference & History
│   │       └── weather/      # Open-Meteo & Agrometeorology
│   ├── tests/                # Comprehensive Integration Test Suite (50+ tests)
│   ├── .env.example          # Safe Backend Configuration Template
│   └── requirements.txt      # Python Dependencies
├── frontend/                 # Expo / React Native Application
│   ├── src/
│   │   ├── admin/            # Admin Dashboard, Detail, RegistryMap & Calculator
│   │   ├── assets/           # Fonts & Agricultural Illustrations
│   │   ├── components/       # UI Primitives, SVG Gauges, Maps & Charts
│   │   ├── navigation/       # Stitch RootNavigator & Tab Navigation
│   │   ├── screens/          # Dashboard, Weather, GIS, Pest, Advisory, Settings, Alerts
│   │   ├── services/         # API Client & Telemetry Services
│   │   ├── types/            # TypeScript Interfaces & Schemas
│   │   └── utils/            # GIS Color Scales & Calculations
│   ├── app.json              # Expo Configuration
│   ├── vercel.json           # Vercel Deployment Configuration (SPA Rewrites)
│   ├── .env.example          # Safe Frontend Configuration Template
│   └── package.json          # Node Dependencies & Build Scripts
├── database/                 # PostgreSQL Schema & Migrations
└── artifacts/                # Verification Evidence & Release Checkpoints
```

---

## Local Development Setup

### Prerequisites
- Python 3.11+
- Node.js 18+ & npm 9+
- Android Studio / Android Emulator (for mobile testing)

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your Supabase and Open-Meteo credentials
   ```
5. Run the FastAPI development server:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Expo development server:
   ```bash
   npm run start
   # For web preview:
   npm run web
   # For Android emulator:
   npm run android
   ```

---

## Running Verification Tests

Run the full pytest suite:
```bash
python -m pytest backend/tests -v
```

Run TypeScript compilation check:
```bash
cd frontend && npm run typecheck
```

Test static web production export:
```bash
cd frontend && npm run build:web
```

---

## Security & Privacy Policies

- **Zero Secret Commits**: All `.env`, private keys, keystores, and credentials are strictly excluded via `.gitignore`.
- **Administrative Access**: Admin endpoints reject farmer tokens and require verified Supabase `app_metadata` (`role: admin`).
- **Data Protection**: Personal farmer contact details are masked by default in the administrative directory and only revealed upon authorized inspection.
- **Genuine Data Integrity**: Agricultural telemetry, satellite indices, and soil tests reflect authoritative records without synthetic filler.
