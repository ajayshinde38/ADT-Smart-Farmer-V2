import logging
from typing import Optional, AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)

Base = declarative_base()

# Async SQLAlchemy engine for Supabase PostgreSQL
_async_engine = None
_async_session_factory = None

def get_engine():
    global _async_engine, _async_session_factory
    if _async_engine is None and settings.DATABASE_URL:
        db_url = settings.DATABASE_URL
        # Ensure asyncpg dialect is used
        if db_url.startswith("postgresql://"):
            db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
        elif db_url.startswith("postgres://"):
            db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)
            
        try:
            _async_engine = create_async_engine(
                db_url,
                pool_pre_ping=True,
                pool_size=10,
                max_overflow=20
            )
            _async_session_factory = async_sessionmaker(
                bind=_async_engine,
                expire_on_commit=False,
                class_=AsyncSession
            )
            logger.info("Database engine initialized.")
        except Exception as e:
            logger.warning(f"Could not initialize database engine: {e}")
            _async_engine = None
            _async_session_factory = None
    return _async_engine

async def get_db_session() -> AsyncGenerator[Optional[AsyncSession], None]:
    """Dependency for obtaining an async DB session."""
    engine = get_engine()
    if _async_session_factory is None:
        # Fallback for offline/scaffold mode before DB credentials are provided
        yield None
        return
        
    async with _async_session_factory() as session:
        try:
            yield session
        finally:
            await session.close()


class SupabaseStorageClient:
    """Wrapper for interacting with Supabase Storage via REST API."""
    def __init__(self, supabase_url: str = "", supabase_key: str = ""):
        self.supabase_url = (supabase_url or settings.SUPABASE_URL).rstrip("/")
        self.supabase_key = supabase_key or settings.SUPABASE_KEY or settings.SUPABASE_SECRET_KEY

    def is_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_key)

    async def get_signed_url(self, bucket: str, path: str, expires_in: int = 3600) -> Optional[str]:
        if not self.is_configured():
            return None
        url = f"{self.supabase_url}/storage/v1/object/sign/{bucket}/{path.lstrip('/')}"
        headers = {
            "apikey": self.supabase_key,
            "Authorization": f"Bearer {self.supabase_key}",
            "Content-Type": "application/json"
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json={"expiresIn": expires_in}, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                signed_path = data.get("signedURL")
                return f"{self.supabase_url}/storage/v1{signed_path}"
            return None

    async def upload_file(self, bucket: str, path: str, file_data: bytes, content_type: str = "application/octet-stream") -> bool:
        if not self.is_configured():
            return False
        url = f"{self.supabase_url}/storage/v1/object/{bucket}/{path.lstrip('/')}"
        headers = {
            "apikey": self.supabase_key,
            "Authorization": f"Bearer {self.supabase_key}",
            "Content-Type": content_type
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, content=file_data, headers=headers)
            return resp.status_code in (200, 201)

supabase_storage = SupabaseStorageClient()
