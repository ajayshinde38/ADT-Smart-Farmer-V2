import os
from typing import List
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    PROJECT_NAME: str = "ADT Smart Farmer V2"
    VERSION: str = "2.0.0"
    API_V1_PREFIX: str = "/api/v1"
    
    # Server Binding
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # Environment
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    
    # Supabase Cloud Configuration
    SUPABASE_URL: str = Field(default="", description="Supabase project URL e.g. https://xyz.supabase.co")
    SUPABASE_KEY: str = Field(default="", description="Supabase anon/service_role API key")
    SUPABASE_SECRET_KEY: str = Field(default="", description="Supabase secret/service_role API key")
    SUPABASE_PUBLISHABLE_KEY: str = Field(default="", description="Supabase publishable/anon API key")
    SUPABASE_JWKS_URL: str = Field(default="", description="Supabase JWKS URL")
    DATABASE_URL: str = Field(default="", description="Direct PostgreSQL or Supabase connection string")
    
    # JWT & Auth
    JWT_SECRET: str = "adt-smart-farmer-v2-dev-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # External APIs
    CDSE_CLIENT_ID: str = ""
    CDSE_CLIENT_SECRET: str = ""
    OPEN_METEO_API_KEY: str = Field(default="", description="Commercial Open-Meteo API key")
    OPEN_METEO_BASE_URL: str = Field(default="https://customer-api.open-meteo.com", description="Commercial Open-Meteo base URL")
    OPEN_METEO_TIMEOUT_SECONDS: float = Field(default=10.0, description="Open-Meteo API request timeout")
    OPEN_METEO_CACHE_TTL_SECONDS: int = Field(default=900, description="In-process cache TTL in seconds")
    NASA_POWER_BASE_URL: str = "https://power.larc.nasa.gov/api/temporal/daily/point"
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://localhost:19006",
        "http://127.0.0.1:19006",
        "http://localhost:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "*"
    ]
    
    # Static Web Hosting (Production One-Server delivery)
    SERVE_STATIC_WEB: bool = False
    STATIC_WEB_DIR: str = os.path.normpath(os.path.join(os.path.dirname(__file__), "../../../frontend/dist"))

    class Config:
        env_file = (
            os.path.join(os.path.dirname(__file__), "../../../backend/.env"),
            os.path.join(os.path.dirname(__file__), "../../.env"),
            ".env"
        )
        extra = "ignore"


settings = Settings()
