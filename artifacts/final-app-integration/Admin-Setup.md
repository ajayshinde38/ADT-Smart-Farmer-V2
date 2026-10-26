# First administrator: project-owner setup

No administrator account, password or role grant is created automatically. Farmer registration and farmer JWTs never grant administrator access.

1. Open **your existing project's Supabase dashboard → Authentication → Users**. Invite or create the intended administrator using the dashboard's normal secure account flow. Complete email confirmation and set the password through Supabase. Do not paste passwords or service credentials into this chat or a frontend file.
2. Copy that Auth user's UUID. Confirm the project is the same one configured in V2's private `backend/.env`.
3. From the `backend` directory inspect the account:

   ```powershell
   python scripts/admin_access.py --user-id <AUTH-USER-UUID>
   ```

4. Only the project owner should intentionally grant access:

   ```powershell
   python scripts/admin_access.py --user-id <AUTH-USER-UUID> --action grant --apply
   ```

   The script requires a trusted backend key, an email-confirmed Auth user, and typing the exact UUID at its confirmation prompt. It changes only that user's server-controlled `app_metadata`; it does not create credentials or modify any farmer record. Do not run the script from a public server endpoint.

5. Open V2's `/admin` page and sign in with that account. The backend authenticates against Supabase and retrieves the current user on every protected admin request. Only `app_metadata.role = "admin"` or an `admin` item in trusted `app_metadata.roles` authorizes access. User-editable `user_metadata` is ignored.
6. Verify access with `/api/v1/admin/me` through the signed-in UI and check the all-farmer directory. Keep the password and access token private. Admin sessions remain in memory and are cleared on logout or expiry.

To revoke access, use the same inspected UUID:

```powershell
python scripts/admin_access.py --user-id <AUTH-USER-UUID> --action revoke --apply
```

The server rechecks trusted roles on each request, so a removed administrator role cannot continue through cached frontend state. Use Supabase's account/session controls for compromised accounts. Production must use HTTPS and a strong private farmer JWT signing key; development phone shortcuts are disabled outside development mode.

For local port selection, use the active V2 URL in `Final-Report.md`. The reference GIS servers and V2 must not share a listening port.

Authority references: [Supabase server-validated user retrieval](https://supabase.com/docs/reference/python/auth-getuser), [Supabase row-level security and JWT metadata guidance](https://supabase.com/docs/guides/database/postgres/row-level-security).
