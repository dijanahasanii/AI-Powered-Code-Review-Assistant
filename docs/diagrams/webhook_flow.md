# Diagram: GitHub webhook → review queue (conceptual)

Part of [ARCHITECTURE.md](../ARCHITECTURE.md) §6. Related: [queue_processing.md](queue_processing.md), [data_flow.md](data_flow.md).

Textual flow (push / PR event):

1. GitHub sends **signed** `POST` JSON to **`/api/webhooks/github`**.
2. Express applies **`express.raw`** only under `/api/webhooks` so the HMAC input matches GitHub’s bytes (`server.js`).
3. `webhookController` verifies **`X-Hub-Signature-256`**, resolves repository, deduplicates commit if needed, inserts **`code_reviews`** row, calls **`enqueueAnalyzeJob`**.
4. Worker path: **inline** (default) or **Bull + Redis** when `QUEUE_DRIVER=redis` (`reviewQueue.js`, `queueWorker.js`).
5. Worker fetches diff (GitHub API), runs **`analyzeCode`** (static snapshot rules + diff heuristics; **no OpenAI HTTP** in default build), persists issues, emits **`review:update`** via Socket.IO.

```mermaid
flowchart LR
  GH[GitHub] -->|POST signed JSON| WH[/api/webhooks/github]
  WH --> V{Valid HMAC?}
  V -->|no| E401[401]
  V -->|yes| Q[Enqueue analyze job]
  Q --> W[Worker]
  W --> DB[(Supabase)]
  W --> SIO[Socket.IO emit]
```

**Code references:** `backend/src/controllers/webhookController.js`, `backend/src/services/reviewQueue.js`, `backend/src/services/reviewJobProcessor.js`, `backend/src/server.js`.

This file is **documentation only**; it does not change webhook or queue logic.
