# Architecture (thesis reference)

This document matches the **current** codebase: a single Node.js API, a Vite React SPA, Supabase (Postgres) for persistence, optional Redis for Bull, and Socket.IO for realtime UI updates.

## Frontend / backend separation

- **React (Vite)** is a static SPA. It calls the **Express** JSON API under `/api/*` and opens a **Socket.IO** connection to the same host (or `VITE_WS_URL` when split).
- **No business rules** in the database triggers for reviews: the worker owns analysis and writes results via the service-role Supabase client.

Rationale: a clear split keeps the thesis narrative simple (one repo, two deployable surfaces) while still reflecting common “BFF-less SPA + API” patterns.

## End-to-end flow (webhook → queue → analysis → realtime)

1. **GitHub** `POST`s signed JSON to `/api/webhooks/github`.
2. **Express** verifies `X-Hub-Signature-256`, resolves the repo, inserts a `code_reviews` row, and calls **`enqueueAnalyzeJob`**.
3. **Queue driver**: default **in-process** (`QUEUE_DRIVER` unset or not `redis`); optional **Bull + Redis** when `QUEUE_DRIVER=redis`.
4. **Worker** (`reviewJobProcessor` / `runAnalyzeJob`) fetches diff/tree via **GitHub API** using the user’s stored token, runs **`openaiService.analyzeCode`** (snapshot + static rules when possible; **diff-only heuristics** otherwise — **no OpenAI HTTP call** in the current `usesOpenAiApi === false` configuration), persists issues, then **emits `review:update`** on Socket.IO rooms scoped by user/repo.
5. **React Query** listeners invalidate lists/detail so the dashboard updates without a full reload.

See also: [diagrams/webhook_flow.md](diagrams/webhook_flow.md), [diagrams/queue_processing.md](diagrams/queue_processing.md), [diagrams/oauth_flow.md](diagrams/oauth_flow.md).

## Why Socket.IO

Pushes let the UI reflect **processing → completed** without polling aggressively. The server already had an HTTP server; Socket.IO adds a small, well-documented channel for **review lifecycle** events only (not a general message bus).

Tradeoff: multi-instance deployments would need a **Redis adapter** for Socket.IO; a single-node thesis deployment avoids that complexity.

## Supabase + service role

The API uses **`SUPABASE_SERVICE_KEY`** (service role) from the Node process only. That **bypasses Row Level Security** — RLS in `schema.sql` documents intent but does not constrain this server.

Tradeoff: excellent developer speed for a thesis; **not** multi-tenant isolation at the DB boundary. See [SECURITY.md](../SECURITY.md).

## Offline evaluation harness

The **`evaluation/`** folder batch-runs **`analyzeCode(diff, {})`** against synthetic unified diffs. It measures **latency** and **issue counts** without GitHub, Redis, or Supabase — useful for reproducible thesis numbers and regression checks on the analyzer path.

Tradeoff: harness results are **not** a substitute for production traces; they validate the static/heuristic pipeline in isolation.
