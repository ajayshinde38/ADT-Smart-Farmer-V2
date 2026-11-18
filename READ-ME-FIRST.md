# ADT Smart Farmer V2 — Update Pack (3 November 2026)

**Read this first.** This ZIP is an update to your **existing** Windows project, not a replacement for the whole project. It contains only changed source files. Keep your current `.env`, database credentials, model checkpoint, images, and installed dependencies on your own PC.

## What I changed

1. **GIS visibility and sharpness:** The map renders the real satellite raster using crisp pixels instead of blurry browser interpolation. The backend searches a 30-day window and builds a *multi-date cloud-free composite* from real Sentinel-2 observations. Pixels with no valid observation remain transparent. Their absence is reported rather than filled with made-up values. The actual sensor detail remains around 10–20 metres.
2. **Six GIS indices:** NDVI, EVI, NDRE, MSAVI, NDMI and NDWI can each be requested as a genuine spatial layer. The incorrect old `NDWI = NDMI` calculation was corrected; this version uses **green/NIR open-water NDWI**, distinct from NDMI's vegetation-moisture index. Generating images contacts Copernicus and can consume processing quota.
3. **VRA screening map:** Select **VRA zones** after generating NDVI. It highlights lower/medium/higher *relative canopy vigor* zones, preserving missing pixels. It **does not provide fertilizer, irrigation, or pesticide application rates**. Agronomic rate calibration requires field checks and further validation.
4. **Advisory:** Removed unsupported fixed fertilizer prescriptions, fake soil-moisture sensor readings, mock irrigation-valve controls, and pretend ordering confirmations. Displays available measured/estimated data and clearer cautions.
5. **Weather:** Clearer loading, refresh and data-source status; clarifies that irrigation guidance from forecasts is **not** a physical soil-moisture sensor reading.
6. **AI Scan:** Improved loading/error feedback and camera-control messages. No changes to the trained PyTorch checkpoint or the disease model's actual inference algorithm.
7. **Android/production safeguards:** Bundled native Leaflet assets and added a backend route for them. Added a release APK build profile that requires an HTTPS backend URL. Basic production configuration checks were added to the backend.

## Simple Windows installation — follow these steps

**Step 1.** Download `ADT-Smart-Farmer-V2-Updates.zip` from the ChatGPT response and save it in **Downloads**. Do **not** extract your original project ZIP or overwrite the whole project.

**Step 2.** Stop your running backend server and frontend (`Ctrl+C` in each terminal). Open PowerShell and paste:

```powershell
cd "C:\Users\ADT AI\Desktop\ADT-Smart-Farmer-V2"
```

**Step 3.** Save a backup of your current code:

```powershell
Copy-Item ".\backend\app" ".\backend\app-BACKUP" -Recurse
Copy-Item ".\frontend\src" ".\frontend\src-BACKUP" -Recurse
Copy-Item ".\frontend\app.json" ".\frontend\app-BACKUP.json"
Copy-Item ".\frontend\eas.json" ".\frontend\eas-BACKUP.json"
```

If you already have `app-BACKUP` or `src-BACKUP`, give the new backups a different name. **Never delete your `.env`, database, or model checkpoint.**

**Step 4.** Apply the ZIP *into the project root*:

```powershell
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\ADT-Smart-Farmer-V2-Updates.zip" -DestinationPath "." -Force
```

You should now see a new `backend\app\modules\gis\vra.py` and `frontend\app.config.js` inside your existing project. **If the ZIP was saved elsewhere, replace the Downloads path with its actual location.**

**Step 5.** Start the backend in PowerShell (terminal 1):

```powershell
cd "C:\Users\ADT AI\Desktop\ADT-Smart-Farmer-V2\backend"
python -m uvicorn app.main:app --host 0.0.0.0 --port 8002
```

If you use a Python virtual environment, activate it first. Keep this terminal open. Test `http://127.0.0.1:8002/docs` and `http://127.0.0.1:8002/map/leaflet.js`.

**Step 6.** Start the frontend in a *second* PowerShell terminal:

```powershell
cd "C:\Users\ADT AI\Desktop\ADT-Smart-Farmer-V2\frontend"
$env:EXPO_PUBLIC_API_BASE_URL="http://127.0.0.1:8002/api/v1"
npm.cmd run web
```

If Node dependencies are not installed on *your* PC, run `npm.cmd install` first. Expo will print a web URL, usually `http://localhost:8081`. If instead you normally serve the web build through port 8002, run `npm.cmd run build:web` after changing the source and then restart the backend.

## Check the GIS changes

1. Log in and open the **GIS** screen.
2. Press **Refresh satellite averages** if the recorded satellite observation is out of date.
3. Press **Generate all 6 real satellite layers**. These are **six consecutive Copernicus requests**, not six fake recolorings. They can take time, fail independently, or run into your Copernicus quota.
4. Switch between NDVI, EVI, NDRE, MSAVI, NDMI, NDWI.
5. For NDVI, select **VRA zones** to inspect low, medium, and stronger canopy zones.
6. Read the coverage percentage and multi-date window above the map. Any remaining blank areas are not valid satellite pixels. They should remain transparent; zooming cannot reveal detail finer than the satellite sensor.

Note: Old stored PNGs made before this fix may still display until you **regenerate** the corresponding layer. A fully transparent raster means no valid cloud-free observation was found; try another date window/source, not fake interpolation.

## Run the offline backend tests (optional)

```powershell
cd "C:\Users\ADT AI\Desktop\ADT-Smart-Farmer-V2\backend"
python -m pytest -q tests\test_gis_vra_and_rasters.py
```

If `pytest` is missing: `python -m pip install pytest`. The tests simulate GIS requests; they do not connect to your real Supabase or Copernicus accounts.

## Android APK — what still needs to happen

**There is NO finished APK in this package.** The current environment did not allow a complete npm/Expo or Android build. We added the configuration, but you must perform an Android build and test on a device.

**Pilot/testing APK (Android on your Wi-Fi network):** Set `EXPO_PUBLIC_API_BASE_URL` to `http://YOUR_PC_LAN_IP:8002/api/v1` (not `127.0.0.1`; a phone uses its own localhost) and make sure Windows Firewall permits port 8002. You can use the `pilot` EAS profile for an internal APK. This is not safe for public Internet use.

**Production APK:**

- Deploy FastAPI to a publicly reachable **HTTPS** domain (e.g., `https://api.example.com`); configure its credentials and a strong unique `JWT_SECRET` on the server, set `ENVIRONMENT=production`, `DEBUG=false`, and explicit HTTPS `CORS_ORIGINS`. Ensure private Supabase buckets and farm-ownership checks are configured. Do not place secrets in frontend files or the ZIP.
- Inside the `frontend` folder, configure an Expo EAS project and authenticate using the EAS CLI (`npx eas-cli login`, then `npx eas-cli init` if not already initialized). You need an Expo account and build credentials.
- In EAS build environment **production**, set `EXPO_PUBLIC_API_BASE_URL` to your HTTPS backend URL, including `/api/v1`. This is a public *client-facing URL*, not a secret. The `production-apk` profile requires this variable and rejects an HTTP URL.
- Build the APK on your Windows PC through EAS:

```powershell
cd "C:\Users\ADT AI\Desktop\ADT-Smart-Farmer-V2\frontend"
npx eas-cli build --platform android --profile production-apk
```

Once EAS reports a successful build, use the resulting EAS artifact link to download the APK, install it on a real Android phone, then test login, farm authorization, GIS, Weather, AI Scan, Advisory, and private images.

**Production-readiness is NOT yet certified:** No live Copernicus/Supabase regression test, full TypeScript typecheck, Android device test, security review or completed signed build happened here. Confirm these before release.

## If something goes wrong

- `No module named ...`: activate your previous Python environment and install the existing `backend\requirements.txt` as needed.
- `Failed to fetch`: confirm that the backend is running on port 8002 and the frontend URL points to the right server. Android devices cannot use your PC's `localhost`.
- `503` generating a GIS layer: verify your backend Copernicus credentials, Supabase secret, `satellite-tiff` private bucket, and service quota. Existing rasters are preserved when generation fails.
- `No valid satellite pixel`: the available Sentinel-2 data are cloud/shadow-masked; the backend deliberately does not fabricate coverage.
- If the updated UI does not appear, restart Expo or rebuild your Expo Web export; a previously built `frontend\dist` does not automatically refresh.
- To roll back, close the servers, restore backed-up `backend\app` and `frontend\src` and your backed-up frontend JSON configurations. If needed, remove the new `frontend\app.config.js` and `backend\app\modules\gis\vra.py` introduced by this update.

**Patch safety:** The ZIP does not include or replace `.env` files, Supabase keys, or `best_unet.pth`. It does not need to replace your existing `App.tsx` and `index.js` entrypoint files.
