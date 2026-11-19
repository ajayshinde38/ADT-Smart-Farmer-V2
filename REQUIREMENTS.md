# ADT Smart Farmer V2 - Complete Project Requirements Specification

This document provides the authoritative technical, hardware, software, architectural, and network requirements for running, deploying, and developing the **ADT Smart Farmer V2** platform.

---

## 1. System Architecture Overview

ADT Smart Farmer V2 is an integrated precision agriculture system tailored for sugarcane farming in Maharashtra, India. It consolidates four critical agricultural intelligence domains into a single unified backend runtime serving both an Expo/React Native cross-platform application (Web & Android APK) and external data integrations:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        User & Device Layer                             │
│   • Web Browsers (Chrome, Edge, Safari, Firefox on Desktop / Mobile)   │
│   • Android Mobile Application (Standalone APK / Expo Go)             │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ HTTP/JSON (Port 8002 / 8081)
┌────────────────────────────────────▼───────────────────────────────────┐
│              FastAPI Unified Backend Engine (Port 8002)                │
│                                                                        │
│   ┌─────────────────────┐                     ┌────────────────────┐   │
│   │ 1. GIS & Remote     │                     │ 2. Microclimate    │   │
│   │    Sensing (S2)     │                     │    Weather Engine  │   │
│   ├─────────────────────┤                     ├────────────────────┤   │
│   │ 3. Variable Rate    │                     │ 4. Leaf Disease    │   │
│   │    Fertigation (VRA)│                     │    Dual-Scan Vision│   │
│   └─────────────────────┘                     └────────────────────┘   │
│                                                                        │
│   Integrated Auth (OTP + JWT) │ Leaflet Map CDN │ Static Web SPA Host  │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
┌───────────────────▼─────────────┐    ┌─────────────▼───────────────────┐
│   External Data Providers       │    │   Supabase Cloud Platform       │
│   • Copernicus CDSE Sentinel-2  │    │   • PostgreSQL with PostGIS     │
│   • Open-Meteo & NASA POWER     │    │   • Cloud Storage Buckets       │
└─────────────────────────────────┘    └─────────────────────────────────┘
```

---

## 2. Hardware & Infrastructure Prerequisites

| Component | Minimum Requirements | Recommended (Production) |
| :--- | :--- | :--- |
| **Processor (CPU)** | 2 vCPUs / Cores (x86_64 or ARM64) | 4+ vCPUs (Intel/AMD or Apple Silicon / Graviton) |
| **System Memory (RAM)** | 4 GB RAM | 8 GB+ RAM (ensures fast PyTorch inference & GIS rasters) |
| **Storage (Disk)** | 10 GB free disk space | 25 GB+ SSD / NVMe |
| **Network Interface** | Standard 100 Mbps Ethernet / Wi-Fi | 1 Gbps LAN / High-speed broadband |
| **GPU (Optional)** | Not required (CPU PyTorch is default) | NVIDIA CUDA GPU (optional acceleration) |

---

## 3. Operating System & Runtime Requirements

### Operating System Support
- **Windows**: Windows 10 (Build 19041+) or Windows 11 (64-bit) with PowerShell 5.1+ or 7+.
- **Linux**: Ubuntu 22.04 LTS / 24.04 LTS, Debian 12 (Bookworm), CentOS Stream / Rocky Linux 9.
- **macOS**: macOS 13 (Ventura) or later (Apple Silicon M1-M4 or Intel x86_64).

### Runtimes & Native Tools
- **Python**: `3.10.x`, `3.11.x`, or `3.12.x` (64-bit).
- **Node.js**: `v18.x` or `v20.x` LTS (`v20.18+` recommended).
- **npm**: `v9.x` or `v10.x` (bundled with Node.js).
- **Git**: `2.30+` for version control.
- **Native OS Libraries (Linux only)**:
  ```bash
  sudo apt-get update && sudo apt-get install -y ca-certificates libgomp1 libgeos-c1v5
  ```

---

## 4. Backend Dependencies Specification (`backend/requirements.txt`)

The Python backend is built with FastAPI, PyTorch, and geospatial scientific libraries:

| Category | Package Name | Minimum Version | Purpose / Role |
| :--- | :--- | :--- | :--- |
| **ASGI Server & Web API** | `fastapi` | `0.115.0` | High-performance asynchronous REST API framework |
| | `uvicorn[standard]` | `0.30.0` | Production ASGI web server running on port `8002` |
| | `pydantic` | `2.7.0` | Robust request/response schema modeling and validation |
| | `pydantic-settings` | `2.4.0` | Type-safe environment variable management |
| | `python-multipart` | `0.0.9` | Form data and image upload handling for leaf diagnostics |
| **HTTP Clients & External APIs**| `httpx` | `0.27.0` | Asynchronous HTTP client for Sentinel-2, Open-Meteo, Supabase |
| | `requests` | `2.31.0` | Synchronous HTTP client for helper utilities and scripts |
| **Authentication & Security** | `pyjwt` | `2.8.0` | HMAC-SHA256 JWT access tokens for farmer and admin sessions |
| | `cryptography` | `42.0.0` | Cryptographic primitives and hashing |
| **Database & ORM** | `sqlalchemy` | `2.0.30` | Core ORM and connection pooling |
| | `asyncpg` | `0.29.0` | Asynchronous PostgreSQL driver for PostGIS queries |
| | `psycopg2-binary` | `2.9.9` | Binary sync driver for database migrations and seeds |
| **Spatial & Geospatial Math** | `numpy` | `1.26.0` | Matrix math for NDVI, NDRE, NDWI calculation and VRA grids |
| | `shapely` | `2.0.0` | Planar geometry, polygon validation, KML parsing |
| | `scipy` | `1.12.0` | Scientific interpolation and spatial grid calculations |
| **File & Spreadsheet Parsers** | `pillow` | `10.0.0` | Image resizing, normalization, and tensor preprocessing |
| | `openpyxl` | `3.1.2` | Extraction of 14-parameter soil laboratory test reports (.xlsx) |
| **Machine Learning & Vision** | `torch` | `2.2.0` | PyTorch runtime for dual-scan neural network inference |
| | `torchvision` | `0.17.0` | Computer vision transforms and pretrained model backbones |
| | `segmentation-models-pytorch`| `0.3.3` | U-Net semantic segmentation for diseased leaf area quantification |
| | `timm` | `1.0.0` | EfficientNet-B0 backbone for disease classification |
| **Environment Configuration** | `python-dotenv` | `1.0.0` | Loads `.env` file into process environment |
| **Testing & Quality Assurance**| `pytest` | `8.0.0` | Unit and integration test suite |
| | `pytest-asyncio` | `0.23.0` | Asynchronous fixture and route testing |

---

## 5. Frontend Dependencies Specification (`frontend/package.json`)

The client interface is built with React Native and Expo SDK 52 for unified Web and Android APK execution:

| Category | Package Name | Version | Purpose / Role |
| :--- | :--- | :--- | :--- |
| **Core Framework** | `expo` | `~52.0.49` | Universal mobile & web application framework |
| | `react` | `18.3.1` | Component UI engine |
| | `react-dom` | `18.3.1` | Web rendering layer |
| | `react-native` | `0.76.9` | Native mobile bridge |
| | `react-native-web` | `~0.19.13` | Web compilation for React Native components |
| **Navigation** | `@react-navigation/native` | `^6.1.17` | Navigation state manager |
| | `@react-navigation/native-stack`| `^6.9.26` | Stack router for Auth, Details, History screens |
| | `@react-navigation/bottom-tabs` | `^6.5.20` | Primary bottom tab navigation (Farm, Weather, Advisory, Scan) |
| **GIS & Interactive Maps** | `leaflet` | `^1.9.4` | Offline/Online interactive polygon & satellite raster renderer |
| | `@types/leaflet` | `^1.9.22` | TypeScript definitions for Leaflet |
| | `react-native-webview` | `13.12.5` | Native Android container for the Leaflet GIS canvas |
| **Sensors, Camera & Assets** | `expo-image-picker` | `~16.0.6` | Leaf camera capture and photo gallery picker |
| | `expo-linear-gradient` | `~14.0.0` | Modern gradient cards and agricultural data cards |
| | `react-native-svg` | `15.8.0` | Vector icons and charts |
| | `@react-native-async-storage/async-storage` | `1.23.1` | Persistent local storage for JWT tokens and offline farmer profiles |
| **Build & Tooling** | `typescript` | `~5.3.3` | Static type safety |
| | `@expo/metro-runtime` | `~4.0.1` | Fast Refresh bundler engine |

---

## 6. Database & Cloud Storage Architecture

The application connects to a managed **Supabase PostgreSQL** instance with **PostGIS** extension enabled:

### PostgreSQL Tables
1. **`farmers`**: Authoritative farmer profiles (ID, name, mobile, address, PRN).
2. **`farms`**: Farm plot details, centroid coordinates, boundary geometry (GeoJSON polygon), variety (`Co 86032`), plantation type (`Adsali`, `Suru`, `Pre-seasonal`, `Ratoon`).
3. **`soil_test_records`**: 14 authoritative lab parameters:
   - Macros: Nitrogen (`N`), Phosphorus (`P`), Potassium (`K`) in kg/ha.
   - Soil Properties: `pH`, Electrical Conductivity (`EC`), Organic Carbon (`OC`), `Na`, `CaCO3`.
   - Micronutrients: Iron (`Fe`), Magnesium (`Mg`), Zinc (`Zn`), Copper (`Cu`), Sulphur (`S`), Boron (`B`) in ppm.
4. **`sentinel_observations`**: Historical multi-spectral observations (NDVI, NDRE, EVI, NDMI, NDWI, cloud cover %, acquisition timestamp).
5. **`vra_prescriptions`**: Precision zone-based variable rate fertilizer recommendations (Urea, DAP, MOP per zone).
6. **`fertigation_schedules`**: 14-stage crop lifecycle fertigation calendar tailored to sugarcane planting age.
7. **`disease_records`**: Dual-scan diagnosis logs (image URL, predicted disease, confidence %, affected leaf surface area %, spray recommendations).
8. **`audit_logs`**: System event tracking and security monitoring.

### Storage Buckets (Supabase Storage)
- **`farm-boundaries`**: GeoJSON and KML polygon boundaries.
- **`kml-storage`**: Uploaded farmer KML files for geospatial parsing.
- **`models`**: Remote storage for AI model weights:
  - `best_sugarcane_efficientnetb0.pth` (~16.3 MB)
  - `best_unet.pth` (uploaded as 3 chunks: `.part0`, `.part1`, `.part2`, ~97.9 MB total)

---

## 7. Network & Port Configuration

| Port | Service | Host Binding | Accessibility | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **`8002`** | FastAPI Backend | `0.0.0.0` | Localhost & Local Network (Wi-Fi/LAN) | REST API endpoints, Swagger Docs (`/docs`), Leaflet assets, SPA web delivery |
| **`8081`** | Expo Metro Bundler | `0.0.0.0` | Localhost & Local Network (Wi-Fi/LAN) | Mobile development server, Expo Go bridge, Web live development |

### Windows Firewall Rule Configuration
To allow other devices (smartphones, tablets, laptops) on the same Wi-Fi / Local Area Network to connect:
```powershell
New-NetFirewallRule -DisplayName "ADT Smart Farmer Backend (8002)" -Direction Inbound -LocalPort 8002 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "ADT Smart Farmer Metro (8081)" -Direction Inbound -LocalPort 8081 -Protocol TCP -Action Allow
```

---

## 8. Environment Variables Specification

### Backend Configuration (`backend/.env`)
```env
PROJECT_NAME="ADT Smart Farmer V2"
VERSION="2.0.0"
ENVIRONMENT="development"
DEBUG=true
HOST="0.0.0.0"
PORT=8002

# Supabase Credentials
SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
SUPABASE_KEY="YOUR_SUPABASE_SERVICE_ROLE_KEY"
SUPABASE_SECRET_KEY="YOUR_SUPABASE_SERVICE_ROLE_KEY"
SUPABASE_PUBLISHABLE_KEY="YOUR_SUPABASE_ANON_KEY"
DATABASE_URL="postgresql://postgres:PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres"

# JWT Authentication
JWT_SECRET="adt-smart-farmer-v2-dev-secret-key-change-in-production"
JWT_ALGORITHM="HS256"
ACCESS_TOKEN_EXPIRE_MINUTES=10080

# External APIs
OPEN_METEO_API_KEY=""
OPEN_METEO_BASE_URL="https://api.open-meteo.com"
CDSE_CLIENT_ID=""
CDSE_CLIENT_SECRET=""
```

### Frontend Configuration (`frontend/.env.local`)
```env
# IP Address of the host machine on the local network (from ipconfig)
EXPO_PUBLIC_API_BASE_URL="http://172.16.8.197:8002/api/v1"
```

---

## 9. Verification & Demo Farmer Profile

The database includes a pre-seeded test farmer profile for testing:

| Attribute | Value |
| :--- | :--- |
| **Farmer Name** | Ajay Shinde |
| **Mobile Number** | `9876543210` |
| **Dev OTP Code** | `123456` |
| **Permanent Reg. No (PRN)** | `2836` |
| **Location** | Beed, Maharashtra, India (`19.103832° N, 76.312185° E`) |
| **Crop & Variety** | Sugarcane (`Co 86032`), Adsali planting cycle |
| **Land Area** | 5.0 Acres (derived from verified KML boundary) |
| **Soil Analysis** | pH: `7.65`, EC: `0.38 dS/m`, OC: `0.62%`, N: `145 kg/ha`, P: `18.4 kg/ha`, K: `325 kg/ha`, Na: `1.12%`, CaCO3: `4.25%`, Fe: `4.85 ppm`, Mg: `1.62%`, Zn: `0.74 ppm`, Cu: `0.88 ppm`, S: `14.5 ppm`, B: `0.68 ppm` |

---

## 10. Startup Command Reference

### Starting the Backend (Local Network)
```powershell
$env:PYTHONPATH="backend"
python -m uvicorn app.main:app --host 0.0.0.0 --port 8002
```

### Starting the Frontend (Local Network)
```powershell
cd frontend
npx expo start --host lan
```
