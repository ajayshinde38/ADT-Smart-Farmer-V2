#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

if [ -d "backend/.venv" ]; then
    source backend/.venv/bin/activate
fi

echo "========================================================"
echo "  ADT Smart Farmer V2 - Consolidated FastAPI Backend"
echo "  Binding: 0.0.0.0:8002 (Localhost + Local Network LAN)"
echo "  Docs:    http://localhost:8002/docs"
echo "  Health:  http://localhost:8002/api/v1/health"
echo "========================================================"

exec python3 -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8002 --reload

