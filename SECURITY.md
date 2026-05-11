# Security

## Supported versions

Security fixes are applied on the active `main` branch for this thesis / reference implementation. There is no long-term commercial support window.

## Reporting a vulnerability

Please open a **private** security advisory on the hosting GitHub repository (or email the repository maintainer listed in the thesis documentation) with:

- A short description of the issue and affected components (backend, frontend, or both)
- Steps to reproduce, or proof-of-concept, if safe to share
- Suggested impact (e.g. authentication bypass, webhook forgery, data exposure)

Do not file public issues for undisclosed critical vulnerabilities until a fix is agreed.

## Operational hardening (thesis context)

- Run production behind **HTTPS**; never ship real GitHub OAuth tokens over plain HTTP.
- Use a **strong `JWT_SECRET`** (32+ random characters) and rotate on suspected compromise.
- Treat **`SUPABASE_SERVICE_KEY`** as root database access: store only in server-side secrets, never in the browser or Vite `VITE_*` variables.
- Rotate **`GITHUB_WEBHOOK_SECRET`** if webhook signing keys may have leaked; reconnect repositories so GitHub stores the new secret.
- The README **Risks** section documents known limitations (e.g. plaintext `access_token` storage in PostgreSQL).

## Dependency updates

Automated dependency update PRs may be opened by Dependabot (see `.github/dependabot.yml`). Review lockfile changes and run `npm test` in `backend/` and `frontend/` before merging.
