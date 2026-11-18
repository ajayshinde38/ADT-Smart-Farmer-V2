#!/usr/bin/env bash
set -euo pipefail

echo "================================================================"
echo "  ADT Smart Farmer V2 — DigitalOcean 24/7 Production Installer"
echo "================================================================"

# 1. Add 2 GB swap so 2 GB RAM ($12/mo) Droplets build & run PyTorch smoothly
if [ ! -f /swapfile ]; then
  echo "[1/6] Creating 2 GB swapfile for PyTorch + Docker build headroom..."
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
else
  echo "[1/6] Swapfile already exists."
fi

# 2. Install Docker & Compose plugin if missing
if ! command -v docker >/dev/null 2>&1; then
  echo "[2/6] Installing Docker..."
  sudo apt-get update
  sudo apt-get install -y ca-certificates curl gnupg git
  curl -fsSL https://get.docker.com | sudo sh
else
  echo "[2/6] Docker already installed."
fi

# 3. Configure UFW firewall safely (SSH + HTTP + HTTPS)
echo "[3/6] Allowing SSH (22), HTTP (80), and HTTPS (443)..."
if command -v ufw >/dev/null 2>&1; then
  sudo ufw allow OpenSSH >/dev/null 2>&1 || true
  sudo ufw allow 80/tcp >/dev/null 2>&1 || true
  sudo ufw allow 443/tcp >/dev/null 2>&1 || true
fi

# 4. Verify backend/.env exists
if [ ! -f "./backend/.env" ]; then
  echo ""
  echo "ERROR: backend/.env not found!"
  echo "Create it first with:  nano backend/.env"
  echo "Paste your local backend/.env contents, save (Ctrl+O, Enter, Ctrl+X), then re-run:"
  echo "  bash deploy/digitalocean-setup.sh"
  exit 1
fi

# 5. Auto-detect Droplet Public IPv4 for automatic free HTTPS via nip.io
PUBLIC_IP=$(curl -4 -s https://ifconfig.me || curl -4 -s https://api.ipify.org)
export APP_DOMAIN="${APP_DOMAIN:-${PUBLIC_IP}.nip.io}"
echo "[4/6] Droplet Public IP: ${PUBLIC_IP}"
echo "[4/6] HTTPS Domain:      https://${APP_DOMAIN}"

echo "APP_DOMAIN=${APP_DOMAIN}" > .env

# 6. Build and launch 24/7 containers (FastAPI + Expo Web + Automatic Caddy HTTPS)
echo "[5/6] Building and starting 24/7 containers (~3-5 min on first run)..."
sudo docker compose -f docker-compose.prod.yml up -d --build

echo "[6/6] Checking container status..."
sleep 8
sudo docker compose -f docker-compose.prod.yml ps

echo ""
echo "================================================================"
echo "  DEPLOYMENT COMPLETE! (Models auto-download on first boot ~30s)"
echo ""
echo "  Live Web App:   https://${APP_DOMAIN}/"
echo "  Health Check:   https://${APP_DOMAIN}/api/v1/health"
echo "  Swagger Docs:   https://${APP_DOMAIN}/docs"
echo "  Demo Login:     9876543210  |  OTP: 123456 (Ajay Shinde)"
echo ""
echo "  View startup logs anytime:"
echo "    sudo docker compose -f docker-compose.prod.yml logs -f adt-app"
echo ""
echo "  Next step on your Windows PC (builds worldwide Android APK):"
echo "    powershell -ExecutionPolicy Bypass -File frontend\\scripts\\build-final.ps1 -ApiBaseUrl \"https://${APP_DOMAIN}/api/v1\""
echo "================================================================"
