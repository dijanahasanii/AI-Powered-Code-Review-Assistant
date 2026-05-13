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

After OAuth, the backend persists the **GitHub user access token** in the `users` table so the server can call the GitHub API for diffs, repos, and webhooks. Tokens are **not encrypted at rest** in this thesis build. Reasonable for a controlled demo with a dedicated Supabase project; **not** how you would ship a multi-tenant product without envelope encryption or a dedicated secrets store.

### App JWT in `localStorage`

The SPA stores the **application JWT** in `localStorage`. That keeps the implementation small and matches common SPA tutorials. The tradeoff is **any XSS on your origin** can read the token. A stricter pattern is **httpOnly cookies** plus CSRF defenses, or a backend-for-frontend that never exposes long-lived tokens to JavaScript.

### Supabase service role (`SUPABASE_SERVICE_KEY`)

The API uses the **service role** Supabase client, which **bypasses Row Level Security**. RLS policies in `schema.sql` do not constrain the Node process. Treat the service key like **root database credentials**: server-side only, never in the browser, never in `VITE_*` variables. A leaked key compromises all rows the project can access.

### Suggested follow-ups (outside thesis scope)

- Encrypt GitHub tokens at rest or migrate to **GitHub Apps** with installation tokens.
- Move session tokens to **httpOnly** cookies and tighten CSP / XSS hygiene accordingly.
- Use a **database role** with least privilege if you split read/write paths.
- Add **token refresh** or clear re-auth UX when GitHub returns 401 from stored tokens.

## Operational hardening (thesis context)

- `evaluation/fixtures/cases.js` builds synthetic diffs for the evaluation harness; secret-shaped strings are base64-decoded at runtime so static scanners do not match literals in the repo. Gitleaks allowlists that path in `gitleaks.toml`.
- Run production behind **HTTPS**; never ship real GitHub OAuth tokens over plain HTTP.
- Use a **strong `JWT_SECRET`** (32+ random characters) and rotate on suspected compromise.
- Treat **`SUPABASE_SERVICE_KEY`** as root database access: store only in server-side secrets, never in the browser or Vite `VITE_*` variables.
- Rotate **`GITHUB_WEBHOOK_SECRET`** if webhook signing keys may have leaked; reconnect repositories so GitHub stores the new secret.
- The README **Risks** section documents known limitations (e.g. plaintext `access_token` storage in PostgreSQL).

## Dependency updates

Automated dependency update PRs may be opened by Dependabot (see `.github/dependabot.yml`). Review lockfile changes and run `npm test` in `backend/` and `frontend/` before merging.

## Limitations & future work (cross-reference)

For an honest scope boundary (tokens, JWT storage, service role, scale), see **the sections above** and **README §12 — Risks & Challenges**.
