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
| **Mitigation (existing)** | HTTPS in production; tokens encrypted at rest (`TOKEN_ENCRYPTION_KEY_CURRENT` / `PREVIOUS`, `v2:` ciphertext in `backend/src/utils/tokenCrypto.js`); decrypted only in memory for GitHub API calls; automatic re-encrypt to CURRENT after PREVIOUS decrypt. |
| **Residual risk** | Anyone with **service-role** DB access plus **`TOKEN_ENCRYPTION_KEY_CURRENT`** (or PREVIOUS during rotation) can recover tokens. |

---

## 3. JWT misuse / session hijack

| | |
|---|---|
| **Description** | Stolen or forged JWT used against REST or Socket.IO. |
| **Impact** | Unauthorized API access, joining wrong realtime rooms. |
| **Mitigation (existing)** | `JWT_SECRET` strength enforced in production; session JWT in **httpOnly** cookie (`backend/src/utils/authCookie.js`); `authenticate` reads cookie or Bearer (`backend/src/middleware/auth.js`); Socket.IO uses cookie or handshake token (`registerSocketIO.js`, `socketUserFromToken.js`); `join:repo` checks repo ownership. CORS `credentials: true` with `FRONTEND_URL` allowlist only. |
| **Residual risk** | XSS can still invoke credentialed API calls as the user; weak secrets in misconfigured deploy. |

---

## 4. API abuse / rate limiting

| | |
|---|---|
| **Description** | Brute-force or flood against auth, reviews, or webhooks. |
| **Impact** | DoS, credential stuffing noise, queue saturation. |
| **Mitigation (existing)** | `express-rate-limit` on API routes; stricter `authLimiter` on OAuth; webhooks excluded from global limiter so legitimate GitHub bursts are not dropped (`rateLimiter.js`). |
| **Residual risk** | Distributed attacks above single-node limits; no WAF in thesis scope. |

---

## 5. Queue job loss (Redis)

| | |
|---|---|
| **Description** | Redis restarted without persistence loses Bull jobs. |
| **Impact** | Reviews stuck in `pending` / lost work. |
| **Mitigation (existing)** | Production requires `QUEUE_DRIVER=redis`; startup warns if AOF/RDB not detected (`redisPersistenceCheck.js`). Operators should enable `appendonly yes` or `save` (README §11). |
| **Residual risk** | Misconfigured managed Redis without persistence. |

---

## 6. Service role key exposure

| | |
|---|---|
| **Description** | `SUPABASE_SERVICE_KEY` embedded in frontend build or logs. |
| **Impact** | Full database read/write bypassing RLS. |
| **Mitigation (existing)** | Key only in backend `database.js`; startup rejects `VITE_SUPABASE_SERVICE_KEY` and similar env vars (`validateProductionEnv.js`). |
| **Residual risk** | Accidental commit of `.env` or screenshot of Railway/Vercel env UI. |
