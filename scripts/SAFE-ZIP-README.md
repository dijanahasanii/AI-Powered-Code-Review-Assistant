# Safe project zip (no secrets)

A normal folder zip includes **everything on disk**, including files Git never commits.

## Never put these in a shared zip

| Path | Why |
|------|-----|
| `backend/.env` | Supabase service key, JWT secret, GitHub OAuth secret, encryption keys |
| `frontend/.env` | API URLs and optional OAuth client id |
| `backend/reports/` | Generated reports may contain code from scanned repos |
| `node_modules/` | Huge; not needed to run the source elsewhere |
| `logs/`, `*.log` | May contain tokens or errors with sensitive data |
| `.git/` | Optional: full history if secrets were ever committed |

**Do not “relocate” `.env` out of the project** — the app needs it locally. Only **exclude** it from archives.

## Recommended: use the script

From the repo root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\create-safe-zip.ps1
```

Creates `AI-Code-Review-Assistant-safe-YYYY-MM-DD.zip` in the repo root (no secrets).

Custom output path:

```powershell
powershell -File .\scripts\create-safe-zip.ps1 -OutputPath "D:\Backups\my-archive.zip"
```

## Alternative: Git-only archive (tracked files only)

If you only need committed code:

```powershell
git archive -o AI-Code-Review-Assistant-git.zip HEAD
```

This never includes `backend/.env` (gitignored). Uncommitted local changes are **not** included.

## Manual zip (Windows Explorer)

Select project files, **do not** select:

- `backend\.env`
- `frontend\.env`
- `node_modules` folders
- `backend\reports`

Or zip the whole folder, then delete those entries from the zip before sharing.

## If you already shared a zip with `.env` inside

Rotate all secrets in `backend/.env` (Supabase, GitHub, JWT, encryption keys) and have users sign in again.
