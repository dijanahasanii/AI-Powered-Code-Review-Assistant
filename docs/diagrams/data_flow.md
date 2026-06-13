# Diagram: Data flow (logical)

How information moves between the browser, API, database, and GitHub for the main workflows.

See [ARCHITECTURE.md](../ARCHITECTURE.md) for narrative detail.

## Pull: authenticated dashboard load

```mermaid
flowchart LR
  SPA[React SPA] -->|GET /api/reviews/dashboard cookie| API[Express]
  API -->|JWT verify| AUTH[middleware/auth]
  AUTH -->|aggregate stats + recent| DB[(Supabase)]
  API --> SPA
```

## Push: GitHub webhook → persisted review

```mermaid
flowchart TD
  GH[GitHub] -->|POST signed JSON| WH[webhookController]
  WH -->|insert code_reviews| DB[(Supabase)]
  WH --> Q[enqueueAnalyzeJob]
  Q --> P[runAnalyzeJob]
  P -->|fetch diff/tree| GH
  P -->|analyzeCode static| ANA[openaiService]
  P -->|upsert issues + score| DB
  P -->|review:update| SIO[Socket.IO]
  SIO --> SPA[React cache patch]
```

## Push: user connects repository

```mermaid
sequenceDiagram
  participant SPA as React
  participant API as Express
  participant GH as GitHub
  participant DB as Supabase

  SPA->>API: POST /api/repos/connect
  API->>GH: create webhook
  API->>DB: insert repositories
  API-->>SPA: repo row + webhook_active
  SPA->>SPA: invalidate repos + dashboard queries
```

## Reports (derived artifact)

After a review completes, `reportGeneratorService` may write `analysis_reports` and markdown on disk. The SPA reads metadata via `GET /api/reports` and content via `GET /api/reports/:id/markdown`.

**Code references:** `reviewsController.js`, `webhookController.js`, `reviewJobProcessor.js`, `reportGeneratorService.js`, `frontend/src/api/client.js`.

*Documentation only.*
