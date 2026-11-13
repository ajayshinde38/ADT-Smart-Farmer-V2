@echoajay@fedora:~/Documents/Internship_AI_ADT/Smart Farmer APP/ADT-Smart-Farmer-V2$ cd frontend
npm run build:web

> adt-smart-farmer-v2@2.0.0 build:web
> expo export --platform web

Error: Error reading Expo config at /home/ajay/Documents/Internship_AI_ADT/Smart Farmer APP/ADT-Smart-Farmer-V2/frontend/app.config.js:

Set EXPO_PUBLIC_API_BASE_URL=http(s)://YOUR-BACKEND/api/v1 before building APK.
Error: Error reading Expo config at /home/ajay/Documents/Internship_AI_ADT/Smart Farmer APP/ADT-Smart-Farmer-V2/frontend/app.config.js:

Set EXPO_PUBLIC_API_BASE_URL=http(s)://YOUR-BACKEND/api/v1 before building APK.
    at module.exports (/home/ajay/Documents/Internship_AI_ADT/Smart Farmer APP/ADT-Smart-Farmer-V2/frontend/app.config.js:6:11)
    at resolveConfigExport (/home/ajay/Documents/Internship_AI_ADT/Smart Farmer APP/ADT-Smart-Farmer-V2/frontend/node_modules/@expo/config/build/evalConfig.js:152:14)
    at evalConfig (/home/ajay/Documents/Internship_AI_ADT/Smart Farmer APP/ADT-Smart-Farmer-V2/frontend/node_modules/@expo/config/build/evalConfig.js:92:10)
    at readConfigFile (/home/ajay/Documents/Internship_AI_ADT/Smart Farmer APP/ADT-Smart-Farmer-V2/frontend/node_modules/@expo/config/build/getConfig.js:45:41)
    at getDynamicConfig (/home/ajay/Documents/Internship_AI_ADT/Smart Farmer APP/ADT-Smart-Farmer-V2/frontend/node_modules/@expo/config/build/getConfig.js:54:18)
    at getConfig (/home/ajay/Documents/Internship_AI_ADT/Smart Farmer APP/ADT-Smart-Farmer-V2/frontend/node_modules/@expo/config/build/Config.js:280:43)
    at resolveOptionsAsync (/home/ajay/Documents/Internship_AI_ADT/Smart Farmer APP/ADT-Smart-Farmer-V2/frontend/node_modules/@expo/cli/build/src/export/resolveOptions.js:62:46)
ajay@fedora:~/Documents/Internship_AI_ADT/Smart Farmer APP/ADT-Smart-Farmer-V2/frontend$ cd ..
source backend/.venv/bin/activate
python -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8002
2026-11-08 16:24:45,057 - adt_smart_farmer_v2 - INFO - Serving built Expo web frontend from /home/ajay/Documents/Internship_AI_ADT/Smart Farmer APP/ADT-Smart-Farmer-V2/frontend/dist
INFO:     Started server process [618040]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
ERROR:    [Errno 98] error while attempting to bind on address ('0.0.0.0', 8002): address already in use
INFO:     Waiting for application shutdown.
INFO:     Application shutdown complete. off
title ADT Smart Farmer V2 - Launcher
cd /d "%~dp0"
echo ========================================================
echo   Launching ADT Smart Farmer V2 (Backend + Frontend)
echo ========================================================
start "ADT Backend (:8002)" "%~dp0start-backend.bat"
timeout /t 3 /nobreak >nul
start "ADT Frontend Metro (:8081)" "%~dp0start-frontend.bat"
echo.
echo Both servers have been launched in separate windows!
echo - Backend API: http://localhost:8002/api/v1/health
echo - Frontend Web: http://localhost:8081
echo.
pause

