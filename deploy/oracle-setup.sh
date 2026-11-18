#!/usr/bin/env bash
set -euo pipefail

echo "============================================================"
echo "  ADT Smart Farmer V2 — Oracle Cloud Ubuntu 24/7 Installer"
echo "============================================================"

# 1. Install Docker & Compose plugin if missing
if ! command -v docker >/dev/null 2>&1; then
  echo "[1/5] Installing Docker..."
  sudo apt-get update
  sudo apt-get install -y ca-certificates curl gnupg git
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER" || true
else
  echo "[1/5] Docker already installed."
fi

# 2. Open Oracle Ubuntu iptables ports 80 and 443 (OCI Ubuntu images block them by default!)
echo "[2/5] Opening firewall ports 80 and 443..."
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT || true
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT || true
if command -v netfilter-persistent >/dev/null 2>&1; then
  sudo netfilter-persistent save || true
fi

# 3. Verify backend/.env exists
if [ ! -f "./backend/.env" ]; then
  echo ""
  echo "ERROR: backend/.env not found!"
  echo "Create it first with: nano backend/.env"
  echo "Paste your local backend/.env contents, save (Ctrl+O, Enter, Ctrl+X), then re-run:"
  echo "  bash deploy/oracle-setup.sh"
  exit 1
fi

# 4. Auto-detect public IP for free automatic HTTPS via nip.io (unless APP_DOMAIN already set)
PUBLIC_IP=$(curl -4 -s https://ifconfig.me || curl -4 -s https://api.ipify.org)
export APP_DOMAIN="${APP_DOMAIN:-${PUBLIC_IP}.nip.io}"
echo "[3/5] Public IP detected: ${PUBLIC_IP}"
echo "[3/5] HTTPS Domain configured: https://${APP_DOMAIN}"

# Persist APP_DOMAIN for docker compose
echo "APP_DOMAIN=${APP_DOMAIN}" > .env

# 5. Build and launch 24/7 containers (FastAPI + Expo Web + Automatic HTTPS Caddy)
echo "[4/5] Building and launching containers (first build takes ~3-5 minutes)..."
sudo docker compose -f docker-compose.prod.yml up -d --build

echo "[5/5] Waiting for backend startup & model sync..."
sleep 10
sudo docker compose -f docker-compose.prod.yml ps

echo ""
echo "============================================================"
echo "  DEPLOYMENT COMPLETE!"
echo "  Live Web App:  https://${APP_DOMAIN}/"
echo "  Health Check:  https://${APP_DOMAIN}/api/v1/health"
echo "  Swagger Docs:  https://${APP_DOMAIN}/docs"
echo ""
echo "  Next Step (on your Windows PC to build the worldwide APK):"
echo "  powershell -ExecutionPolicy Bypass -File frontend\\scripts\\build-final.ps1 -ApiBaseUrl \"https://${APP_DOMAIN}/api/v1\""
echo "============================================================"
