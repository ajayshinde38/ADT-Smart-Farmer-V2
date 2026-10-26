"""Loopback-only UI test harness. It does NOT create a real administrator.

The Supabase identity response is simulated with unpredictable, short-lived
credentials. Production authorization code and all data services remain intact.
Never use this entry point for deployment. Stop it after visual QA.
"""
import atexit
import json
import secrets
import sys
import time
from pathlib import Path
from uuid import uuid4
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from fastapi import HTTPException
from app.main import app
from app.admin import security

authority={'email':'ui-contract@example.invalid','password':secrets.token_urlsafe(32),'token':secrets.token_urlsafe(40),'id':str(uuid4())}
deadline=time.monotonic()+1800
private_file=Path(__file__).resolve().parents[1]/'.cache/admin-ui-contract.json'
private_file.parent.mkdir(parents=True,exist_ok=True)
private_file.write_text(json.dumps(authority),encoding='utf-8')
atexit.register(lambda:private_file.unlink(missing_ok=True))


async def contract_identity(method,path,*,token=None,body=None):
    if time.monotonic()>deadline:
        raise HTTPException(401,'UI contract-test session expired')
    if method=='POST' and path.startswith('token?'):
        if not body or body.get('email')!=authority['email'] or not secrets.compare_digest(body.get('password',''),authority['password']):
            raise HTTPException(401,'Invalid contract-test credentials')
        return {'access_token':authority['token'],'expires_in':int(deadline-time.monotonic())}
    if method=='GET' and path=='user' and token and secrets.compare_digest(token,authority['token']):
        return {'id':authority['id'],'email':authority['email'],'app_metadata':{'role':'admin'}}
    raise HTTPException(401,'Invalid contract-test session')


security.provider_request=contract_identity


if __name__=='__main__':
    import uvicorn
    uvicorn.run(app,host='127.0.0.1',port=8003,log_level='warning')
