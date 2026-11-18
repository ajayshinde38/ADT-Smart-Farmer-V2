# Stage 1: Build Expo Web Frontend
FROM node:20-slim AS web-builder
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps
COPY frontend/ ./
ENV EXPO_PUBLIC_API_BASE_URL=""
RUN npm run build:web

# Stage 2: FastAPI Backend + Built Web Frontend (Hugging Face Spaces / Cloud Ready)
FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    OMP_NUM_THREADS=1 \
    MKL_NUM_THREADS=1 \
    OPENBLAS_NUM_THREADS=1 \
    HOME=/home/user \
    PORT=7860 \
    SERVE_STATIC_WEB=true \
    STATIC_WEB_DIR=/app/frontend/dist \
    ENVIRONMENT=development \
    DEBUG=true

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates libgomp1 libgeos-c1v5 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install CPU-only PyTorch (supports both x86_64 and ARM64/aarch64)
COPY backend/requirements.txt ./backend/requirements.txt
RUN python -m pip install --upgrade pip \
    && if [ "$(uname -m)" = "x86_64" ]; then \
         python -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu; \
       else \
         python -m pip install torch torchvision; \
       fi \
    && grep -Ev '^(torch|torchvision|pytest)\b' backend/requirements.txt > /tmp/req-cloud.txt \
    && python -m pip install -r /tmp/req-cloud.txt \
    && rm -f /tmp/req-cloud.txt

# Copy backend source & built web bundle
COPY backend/ ./backend/
COPY --from=web-builder /build/frontend/dist ./frontend/dist

# Hugging Face Spaces requires non-root UID 1000
RUN useradd -m -u 1000 user \
    && mkdir -p /app/backend/.cache /app/backend/app/.cache /app/backend/app/modules/pest_disease/models \
    && chown -R user:user /app

USER user
WORKDIR /app/backend
EXPOSE 7860

CMD ["python", "scripts/start_cloud.py"]
