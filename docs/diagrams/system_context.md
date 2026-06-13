# Diagram: System context (C4 level 1)

High-level view of actors and software boundaries for the AI-Powered Code Review Assistant.

```mermaid
C4Context
  title System context — AI Code Review Assistant

  Person(dev, "Developer", "Connects repos, views reviews")
  System(spa, "React SPA", "Dashboard, OAuth callback")
  System(api, "Node API", "REST, webhooks, Socket.IO, worker")
  SystemDb(db, "Supabase", "Postgres persistence")
  System_Ext(gh, "GitHub", "OAuth, API, webhooks")
  System_Ext(redis, "Redis", "Optional Bull queue")

  Rel(dev, spa, "Uses HTTPS")
  Rel(spa, api, "REST + WebSocket, cookies")
  Rel(api, db, "Service role client")
  Rel(api, gh, "OAuth, diffs, webhooks")
  Rel(gh, api, "Signed webhook POST")
  Rel(api, redis, "Optional jobs", "QUEUE_DRIVER=redis")
```

## Trust boundaries

| Boundary | Notes |
|----------|--------|
| Browser ↔ API | Session cookie `acr_session`; CORS allow-list via `FRONTEND_URL` |
| API ↔ Supabase | Service role key — **bypasses RLS**; all authorization in application code |
| API ↔ GitHub | Per-user encrypted token; webhook HMAC with `GITHUB_WEBHOOK_SECRET` |
| Analysis | Runs on API host CPU — static rules today; see [FUTURE_AI_INTEGRATION.md](../FUTURE_AI_INTEGRATION.md) for LLM |

*Documentation only.*
