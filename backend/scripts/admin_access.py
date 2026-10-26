"""Project-owner CLI. Inspect by default; role changes require --apply and typed confirmation.

Create/invite the Auth user in the Supabase dashboard first. Never run this from a
web route or ship backend credentials to a client. No passwords are accepted here.
"""
import argparse
import sys
from pathlib import Path
from uuid import UUID
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import httpx
from app.core.config import settings


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--user-id',required=True,type=UUID)
    parser.add_argument('--action',choices=('inspect','grant','revoke'),default='inspect')
    parser.add_argument('--apply',action='store_true')
    args=parser.parse_args()
    key=settings.SUPABASE_SECRET_KEY or settings.SUPABASE_KEY
    if not key or not settings.SUPABASE_URL.startswith('https://'):
        raise SystemExit('Trusted backend Supabase configuration is required. No changes made.')
    url=settings.SUPABASE_URL.rstrip('/')+'/auth/v1/admin/users/'+str(args.user_id)
    headers={'apikey':key,'Authorization':'Bearer '+key}
    with httpx.Client(timeout=15) as client:
        response=client.get(url,headers=headers)
        if response.status_code!=200:
            raise SystemExit('Unable to inspect that Auth user. Verify project and user ID. No changes made.')
        user=response.json()
        metadata=dict(user.get('app_metadata') or {})
        print('Auth user:',args.user_id)
        print('Email confirmed:',bool(user.get('email_confirmed_at')))
        print('Administrator role:',metadata.get('role')=='admin' or 'admin' in (metadata.get('roles') or []))
        if args.action=='inspect' or not args.apply:
            print('Inspection only. Use --action grant|revoke --apply for an intentional role change.')
            return
        if args.action=='grant' and not user.get('email_confirmed_at'):
            raise SystemExit('Confirm the account email before granting administrator access. No changes made.')
        confirmation=input('Type the exact user UUID to confirm this security-sensitive '+args.action+': ')
        if confirmation!=str(args.user_id):
            raise SystemExit('Confirmation did not match. No changes made.')
        roles=metadata.get('roles') if isinstance(metadata.get('roles'),list) else []
        roles=[role for role in roles if role!='admin']
        if args.action=='grant':
            metadata['role']='admin'
            roles.append('admin')
        elif metadata.get('role')=='admin':
            metadata.pop('role')
        metadata['roles']=roles
        changed=client.put(url,headers=headers,json={'app_metadata':metadata})
        if changed.status_code!=200:
            raise SystemExit('Role update failed. Inspect the account before retrying.')
        print('Trusted administrator role updated. No farmer records or passwords were changed.')


if __name__=='__main__':
    main()
