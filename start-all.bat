@echo off
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

