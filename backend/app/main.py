import os
import logging
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse

from app.core.config import settings
from app.auth.router import router as auth_router
from app.farmers.router import router as farmers_router
from app.modules.gis.router import router as gis_router
from app.modules.weather.router import router as weather_router
from app.modules.advisory.router import router as advisory_router
from app.modules.pest_disease.router import router as pest_disease_router
from app.farmers import service as farmer_service

import re

class SensitiveDataFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str) and "apikey=" in record.msg:
            record.msg = re.sub(r"apikey=[^&\s'\"]+", "apikey=REDACTED", record.msg)
        if record.args:
            if isinstance(record.args, dict):
                record.args = {k: (re.sub(r"apikey=[^&\s'\"]+", "apikey=REDACTED", str(v)) if isinstance(v, str) else v) for k, v in record.args.items()}
            elif isinstance(record.args, tuple):
                record.args = tuple(re.sub(r"apikey=[^&\s'\"]+", "apikey=REDACTED", str(a)) if isinstance(a, str) else a for a in record.args)
        return True


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logging.getLogger("httpx").setLevel(logging.WARNING)
for h in logging.root.handlers:
    h.addFilter(SensitiveDataFilter())

logger = logging.getLogger("adt_smart_farmer_v2")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="One Consolidated Backend for ADT Smart Farmer V2 (4 Integrated Modules in 1 Process)",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all 4 feature modules + auth + farmer registry on ONE application
app.include_router(auth_router, prefix=settings.API_V1_PREFIX)
app.include_router(farmers_router, prefix=settings.API_V1_PREFIX)
app.include_router(gis_router, prefix=settings.API_V1_PREFIX)
app.include_router(weather_router, prefix=settings.API_V1_PREFIX)
app.include_router(advisory_router, prefix=settings.API_V1_PREFIX)
app.include_router(pest_disease_router, prefix=settings.API_V1_PREFIX)


@app.get("/health", tags=["System"])
@app.get(f"{settings.API_V1_PREFIX}/health", tags=["System"])
def health_check():
    """
    Unified health check verifying that all four domain packages are loaded
    and operational inside this single FastAPI process.
    """
    farmer_count = len(farmer_service.get_all_farmers())
    return {
        "status": "healthy",
        "app_name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "architecture": "ONE_PROCESS_ONE_PORT",
        "active_modules": {
            "gis": "loaded",
            "weather": "loaded",
            "advisory": "loaded",
            "pest_disease": "loaded",
            "farmer_identity": "loaded"
        },
        "authoritative_farmers_loaded": farmer_count
    }


# Mount Expo static web distribution for production single-port delivery
static_web_path = Path(settings.STATIC_WEB_DIR)
if not (static_web_path.exists() and (static_web_path / "index.html").exists()):
    project_dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
    if project_dist.exists() and (project_dist / "index.html").exists():
        static_web_path = project_dist

if static_web_path.exists() and (static_web_path / "index.html").exists():
    logger.info(f"Serving built Expo web frontend from {static_web_path}")

    # Mount _expo static assets directory if present
    expo_assets_dir = static_web_path / "_expo"
    if expo_assets_dir.exists():
        app.mount("/_expo", StaticFiles(directory=str(expo_assets_dir)), name="expo_assets")

    @app.get("/", include_in_schema=False)
    async def serve_spa_root():
        return FileResponse(static_web_path / "index.html")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(request: Request, full_path: str):
        # 1. Strictly do NOT intercept API routes or documentation
        if (
            full_path.startswith("api/")
            or full_path.startswith("docs")
            or full_path.startswith("redoc")
            or full_path.startswith("openapi.json")
        ):
            return JSONResponse(status_code=404, content={"detail": f"Not Found: /{full_path}"})

        # 2. Check if a static asset directly exists on disk (e.g. favicon.ico, images)
        target_file = static_web_path / full_path
        if target_file.is_file():
            return FileResponse(target_file)

        # 3. For any other client-side route, serve the SPA index.html
        return FileResponse(static_web_path / "index.html")
else:
    @app.get("/")
    def index():
        return {
            "message": "ADT Smart Farmer V2 Consolidated Backend is running.",
            "docs": "/docs",
            "health": "/health",
            "api_prefix": settings.API_V1_PREFIX
        }
