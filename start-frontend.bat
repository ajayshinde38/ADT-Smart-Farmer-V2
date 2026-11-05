@echo off
title ADT Smart Farmer V2 - Frontend Metro (:8081)
cd /d "%~dp0frontend"
echo ========================================================
echo   ADT Smart Farmer V2 - Expo Metro Bundler
echo   Web Preview:    http://localhost:8081
echo   Press 'w' in terminal for Web
echo   Press 'a' in terminal for Android Emulator
echo   Scan QR Code in terminal with Expo Go app on Phone
echo ========================================================
npx expo start --clear
pause

