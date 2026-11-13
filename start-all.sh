#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

echo "========================================================"
echo "  Launching ADT Smart Farmer V2 (Backend + Frontend)"
echo "========================================================"

# Trap to kill background jobs on exit
trap 'kill 0' SIGINT SIGTERM EXIT

./start-backend.sh &
sleep 2

./start-frontend.sh &

wait

