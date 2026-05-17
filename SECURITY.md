# Security

## Supported versions

Security fixes are applied on the active `main` branch for this thesis / reference implementation. There is no long-term commercial support window.

## Reporting a vulnerability

Please open a **private** security advisory on the hosting GitHub repository (or email the repository maintainer listed in the thesis documentation) with:

- A short description of the issue and affected components (backend, frontend, or both)
- Steps to reproduce, or proof-of-concept, if safe to share
- Suggested impact (e.g. authentication bypass, webhook forgery, data exposure)

Do not file public issues for undisclosed critical vulnerabilities until a fix is agreed.

## Thesis scope vs production-grade controls

This repository is a **bachelor thesis / portfolio** reference implementation. A few choices keep the architecture simple; they are **documented tradeoffs**, not oversights.

### GitHub OAuth `state`

The authorize step includes a **signed, time-bounded `state`** value (`backend/src/utils/githubOAuthState.js`). GitHub echoes it on redirect so the callback can reject forged or replayed flows before exchanging the `code`. Login is **server-initiated** (`GET /api/auth/github`) so the authorize URL always carries `state`.

### GitHub `access_token` in the database

After OAuth, the backend persists the **GitHub user access token** in the `users` table as **AES-256-GCM** ciphertext (`v1:` / `v2:` prefixes). Keys:

- **`TOKEN_ENCRYPTION_KEY_CURRENT`** — encrypts all new tokens (`v2:`).
- **`TOKEN_ENCRYPTION_KEY_PREVIOUS`** — optional; used to decrypt during rotation; rows decrypted with the previous key are **re-encrypted with CURRENT** on the next API use.

Legacy **plaintext** rows (pre-encryption) still work until the user signs in again. Never log keys or token values.

### App session JWT (httpOnly cookie)

The API issues the application JWT in an **httpOnly** cookie (`acr_session`). The SPA uses credentialed requests (`withCredentials: true`). Cookie policy:

| Deployment | `secure` | `sameSite` |
|------------|----------|------------|
| Development | `false` | `lax` (same origin) or `none` when SPA/API origins differ* |
| Production, same origin | `true` | `lax` |
| Production, split hosts | `true` | `none` |

\*Browsers require `Secure` when `SameSite=None`; cross-origin local dev (e.g. `:5173` → `:3001`) may need a reverse proxy or aligned origins. Startup rejects `SameSite=None` with `secure=false` in production.

### Supabase service role (`SUPABASE_SERVICE_KEY`)

The API uses the **service role** Supabase client (`backend/src/config/database.js`), which **bypasses Row Level Security**. RLS policies in `schema.sql` document intent but do not constrain the Node process.

**Backend only** — never in the browser or Vite build. Startup **exits** if any of these are set: `VITE_SUPABASE_SERVICE_KEY`, `NEXT_PUBLIC_SUPABASE_SERVICE_KEY`, `PUBLIC_SUPABASE_SERVICE_KEY`.

### Suggested follow-ups (outside thesis scope)

- Migrate to **GitHub Apps** with installation tokens instead of long-lived user OAuth tokens.
- Tighten CSP / XSS hygiene and consider CSRF tokens for state-changing routes on additional origins.
- Use a **database role** with least privilege if you split read/write paths.

## Operational hardening (thesis context)

- `evaluation/fixtures/cases.js` builds synthetic diffs for the evaluation harness; secret-shaped strings are base64-decoded at runtime so static scanners do not match literals in the repo. Gitleaks allowlists that path in `gitleaks.toml`.
- Run production behind **HTTPS**; never ship real GitHub OAuth tokens over plain HTTP.
- Use a **strong `JWT_SECRET`** (32+ random characters) and rotate on suspected compromise.
- Generate **`TOKEN_ENCRYPTION_KEY_CURRENT`** as 32 random bytes (64 hex chars); set **`TOKEN_ENCRYPTION_KEY_PREVIOUS`** only during rotation.
- Treat **`SUPABASE_SERVICE_KEY`** as root database access: store only in server-side secrets, never in the browser or `VITE_*` variables.
- Rotate **`GITHUB_WEBHOOK_SECRET`** if webhook signing keys may have leaked; reconnect repositories so GitHub stores the new secret.
- Enable **Redis persistence** (AOF or RDB) when using `QUEUE_DRIVER=redis` — see README deployment section.

## Dependency updates

Automated dependency update PRs may be opened by Dependabot (see `.github/dependabot.yml`). Review lockfile changes and run `npm test` in `backend/` and `frontend/` before merging.

## Limitations & future work (cross-reference)

For residual scope (service role access, encryption key rotation workflow), see **the sections above** and **README §12 — Risks & Challenges**.
