# Development guide — reproducibility & operations

This document complements the main [README](../README.md). It is written for evaluators, thesis reviewers, and future maintainers who need a **clean-machine** path from `git clone` to a running stack.

## 1. What you must provision externally

| Resource | Role | Notes |
|----------|------|--------|
| **Node.js 20 LTS** | Same major as CI (`.github/workflows/ci.yml`) and Dockerfiles | `.nvmrc` pins `20` |
| **npm** | Comes with Node | Use `npm ci` in CI; local `npm install` is fine |
| **Supabase project** | PostgreSQL + PostgREST used by `@supabase/supabase-js` | Apply `backend/src/config/schema.sql` once in the SQL editor for a **new** project; see schema header for incremental migrations |
| **GitHub OAuth App** | User login + API token | Callback URL must match `FRONTEND_URL` + `/auth/callback` |
| **Public HTTPS URL (dev)** | GitHub webhooks | `BACKEND_URL` — use ngrok, Cloudflare Tunnel, etc. (`WEBHOOK_QUICKSTART.md`) |
| **Redis** | Optional; default is in-process jobs | Set `QUEUE_DRIVER=redis` and `REDIS_URL` only when testing Bull locally (`docker compose --profile redis up`) |

There is **no** “local Postgres only” mode: the backend loads `backend/src/config/database.js`, which **requires** `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` and exits if they are missing. A bundled Postgres container does **not** replace Supabase for this codebase.

## 2. First-time setup (host, not Docker)

```bash
git clone <repo-url> ai-code-review
cd ai-code-review
nvm use   # optional; reads .nvmrc
npm run install:all
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Edit both files — real Supabase URL + service role key, JWT, GitHub OAuth, BACKEND_URL, etc.
npm run verify:setup
```

Apply the database DDL in the Supabase dashboard, then:

```bash
npm run dev
```

- API: `http://localhost:3001` — `GET /health` should return JSON.
- SPA: `http://localhost:5173` (Vite proxies `/api` to the backend in dev).

### Browser origins (`FRONTEND_URL`, CORS, Socket.IO, OAuth)

The Express app and Socket.IO share the same origin policy (`backend/src/utils/frontendOrigins.js`).

| Variable | Role |
|----------|------|
| **`FRONTEND_URL`** | Comma-separated list of allowed SPA origins in **production** (`NODE_ENV=production`). Also used as the default first entry for OAuth redirect links when you do not rely on the callback query string. |
| **`FRONTEND_DEV_EXTRA_ORIGINS`** | **Optional, development only.** Comma-separated extra origins (e.g. `http://mybox.local:5173`). Ignored for CORS when `NODE_ENV=production`. Use this for custom local DNS names that are not loopback and not private IPv4. |

**Production** (`NODE_ENV=production`): only origins that appear in **`FRONTEND_URL`** (after normalisation) are allowed. There is no loopback or LAN bypass.

**Non-production** (`NODE_ENV` anything other than `production`, e.g. `development` or `test`): in addition to **`FRONTEND_URL`**, the API allows:

- `http://localhost:*`, `http://127.0.0.1:*`, `http://[::1]:*` (IPv6 loopback),
- typical **private LAN IPv4** addresses: `10.x.x.x`, `172.16.x.x`–`172.31.x.x`, `192.168.x.x`,
- any origin listed in **`FRONTEND_DEV_EXTRA_ORIGINS`**.

This makes **LAN or phone-on-WiFi** testing easier: open the dashboard at `http://192.168.1.10:5173` (your machine’s LAN IP) without changing `FRONTEND_URL`, as long as `NODE_ENV` is not `production`. GitHub OAuth still requires the **callback URL** registered on the GitHub OAuth app to match the URL you actually use (add `http://192.168…:5173/auth/callback` as an extra callback URL in GitHub settings if you test that way).

**Socket.IO** uses the same `isAllowedFrontendOrigin` callback as REST CORS (`server.js`), so behaviour stays consistent.

**Remaining edge cases**: IPv6 ULAs (`fc00::/7`), link-local (`fe80::/10`), or public IPs are not auto-allowed; add them to **`FRONTEND_DEV_EXTRA_ORIGINS`** or **`FRONTEND_URL`** as appropriate.

## 3. Docker Compose

`docker-compose.yml` starts **backend** and **frontend** dev servers with the same **in-process** job queue as `npm run dev` on the host (no Redis). You still need valid **Supabase** credentials in `backend/.env`.

- **`env_file` with `required: false`**: requires **Docker Compose v2.24+**. Older Compose: create empty `backend/.env` / `frontend/.env` after copying from `.env.example`, or upgrade Docker Desktop / the Compose plugin.
- Bind mounts hide image `node_modules`; services run `npm ci` before `npm run dev` so devDependencies (e.g. nodemon, Vite) are present.
- Optional **`docker compose --profile redis up`**: starts Redis; set `QUEUE_DRIVER=redis` and `REDIS_URL=redis://redis:6379` in `backend/.env` to mirror production queuing.

## 4. Scripts that exist vs removed

| Script | Status |
|--------|--------|
| `npm run verify:setup` (repo root) | Checks Node version and minimal env; **warnings** for OAuth/webhook gaps |
| `backend` `db:migrate` / `db:seed` | **Removed** — they pointed at non-existent files; schema is applied via Supabase SQL editor and optional files under `backend/migrations/` |

## 5. CI parity

GitHub Actions uses Node **20** and `npm ci` in `frontend/` and `backend/`. Match that locally to avoid “works on my machine” drift.

## 6. Security checklist (short)

See [SECURITY.md](../SECURITY.md). Never commit `.env` files; never expose `SUPABASE_SERVICE_KEY` or `GITHUB_CLIENT_SECRET` to the frontend (no `VITE_SUPABASE_SERVICE_KEY`). Optional public OAuth id: `VITE_GITHUB_CLIENT_ID`. Set `TOKEN_ENCRYPTION_KEY_CURRENT` in `backend/.env`.
