# AI-Powered Code Review Assistant

> Bachelor Thesis Project — Full-Stack Web Application  
> AI-driven automated code analysis with GitHub integration and real-time dashboard

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Database Design & Justification](#3-database-design--justification)
4. [Backend Design](#4-backend-design-nodejs)
5. [Frontend Design](#5-frontend-design-react)
6. [AI Prompt Engineering](#6-ai-prompt-engineering)
7. [GitHub Integration](#7-github-integration)
8. [Real-time Features](#8-real-time-features)
9. [Development Phases](#9-development-phases--roadmap)
10. [Testing Strategy](#10-testing-strategy)
11. [Deployment Strategy](#11-deployment-strategy)
12. [Risks & Challenges](#12-risks--challenges)
13. [End-to-End Flow Summary](#13-end-to-end-flow-summary)
14. [Quick Start](#14-quick-start)
15. [Production operations & flows](#15-production-operations--flows)
16. [Development & reproducibility (supplement)](#16-development--reproducibility-supplement)

---

## 1. Project Overview

### What the system does

The AI-Powered Code Review Assistant automatically analyzes source code whenever a developer pushes commits or opens a pull request on GitHub. It uses the OpenAI API (GPT-4o) to detect bugs, security vulnerabilities, performance issues, and style problems. The results are displayed in a React dashboard with real-time updates via WebSockets.

### Problem it solves

Manual code review is time-consuming and inconsistent. Junior developers often miss subtle bugs; senior developers are overloaded with review requests. This system provides an always-available, objective first-pass review that:

- Catches common bugs and security issues instantly
- Frees senior engineers from repetitive low-level feedback
- Provides a quantitative quality score per commit
- Creates a historical record of code quality over time

### Real-world use cases

- **Solo developers**: Get automated feedback on every commit without needing a reviewer
- **Small teams**: Supplement human reviews with AI pre-screening to surface issues before human review
- **Open-source projects**: Automatically comment on incoming PRs with an initial quality assessment
- **Student projects**: Instant educational feedback on code quality and best practices
- **CI/CD pipelines**: Block merges if the AI score drops below a threshold

---

## 2. System Architecture

### High-level overview

```
GitHub (push event)
       │
       │ POST /api/webhooks/github
       ▼
┌──────────────────────────────────────────────────────┐
│                  Node.js Backend (Express)           │
│                                                      │
│  ┌──────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │  Auth    │  │  REST API   │  │ Webhook Handler │  │
│  │  (JWT)   │  │  Routes     │  │ (sig verify)    │  │
│  └──────────┘  └─────────────┘  └────────┬────────┘  │
│                                          │           │
│  ┌────────────────────────────────────────▼────────┐ │
│  │            Bull Job Queue (Redis)               │ │
│  └────────────────────────────────────────┬────────┘ │
│                                           │          │
│  ┌────────────────────────────────────────▼───────┐  │
│  │               Queue Worker                     │  │
│  │  1. Fetch diff (GitHub API)                    │  │
│  │  2. Build prompt + call OpenAI                 │  │
│  │  3. Parse + store results (Supabase)           │  │
│  │  4. Emit WebSocket event                       │  │ 
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
       │                    │                │
  OpenAI API          Supabase DB      Socket.io
  (GPT-4o)          (PostgreSQL)    (Real-time WS)
                                          │
                                          ▼
                           ┌─────────────────────────┐
                           │    React Dashboard      │
                           │  (Vite + Tailwind CSS)  │
                           └─────────────────────────┘
```

### How components interact

1. **GitHub** sends webhook POST requests to the backend whenever code is pushed
2. **Backend** verifies the webhook signature, creates a review record, and adds a job to the Redis queue
3. **Queue Worker** picks up the job, fetches the git diff via GitHub API, builds an AI prompt, calls OpenAI, parses the structured JSON response, and saves results to Supabase
4. **Socket.io** pushes a `review:update` event to the React dashboard in real time
5. **React Dashboard** updates the UI immediately without requiring a page refresh

---

## 3. Database Design & Justification

### Why Supabase (PostgreSQL)?

**vs MongoDB**: Code reviews have clear relational structure (users → repos → reviews → issues). SQL joins make it trivial to query "all critical issues across all reviews for user X". MongoDB would require complex aggregations for the same query.

**vs plain PostgreSQL**: Supabase provides PostgreSQL + a REST API + built-in auth + Row Level Security + a hosted managed instance with a free tier — removing infrastructure burden during development. You can also migrate to a self-hosted PostgreSQL later by only changing connection strings.

**vs Firebase**: Supabase is open-source, SQL-based, and doesn't lock you into a proprietary query language. Better for academic work where you need to reason about data structures formally.

### Schema

```
users
├── id (UUID PK)
├── github_id (BIGINT UNIQUE)
├── username, email, avatar_url
├── access_token (encrypted GitHub OAuth token)
└── created_at, updated_at

repositories
├── id (UUID PK)
├── user_id (FK → users)
├── github_repo_id (BIGINT UNIQUE)
├── full_name, name, description, language
├── is_private, webhook_id, webhook_active
└── created_at, updated_at

code_reviews
├── id (UUID PK)
├── repository_id (FK → repositories)
├── commit_sha (VARCHAR 40)
├── branch, pr_number, author
├── status (pending | processing | completed | failed)
├── triggered_by (webhook | manual)
├── summary (AI-generated text)
├── overall_score (0-100)
└── created_at, completed_at

review_issues
├── id (UUID PK)
├── review_id (FK → code_reviews)
├── file_path, line_number
├── severity (critical | warning | info | suggestion)
├── category (bug | security | performance | style | maintainability)
├── title, description, suggestion
└── created_at

review_file_stats
├── id (UUID PK)
├── review_id (FK → code_reviews)
├── file_path
└── additions, deletions, issues_count
```

### Relationships

- One **user** has many **repositories** (one-to-many)
- One **repository** has many **code reviews** (one-to-many)
- One **code review** has many **review issues** (one-to-many)
- One **code review** has many **file stats** (one-to-many)

---

## 4. Backend Design (Node.js)

### Folder structure

```
backend/
├── src/
│   ├── server.js              # Express app + Socket.io setup
│   ├── config/
│   │   ├── database.js        # Supabase client
│   │   └── schema.sql         # Database DDL
│   ├── controllers/
│   │   ├── authController.js  # GitHub OAuth flow
│   │   ├── reposController.js # CRUD for repositories
│   │   ├── reviewsController.js
│   │   └── webhookController.js
│   ├── middleware/
│   │   ├── auth.js            # JWT verification
│   │   ├── errorHandler.js    # Global error handler
│   │   └── rateLimiter.js     # express-rate-limit
│   ├── routes/
│   │   ├── auth.js
│   │   ├── repos.js
│   │   ├── reviews.js
│   │   └── webhooks.js
│   ├── services/
│   │   ├── openaiService.js   # Prompt + parse AI response
│   │   ├── githubService.js   # Fetch diffs, post PR comments
│   │   ├── reviewQueue.js     # Bull queue instance
│   │   └── queueWorker.js     # Processes review jobs
│   └── utils/
│       └── logger.js          # Winston logger
└── package.json
```

### API routes

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/auth/github` | — | Redirect to GitHub OAuth |
| GET | `/api/auth/github/callback` | — | Exchange code for token |
| GET | `/api/auth/me` | JWT | Get current user |
| GET | `/api/repos` | JWT | List connected repos |
| GET | `/api/repos/github` | JWT | List available GitHub repos |
| POST | `/api/repos` | JWT | Connect a repository |
| DELETE | `/api/repos/:id` | JWT | Disconnect a repository |
| GET | `/api/reviews` | JWT | List reviews (paginated) |
| GET | `/api/reviews/stats` | JWT | Dashboard statistics |
| GET | `/api/reviews/:id` | JWT | Full review with issues |
| POST | `/api/reviews/trigger` | JWT | Manual review trigger |
| POST | `/api/webhooks/github` | Sig | GitHub webhook receiver |

### Authentication

Uses GitHub OAuth 2.0 for login. After OAuth, the backend issues its own JWT (7-day expiry). The JWT is stored in `localStorage` on the frontend and sent as a `Bearer` token on every request. The `authenticate` middleware verifies the JWT and fetches the user from the database.

### Error handling strategy

A centralized `errorHandler` middleware catches all errors. It:
- Logs 5xx errors with stack traces (never in production responses)
- Maps known error codes (PostgreSQL constraint violations, JWT errors) to appropriate HTTP status codes
- Uses a custom `AppError` class for operational errors (validation, not found, etc.)
- Returns clean JSON error responses in a consistent `{ success: false, error: "..." }` shape

---

## 5. Frontend Design (React)

### Folder structure

```
frontend/src/
├── api/
│   └── client.js        # Axios instance + all API functions
├── components/
│   └── common/
│       ├── Layout.jsx   # Sidebar + Outlet wrapper
│       └── UI.jsx       # Reusable: Badge, Spinner, ScoreRing, etc.
├── context/
│   ├── AuthContext.jsx  # Global auth state + login/logout
│   └── SocketContext.jsx# WebSocket connection + helpers
├── pages/
│   ├── LoginPage.jsx
│   ├── CallbackPage.jsx
│   ├── DashboardPage.jsx
│   ├── RepositoriesPage.jsx
│   ├── ReviewsPage.jsx
│   └── ReviewDetailPage.jsx
├── App.jsx              # Router + route protection
├── main.jsx             # React entry point + QueryClient
└── index.css            # Tailwind + global styles
```

### State management approach

**React Query** (`@tanstack/react-query`) handles all server state:
- Automatic caching, background refetching, and stale-while-revalidate behavior
- Mutation handling with `useMutation` for POST/DELETE operations
- Cache invalidation after mutations to keep UI in sync
- No Redux or Zustand needed — server state and minimal local state with `useState` is sufficient for this app

**Context API** for:
- `AuthContext` — user identity, token management
- `SocketContext` — WebSocket instance shared across the component tree

### Dashboard layout

```
┌─────────────────────────────────────────────────────┐
│  Sidebar (fixed)    │  Main content area            │
│                     │                               │
│  [AI] Code Review   │  Dashboard                    │
│                     │  ┌──────┬──────┬──────┬──────┐│
│  ◈ Dashboard        │  │Total │Done  │Active│Score ││
│  ◈ Repositories     │  └──────┴──────┴──────┴──────┘│
│  ◈ Reviews          │  ┌──────────┬────────────────┐ │
│                     │  │ Bar chart│ Recent reviews │ │
│  ● Live updates on  │  │ (issues) │ (list)         │ │
│  [avatar] logout    │  └──────────┴────────────────┘ │
└─────────────────────────────────────────────────────┘
```

---

## 6. AI Prompt Engineering

### System prompt design

The system prompt instructs GPT-4o to:
1. Act as a **senior software engineer** doing a code review
2. Return **only valid JSON** — no markdown, no preamble
3. Follow an **exact schema** with required fields and constrained enum values

Using `response_format: { type: "json_object" }` in the OpenAI API call enforces JSON-only output at the model level, preventing free-form responses.

### Temperature setting

Temperature is set to `0.2` (low) for code review tasks. This produces:
- Consistent, structured output across similar inputs
- Factual and precise technical observations
- Reproducible results for the same diff

Higher temperatures (0.7+) are appropriate for creative tasks but cause inconsistent severity assignments and schema deviations for analytical tasks.

### Handling inconsistent AI responses

Three layers of defense:
1. **`response_format: json_object`** — forces JSON at the API level
2. **`parseAIResponse()`** — strips any accidental markdown fences, then parses and validates
3. **Field normalization** — any invalid severity/category value is replaced with a safe default instead of throwing

If parsing fails, the job is **retried up to 3 times** with exponential backoff (2s, 4s, 8s). After 3 failures, the review is marked `failed` in the database.

### Diff truncation

Long diffs are truncated to ~20,000 characters to stay within token budget. The truncation tries to cut at a `diff --git` file boundary to avoid mid-file cuts that could confuse the model.

---

## 7. GitHub Integration

### How webhooks work

1. When a user connects a repository, the backend calls `POST /repos/:owner/:repo/hooks` via the GitHub API to install a webhook
2. GitHub stores the backend URL (`/api/webhooks/github`) and calls it on every `push` and `pull_request` event
3. Each request includes an `x-hub-signature-256` header — an HMAC-SHA256 signature of the request body using the shared webhook secret

### Security — signature verification

```
Expected signature = HMAC-SHA256(body, GITHUB_WEBHOOK_SECRET)
Actual signature   = x-hub-signature-256 header value

crypto.timingSafeEqual(expected, actual)  ← prevents timing attacks
```

The body must be read as a **raw Buffer** (not parsed JSON) for the HMAC to match. This is why `express.raw()` is applied specifically to the `/api/webhooks` route before the global `express.json()` middleware.

Any request that fails signature verification returns `401` immediately without processing the payload.

### Flow: push → analysis → dashboard

```
1. Developer pushes code
2. GitHub calls POST /api/webhooks/github
3. Backend: verify signature → parse payload → check repo is connected
4. Backend: create code_review record (status: 'pending')
5. Backend: add job to Bull queue → immediately return 200 to GitHub
6. Worker: fetch commit diff from GitHub API
7. Worker: build prompt with diff + repo context
8. Worker: call OpenAI API → parse JSON response
9. Worker: save review_issues + update code_review (status: 'completed', score: X)
10. Worker: emit 'review:update' via Socket.io
11. React Dashboard: receives event → invalidates React Query cache → re-renders
```

Steps 6–11 happen asynchronously in the background. GitHub's webhook system requires a response within 10 seconds — the queue pattern ensures this by immediately returning `200` in step 5.

---

## 8. Real-time Features

### WebSocket architecture

Uses **Socket.io** on the backend and `socket.io-client` on the frontend. Socket.io automatically falls back from WebSockets to HTTP long-polling in restricted network environments.

**Room-based updates**: Each repository has a dedicated room (`repo:{repoId}`). The frontend joins the room for whatever repository it's currently viewing. This prevents broadcasting all reviews to all users.

**Events**:
- `review:update` — emitted when a review changes status (processing → completed/failed)
- `join:repo` — sent from client to server to subscribe to a repo's updates

### Live analysis updates

The `ReviewDetailPage` uses two approaches in parallel:
1. **React Query `refetchInterval`** — polls every 3 seconds when status is `pending` or `processing` (fallback for if WebSocket is unavailable)
2. **Socket.io event listener** — instantly invalidates the React Query cache when a `review:update` event arrives

This dual approach ensures the UI always updates even if the WebSocket connection drops.

---

## 9. Development Phases & Roadmap

### Phase 1: Project Setup (Days 1–3)

- [ ] Create GitHub repository and project structure
- [ ] Configure Node.js backend with Express, CORS, Helmet
- [ ] Set up Supabase project and run schema.sql
- [ ] Set up React frontend with Vite + Tailwind CSS
- [ ] Configure `.env` files with all required variables
- [ ] Set up Redis locally (or use Redis Cloud free tier)
- [ ] Test: `GET /health` returns 200, frontend loads in browser

### Phase 2: Authentication (Days 4–6)

- [ ] Register a GitHub OAuth App (Settings → Developer settings)
- [ ] Implement `GET /api/auth/github` redirect
- [ ] Implement `GET /api/auth/github/callback` — exchange code, create/update user in DB
- [ ] Implement JWT issuance and `authenticate` middleware
- [ ] Build `LoginPage` with GitHub button
- [ ] Build `CallbackPage` that stores JWT and redirects
- [ ] Test: complete login flow end-to-end in browser

### Phase 3: Repository Management (Days 7–9)

- [ ] Implement `GET /api/repos/github` — list GitHub repos
- [ ] Implement `POST /api/repos` — connect repo + install webhook
- [ ] Implement `DELETE /api/repos/:id` — disconnect + remove webhook
- [ ] Build `RepositoriesPage` with GitHub repo picker
- [ ] Test: connect a repo, verify webhook appears in GitHub settings

### Phase 4: AI Integration (Days 10–14)

- [ ] Implement `openaiService.js` with prompt engineering
- [ ] Test prompt with sample diffs using a Node.js script
- [ ] Implement `githubService.js` — fetch commit diffs
- [ ] Implement `reviewQueue.js` + `queueWorker.js`
- [ ] Test: manually trigger a job, verify full analysis pipeline
- [ ] Test: verify structured JSON is saved to `review_issues` table

### Phase 5: GitHub Webhook Integration (Days 15–17)

- [ ] Implement `webhookController.js` with signature verification
- [ ] Use `ngrok` to expose localhost for GitHub webhook delivery during dev
- [ ] Test: push a commit → verify webhook received → review created
- [ ] Implement `postPRComments` to post feedback back to GitHub PR

### Phase 6: Frontend Dashboard (Days 18–23)

- [ ] Build `Layout.jsx` with sidebar navigation
- [ ] Build `DashboardPage` with stats cards and recent reviews list
- [ ] Build `ReviewsPage` with filtering and pagination
- [ ] Build `ReviewDetailPage` with issues list and score ring
- [ ] Integrate React Query for all API calls
- [ ] Integrate Socket.io for real-time updates
- [ ] Test: complete user flow from login → connect repo → view review

### Phase 7: Testing (Days 24–27)

- [ ] Write unit tests for `openaiService.js` (mock OpenAI)
- [ ] Write API tests for auth middleware and webhook signature
- [ ] Write integration tests for review trigger → worker flow
- [ ] Test edge cases: empty diff, binary files, huge diff, API rate limits
- [ ] Cross-browser test the dashboard

### Phase 8: Deployment (Days 28–30)

- [ ] Deploy backend to Railway or Render
- [ ] Deploy frontend to Vercel
- [ ] Set all production environment variables
- [ ] Update GitHub OAuth App callback URL to production URL
- [ ] Update webhook URLs for connected repositories
- [ ] Smoke test the complete production flow

---

## 10. Testing Strategy

### Unit tests

**`openaiService.test.js`**:
- Mock the OpenAI client — never call the real API in tests
- Verify structured output is returned for a sample diff
- Verify score is clamped to 0–100
- Verify invalid severity values are normalized
- Verify retry logic is triggered on rate limit errors

**`webhookController` (in api.test.js)**:
- Verify requests without a signature return 401
- Verify requests with an incorrect signature return 401
- Verify requests with a valid HMAC-SHA256 signature return 200

### API/integration tests

Use `supertest` to test routes against the Express app with a mocked Supabase client:
- Auth middleware rejects missing/invalid tokens
- Auth middleware accepts valid JWTs
- Protected routes return 401 without a token
- Review list endpoint returns paginated results

### Edge cases to test manually

| Scenario | Expected behavior |
|----------|------------------|
| Push with no code changes (only config files) | Review created with "No changes" summary |
| Push with binary files only (.png, .pdf) | Binary files filtered out, empty diff handled |
| Diff > 20,000 characters | Diff truncated with note appended |
| OpenAI returns malformed JSON | Retry up to 3 times, then mark review as failed |
| GitHub webhook secret mismatch | 401 returned immediately |
| Duplicate webhook for same commit | Checked before insert, silently ignored |
| User disconnects repo mid-review | Worker logs warning, review marked failed |

---

## 11. Deployment Strategy

### Frontend — Vercel

Vercel is ideal for React/Vite apps:
- Auto-deploys from `main` branch on GitHub push
- Builds with `npm run build`, serves from global CDN
- Free tier supports custom domains and HTTPS automatically

**Steps**:
1. `vercel login` then `vercel --prod` in the `frontend/` directory
2. Set `VITE_API_URL` and `VITE_WS_URL` in Vercel environment variables
3. All routes → `index.html` via Vercel's SPA rewrite rules

### Backend — Railway

Railway supports Node.js apps with Redis and PostgreSQL add-ons:
- GitHub integration for automatic deploys
- Redis add-on available (for Bull queue)
- Environment variables managed via UI
- Free tier available; $5/month for always-on

**Alternative**: **Render** (similar, also has a free tier with sleep-on-inactivity).

**Steps**:
1. Connect GitHub repo in Railway dashboard
2. Add Redis add-on → `REDIS_URL` set automatically
3. Set all environment variables from `.env.example`
4. Set start command: `node src/server.js`

### Database — Supabase

- Managed PostgreSQL with free tier (500MB storage, 2 projects)
- Run `schema.sql` once in the Supabase SQL editor
- Use the **service role key** (not anon key) for backend — it bypasses RLS
- Enable RLS and add policies before going public

### Environment variables handling

**Never commit `.env` files**. Use:
- `.env.example` as a template (committed to the repo)
- Platform-specific secret managers (Railway env vars, Vercel env vars, GitHub Secrets for CI)
- Different values per environment (development, staging, production)

See [SECURITY.md](SECURITY.md) for secret handling and vulnerability reporting.

---

## 12. Risks & Challenges

This section is kept aligned with the **current** implementation (not the original thesis prototype). Each item includes a **status** so operators know what is enforced in code versus what remains policy or future hardening.

### External API throughput (GitHub + job queue)

**Risk**: Bursting GitHub activity (pushes, large trees) or many concurrent reviews could hit **GitHub REST rate limits** or overload a single worker.

**Status**: **Mitigated in code for the paths that exist today** — the production analysis path does **not** call the OpenAI API (`usesOpenAiApi === false` in `getReviewAiRuntimeInfo()`). Throughput limits are mainly **GitHub API** usage and **CPU/IO** during snapshot/rule analysis.

**Verified mitigations**:
- Bull processing uses **`concurrency: 3`** for `analyze` jobs (`reviewJobProcessor.js`).
- GitHub reads use **`withGithubRetry`** (up to three attempts): non-retryable **`400` / `401` / `403`** fail fast; for **`429`** and transient errors, delay is **`500ms × 2^attempt`** (and **`200ms × attempt`** for other transient failures) before retry — *not* fixed 2s/4s/8s backoff.
- Repository scanning caps work: **tree/blob limits**, **max files scanned**, and **per-file size caps** (see `githubService.js`, `pathFilter.js`, `repositoryAnalyzer.js`).

**Residual risk**: Heavy concurrent org-wide activity can still exhaust GitHub quota — monitor GitHub **`X-RateLimit-*`** responses and consider **fewer workers**, **Redis-backed queue tuning**, or **GitHub Apps** with higher limits for large installations.

---

### Analysis consistency (rules + snapshot, not LLM JSON)

**Risk**: Earlier designs relied on an LLM returning strict JSON; malformed output could break persistence.

**Status**: **Resolved for that specific failure mode** — reviews use deterministic **static rules**, **diff heuristics**, and optional **repository snapshot** analysis. There is no **`response_format: json_object`** path in the current `openaiService.js` analysis flow.

**Verified mitigations**:
- Output is shaped to what **`finalizeReview`** expects (summary, score, issues, positives).
- Worker **`try/catch`** marks reviews **`failed`** and emits **`review:update`** instead of crashing the process.

**Residual risk**: **Quality/coverage** of findings is heuristic-driven, not “single JSON schema parse” — tune rules and snapshots rather than JSON parsers.

---

### GitHub webhook authenticity

**Risk**: An attacker could forge webhook POSTs and create bogus reviews or load the queue.

**Status**: **Resolved** for signature verification.

**Verified behavior** (`webhookController.js` + `server.js`):
- **`X-Hub-Signature-256`** validated with **HMAC-SHA256** over the **raw body**; compared with **`crypto.timingSafeEqual`** (length-checked).
- Invalid or missing signatures → **`401`** before enqueue or DB writes.
- **`express.raw`** is applied only under **`/api/webhooks`** so the signing payload matches GitHub’s bytes.
- Global API rate limiting **skips** `/api/webhooks` (and `/health`) so legitimate GitHub delivery bursts are not dropped as “API abuse” (`rateLimiter.js`).

**Residual risk**: **Compromised `GITHUB_WEBHOOK_SECRET`** or **leaked raw body middleware order** — protect secrets and keep the raw-parser route ordering as documented above.

---

### Session and stored GitHub token security

**Risk**: Stolen **GitHub OAuth tokens** in `users.access_token` allow API access as the user; stolen **app JWTs** allow dashboard/API access until expiry.

**Status**: **Partially mitigated** — **HTTPS**, **application JWTs**, and **strong `JWT_SECRET` enforcement** are in place; **database encryption of `access_token` is not implemented** (tokens are stored as plaintext in PostgreSQL).

**Verified mitigations**:
- App JWT: **`jwt.sign(..., { expiresIn: process.env.JWT_EXPIRES_IN || '7d' })`** — refresh by re-running OAuth when the token expires.
- Login path refuses weak config: **`JWT_SECRET`** must exist and be **≥ 16 characters** (`authController.js`).
- Host **HTTPS** (e.g. Railway/Vercel) protects tokens in transit.

**Open hardening (not implemented; requires careful rollout)**:
- **Encrypt `access_token` at the application layer** (e.g. AES-256-GCM with a **`TOKEN_ENCRYPTION_KEY`**) with **backwards compatibility** for existing rows, or use a **secrets manager** / **vault** for the column.
- Restrict **Supabase dashboard / service role** access and rotate keys on any suspicion of DB exposure.

---

### Scalability, workers, and realtime fan-out

**Risk**: A single Node process or one worker tier may become a bottleneck; broadcasting events to every client would not scale.

**Status**: **Architecturally addressed**; actual headroom depends on hosting.

**Verified mitigations**:
- **Bull + Redis**: jobs persist and retry (**`attempts: 3`**, exponential **`backoff`** on the queue — `reviewQueue.js`); multiple worker processes can consume the same queue.
- **Socket.IO**: after handshake, each socket joins **`user:<userId>`**; optional **`join:repo`** only succeeds if Supabase shows the repo’s **`user_id`** matches the socket user (`registerSocketIO.js`). Review updates target user/repo rooms instead of global broadcast.

**Residual risk**: **Horizontal scaling** of Socket.IO may require **sticky sessions** or a **Redis adapter** for multi-instance emit — not required for a single-node deployment.

---

### Test coverage and API contract drift

**Risk**: Backend-heavy tests with a thin frontend suite let UI regressions ship; divergent response shapes break the dashboard.

**Status**: **Partially mitigated**.

**Verified mitigations**:
- Backend: **Jest** API and socket tests (`backend/src/__tests__/`).
- Frontend: **Vitest + React Testing Library** behavioral tests for repositories, reviews, and detail flows; CI runs **`npm test -- --run`** with raised Node heap to avoid OOM (`ci.yml`).
- **`frontend/src/api/contractGuard.js`** (and tests) help catch response shape drift for selected payloads.

**Residual risk**: **End-to-end** (e.g. Playwright) for **full auth redirect** and cross-browser flows is not a focus of the current unit/RTL suite — add E2E before a high-stakes production cutover.

---

## 13. End-to-End Flow Summary

Here is the complete journey from a code push to seeing results in the dashboard, in plain English:

1. **Developer pushes code** to a GitHub branch on a connected repository
2. **GitHub delivers a webhook** POST to `/api/webhooks/github` with the commit details
3. **Backend verifies the signature** using HMAC-SHA256 to confirm it genuinely came from GitHub
4. **Backend creates a review record** in the database with `status: pending`, then adds a job to the Redis queue and immediately returns `200 OK` to GitHub
5. **Queue worker picks up the job** and changes the status to `processing`
6. **Worker fetches the git diff** for that specific commit from the GitHub API (when available)
7. **Worker runs the analysis pipeline** — repository snapshot + static rules and diff heuristics (no OpenAI call in the current `usesOpenAiApi === false` configuration)
8. **Analysis produces** a quality score, summary, and structured issues list for persistence
9. **Worker saves the results**: updates the review with the score and summary, inserts all issues into `review_issues`
10. **Worker emits a WebSocket event** (`review:update`) to the relevant Socket.io room
11. **React Dashboard receives the event** in real time and invalidates the React Query cache
12. **Dashboard re-renders** showing the completed review with score ring, issues list, file stats, and summary
13. **If it was a PR**, the worker also posts inline comments directly back to the GitHub pull request

The entire pipeline from push to results appearing on the dashboard typically takes **15–30 seconds**.

---

## 14. Quick Start

### Prerequisites

- **Node.js 20 LTS** (matches CI and Docker; `.nvmrc` contains `20` — Node 18 may work but is not what CI runs)
- **npm** (bundled with Node)
- **Redis** — only if you set `QUEUE_DRIVER=redis` (see `backend/.env.example`). Default: in-process queue, no Redis
- **Supabase** project (free tier is enough)
- **GitHub OAuth App** (for login and repo access)

### 1. Clone and install

```bash
git clone <your-repo-url> ai-code-review
cd ai-code-review
npm run install:all
```

### 2. Configure environment variables

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your values

# Frontend
cp frontend/.env.example frontend/.env
# Edit frontend/.env with your values

npm run verify:setup
```

Checks Node 20 parity, required Supabase + JWT keys in `backend/.env`, and warns on missing GitHub / frontend OAuth values.

For **CORS, Socket.IO, and OAuth** when testing from a LAN IP, IPv6 loopback, or a custom local hostname, see [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) (section *Browser origins*).

### 3. Set up the database

Log into Supabase → SQL Editor → paste and run `backend/src/config/schema.sql`

### 4. Start development servers

```bash
npm run dev
# Backend runs on :3001
# Frontend runs on :5173
```

Smoke check: `curl -s http://localhost:3001/health` (or open in a browser) should return JSON with `"status":"ok"`.

### 4b. Docker Compose (optional)

`docker-compose.yml` runs **Redis**, the **backend** (`QUEUE_DRIVER=redis`), and the **Vite** dev server. It does **not** replace Supabase: copy `backend/.env.example` → `backend/.env` with real `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` before `docker compose up`. See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for Compose version notes (`env_file` / `required: false`).

### 5. Expose backend for GitHub webhooks (development)

```bash
npx ngrok http 3001
# Copy the https URL, set as BACKEND_URL in backend/.env
```

### 6. Register GitHub OAuth App

GitHub → Settings → Developer Settings → OAuth Apps → New  
- Homepage URL: `http://localhost:5173`
- Callback URL: `http://localhost:5173/auth/callback`

Copy Client ID and Client Secret to your `.env` files.

---

## 15. Production operations & flows

High-level behavior you can rely on when operating or debugging this stack.

### Review lifecycle

1. A row is created in `code_reviews` with `status: pending` (manual trigger, webhook, or duplicate-commit resolution).
2. Work is **queued**: either **in-process** (`QUEUE_DRIVER` unset or not `redis`) or **Bull + Redis** (`reviewQueue.add`).
3. The worker loads the diff (GitHub API), runs analysis (OpenAI / rules), writes `review_issues` and `review_file_stats`, sets `status: completed` or `failed`, and emits **`review:update`** over Socket.io.

### GitHub → webhook → review

1. GitHub POSTs signed payloads to **`POST /api/webhooks/github`**.
2. The backend verifies **HMAC** with `GITHUB_WEBHOOK_SECRET`, maps the repo to your DB, and enqueues the same analyze pipeline as manual triggers where applicable.

### Realtime (Socket.io)

1. The browser opens a Socket.io connection with **`auth: { token }` (JWT)**.
2. After handshake, the server joins the socket to **`user:<yourUserId>`** automatically; the client may request **`join:repo`** for repos you own (server validates ownership).
3. On review status changes, the API emits **`review:update`** to the owning user (and repo room) so the dashboard can invalidate React Query caches.

### Queue / worker

- **Redis + Bull**: jobs are persisted and retried per Bull settings; logs include **`jobId`** when enqueued.
- **Inline**: jobs run immediately in a detached promise on the API process; logs tag **`reviewId` / `repositoryId`** for correlation.

---

## 16. Development & reproducibility (supplement)

For a **clean-machine checklist**, Docker Compose behavior, CI parity with Node 20, **browser origins (CORS / Socket.IO / OAuth, LAN testing, `FRONTEND_DEV_EXTRA_ORIGINS`)**, and operational security notes, see **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)** and **[SECURITY.md](SECURITY.md)**.

---

## Project Structure Overview

```
ai-code-review/
├── backend/
│   ├── src/
│   │   ├── server.js
│   │   ├── config/       (database.js, schema.sql)
│   │   ├── controllers/  (auth, repos, reviews, webhooks)
│   │   ├── middleware/   (auth, errorHandler, rateLimiter)
│   │   ├── routes/       (auth, repos, reviews, webhooks)
│   │   ├── services/     (openai, github, queue, worker)
│   │   ├── utils/        (logger)
│   │   └── __tests__/    (api.test.js, openai.test.js)
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/          (client.js)
│   │   ├── components/   (Layout, UI)
│   │   ├── context/      (AuthContext, SocketContext)
│   │   └── pages/        (Login, Callback, Dashboard, Repos, Reviews, Detail)
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── docker-compose.yml    # Redis + dev backend/frontend (Supabase still required)
├── package.json
└── README.md             ← this file
```
