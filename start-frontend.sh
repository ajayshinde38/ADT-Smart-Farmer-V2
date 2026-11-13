#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/frontend"

echo "========================================================"
echo "  ADT Smart Farmer V2 - Expo Metro Bundler"
echo "  Web Preview:    http://localhost:8081"
echo "  Press 'w' in terminal for Web browser"
echo "========================================================"

export EXPO_PUBLIC_API_BASE_URL="${EXPO_PUBLIC_API_BASE_URL:-http://127.0.0.1:8002/api/v1}"
exec npx expo start --clear

