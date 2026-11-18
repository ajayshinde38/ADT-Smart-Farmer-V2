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
from app.admin.router import router as admin_router

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

# Fail closed for real deployments. A pilot can still run with dev defaults.
if settings.ENVIRONMENT.lower() == "production":
    if (settings.JWT_SECRET == "adt-smart-farmer-v2-dev-secret-key-change-in-production"
            or len(settings.JWT_SECRET) < 32):
        raise RuntimeError("Production requires a strong unique JWT_SECRET.")
    if settings.DEBUG:
        raise RuntimeError("Set DEBUG=false in production.")
    if "*" in settings.CORS_ORIGINS:
        raise RuntimeError("Set explicit HTTPS CORS_ORIGINS in production.")
    if not settings.SUPABASE_SECRET_KEY or not settings.SUPABASE_URL.startswith("https://"):
        raise RuntimeError("Production requires private Supabase credentials and HTTPS.")

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
app.include_router(admin_router, prefix=settings.API_V1_PREFIX)


@app.middleware('http')
async def operational_status(request:Request,call_next):
    response=await call_next(request)
    if response.status_code>=400:
        from app.core.operations import record_event
        route=request.scope.get('route')
        # Route templates contain no farmer IDs, phone numbers, tokens or query strings.
        record_event('api_error',getattr(route,'path','Unmatched route'),response.status_code)
    if request.url.path.startswith(settings.API_V1_PREFIX):
        response.headers['Cache-Control']='no-store'
    return response


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


# Native Android WebView loads Leaflet from the same trusted backend origin.
# This must work even before an Expo Web export has been produced.
@app.get("/map/{asset_name}", include_in_schema=False)
def native_leaflet_asset(asset_name: str):
    if asset_name not in {"leaflet.js", "leaflet.css", "LICENSE-Leaflet.txt"}:
        return JSONResponse(status_code=404, content={"detail": "Not found"})
    public_asset = Path(__file__).resolve().parents[2] / "frontend" / "public" / "map" / asset_name
    if not public_asset.is_file():
        return JSONResponse(status_code=503, content={"detail": "Leaflet map asset missing on server"})
    return FileResponse(
        public_asset,
        headers={"Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff"},
    )


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
        target_file = (static_web_path / full_path).resolve()
        if not target_file.is_relative_to(static_web_path.resolve()):
            return JSONResponse(status_code=404,content={'detail':'Not found'})
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
