@echo off
title ADT Smart Farmer V2 - Backend (:8002)
cd /d "%~dp0"
echo ========================================================
echo   ADT Smart Farmer V2 - Consolidated FastAPI Backend
echo   Binding: 0.0.0.0:8002 (Localhost + Local Network LAN)
echo   Docs:    http://localhost:8002/docs
echo   Health:  http://localhost:8002/api/v1/health
echo ========================================================
python -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8002 --reload
pause

