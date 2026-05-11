# Threat model (documentation)

This document supports the **bachelor thesis** security discussion. It does **not** change runtime behaviour; it maps known risks to **existing** mitigations in the codebase.

Scope: GitHub-integrated code review assistant (Express API, React SPA, Supabase, Redis optional, Socket.IO).

---

## 1. Webhook spoofing (forged GitHub deliveries)

| | |
|---|---|
| **Description** | An attacker sends HTTP POSTs to `/api/webhooks/github` pretending to be GitHub. |
| **Impact** | Bogus reviews queued, noise in DB, potential queue abuse. |
| **Mitigation (existing)** | HMAC-SHA256 over the **raw body** with `GITHUB_WEBHOOK_SECRET`, compared with `crypto.timingSafeEqual` (`backend/src/controllers/webhookController.js`). Raw parser ordering documented in `README.md`. Invalid signature → **401** before enqueue. |
| **Residual risk** | Leaked webhook secret or wrong middleware order would undermine verification. |

---

## 2. GitHub OAuth token leakage

| | |
|---|---|
| **Description** | User GitHub `access_token` exposed in transit, logs, backups, or browser. |
| **Impact** | Full GitHub API access as the victim user until revocation. |
| **Mitigation (existing)** | HTTPS in production; tokens stored server-side in Supabase (`authController` upsert); app uses JWT for dashboard session (`backend/src/middleware/auth.js`). README “Risks” section documents plaintext-at-rest limitation. |
| **Residual risk** | **Database column not encrypted at application layer** — anyone with DB or service-role key can read tokens. |

---

## 3. JWT misuse / session hijack

| | |
|---|---|
| **Description** | Stolen or forged JWT used against REST or Socket.IO. |
| **Impact** | Unauthorized API access, joining wrong realtime rooms. |
| **Mitigation (existing)** | `JWT_SECRET` strength enforced on login path (`backend/src/controllers/authController.js`); `authenticate` middleware verifies Bearer tokens (`backend/src/middleware/auth.js`); Socket.IO handshake validates JWT and loads user (`backend/src/socket/registerSocketIO.js`, `backend/src/utils/socketUserFromToken.js`); `join:repo` checks repo ownership in DB. |
| **Residual risk** | XSS on SPA stealing `localStorage` token; weak `JWT_SECRET` in misconfigured deploy. |

---

## 4. API abuse / rate limiting

| | |
|---|---|
| **Description** | High-volume automated calls exhaust CPU, GitHub quota, or Supabase. |
| **Impact** | Degraded service, cost, blocked legitimate users. |
| **Mitigation (existing)** | `express-rate-limit` global limiter (`backend/src/middleware/rateLimiter.js`); webhooks and `/health` excluded from limiter so legitimate GitHub bursts are not dropped (documented in README). |
| **Residual risk** | Distributed abuse across IPs; GitHub API limits still apply per user token. |

---

## 5. Frontend origin abuse (CORS / Socket.IO)

| | |
|---|---|
| **Description** | Malicious site in browser makes credentialed requests if origins are too loose. |
| **Impact** | Cross-origin data exfiltration or confused deputy if cookies/CORS misconfigured. |
| **Mitigation (existing)** | **Production:** only explicit `FRONTEND_URL` list (`backend/src/utils/frontendOrigins.js`). **Non-production:** controlled relaxations for local/LAN thesis dev (same file); `FRONTEND_DEV_EXTRA_ORIGINS` optional. Express + Socket.IO share the same origin callback (`backend/src/server.js`). |
| **Residual risk** | Running with `NODE_ENV !== 'production'` on a public host would widen dev relaxations — use `NODE_ENV=production` for real deployments. |

---

## Summary

| Threat area | Primary control location |
|-------------|-------------------------|
| Webhook authenticity | `webhookController.js`, `server.js` (raw body route) |
| Token / session | `authController.js`, `auth.js`, `socketUserFromToken.js` |
| Abuse | `rateLimiter.js` |
| Browser origins | `frontendOrigins.js`, `server.js` |

For coordinated disclosure, see `SECURITY.md`.
