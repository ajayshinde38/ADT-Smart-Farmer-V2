"""Cloud production entrypoint: fetches missing model weights from URLs or Supabase Storage, then runs Uvicorn."""
import hashlib
import os
import sys
from pathlib import Path
import httpx
import uvicorn

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

MODELS_DIR = BACKEND_DIR / "app" / "modules" / "pest_disease" / "models"


def _download_file(url: str, dest: Path, headers: dict | None = None) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".tmp")
    print(f"[startup] Downloading {dest.name} ...", flush=True)
    with httpx.stream("GET", url, headers=headers or {}, follow_redirects=True, timeout=180.0) as resp:
        resp.raise_for_status()
        with tmp.open("wb") as f:
            for chunk in resp.iter_bytes(chunk_size=1024 * 1024):
                f.write(chunk)
    tmp.replace(dest)
    print(f"[startup] Ready: {dest.name} ({dest.stat().st_size / (1024 * 1024):.1f} MB)", flush=True)


def _download_chunked_from_supabase(supabase_url: str, headers: dict, bucket: str, filename: str, dest: Path, parts: int = 3) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".tmp")
    print(f"[startup] Reassembling {filename} from {parts} Supabase Storage chunks ...", flush=True)
    with tmp.open("wb") as out:
        for i in range(parts):
            part_url = f"{supabase_url}/storage/v1/object/authenticated/{bucket}/{filename}.part{i}"
            with httpx.stream("GET", part_url, headers=headers, follow_redirects=True, timeout=180.0) as resp:
                resp.raise_for_status()
                for chunk in resp.iter_bytes(chunk_size=1024 * 1024):
                    out.write(chunk)
    tmp.replace(dest)
    sha = hashlib.sha256(dest.read_bytes()).hexdigest()
    print(f"[startup] Ready: {dest.name} ({dest.stat().st_size / (1024 * 1024):.1f} MB, sha256={sha[:12]}...)", flush=True)


def ensure_models() -> None:
    supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    supabase_key = os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_KEY", "")
    bucket = os.environ.get("MODEL_STORAGE_BUCKET", "models")
    headers = {"apikey": supabase_key, "Authorization": f"Bearer {supabase_key}"} if supabase_key else {}

    targets = [
        ("best_unet.pth", os.environ.get("MODEL_UNET_URL", "").strip(), 3),
        ("best_sugarcane_efficientnetb0.pth", os.environ.get("MODEL_EFFICIENTNET_URL", "").strip(), 1),
    ]
    for filename, direct_url, parts in targets:
        dest = MODELS_DIR / filename
        if dest.is_file() and dest.stat().st_size > 1_000_000:
            print(f"[startup] Model present: {filename}", flush=True)
            continue
        if direct_url:
            _download_file(direct_url, dest)
        elif supabase_url and supabase_key:
            try:
                if parts > 1:
                    _download_chunked_from_supabase(supabase_url, headers, bucket, filename, dest, parts=parts)
                else:
                    url = f"{supabase_url}/storage/v1/object/authenticated/{bucket}/{filename}"
                    _download_file(url, dest, headers=headers)
            except Exception as exc:
                print(f"[startup] Warning: could not download {filename} from Supabase bucket '{bucket}': {exc}", flush=True)
        else:
            print(f"[startup] Warning: {filename} not found locally and no MODEL_*_URL configured.", flush=True)


if __name__ == "__main__":
    ensure_models()
    port = int(os.environ.get("PORT", "7860"))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, workers=1)
