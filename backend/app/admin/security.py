"""Admin access comes only from Supabase-controlled app_metadata, never a V2 farmer JWT."""
import time
from collections import defaultdict, deque
from uuid import UUID
import httpx
from fastapi import Header, HTTPException
from app.core.config import settings

_attempts = defaultdict(deque)


def provider_configuration():
    url = settings.SUPABASE_URL.rstrip('/')
    key = settings.SUPABASE_PUBLISHABLE_KEY or settings.SUPABASE_KEY
    if not url.startswith('https://') or not key:
        raise HTTPException(503, 'Supabase administrator authentication is not configured.')
    return url, key


def authorize_user(user):
    metadata = user.get('app_metadata') or {}
    roles = metadata.get('roles') or []
    if metadata.get('role') != 'admin' and not (isinstance(roles, list) and 'admin' in roles):
        raise HTTPException(403, 'Administrator access is required. Contact your project administrator.')
    try:
        identifier = str(UUID(user['id']))
    except (ValueError, KeyError, TypeError):
        raise HTTPException(401, 'Invalid administrator identity.')
    return {'id': identifier, 'email': user.get('email'), 'role': 'admin', 'provider': 'supabase'}


async def provider_request(method, path, *, token=None, body=None):
    url, key = provider_configuration()
    headers = {'apikey': key}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    try:
        async with httpx.AsyncClient(timeout=12) as client:
            response = await client.request(method, url + '/auth/v1/' + path, headers=headers, json=body)
    except httpx.HTTPError:
        raise HTTPException(503, 'Administrator identity service is unavailable. Try again later.')
    if response.status_code >= 500:
        raise HTTPException(503, 'Administrator identity service is unavailable.')
    if response.status_code != 200:
        raise HTTPException(401, 'Invalid or expired administrator credentials.')
    return response.json()


async def require_admin(authorization: str | None = Header(None)):
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(401, 'Administrator sign-in is required.')
    token = authorization[7:]
    # Supabase verifies signature, expiry and current user state on every request.
    # Farmer tokens are deliberately never accepted by this authority.
    from app.core.security import decode_access_token
    if decode_access_token(token) is not None:
        raise HTTPException(403, 'Farmer sessions cannot access administrator endpoints.')
    user = await provider_request('GET', 'user', token=token)
    return authorize_user(user)


async def login_admin(email, password, address):
    now = time.monotonic()
    attempts = _attempts[address]
    while attempts and attempts[0] < now - 900:
        attempts.popleft()
    if len(attempts) >= 8:
        raise HTTPException(429, 'Too many sign-in attempts. Try again in 15 minutes.')
    attempts.append(now)
    session = await provider_request('POST', 'token?grant_type=password', body={'email':email, 'password':password})
    # Do not trust arbitrary client metadata or a user-provided role.
    user = await provider_request('GET', 'user', token=session.get('access_token'))
    principal = authorize_user(user)
    attempts.clear()
    return {'access_token':session['access_token'], 'expires_in':session.get('expires_in'), 'user':principal}
