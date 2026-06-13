# Diagram: Socket.IO realtime flow

The SPA uses Socket.IO for **review lifecycle** updates only. It is not a general-purpose message bus.

## Connection and rooms

1. After login, `SocketProvider` connects to the API origin (or `VITE_WS_URL` when split) with **`withCredentials: true`**.
2. Server middleware (`registerSocketIO.js`) validates the session JWT from handshake `auth.token` or cookies.
3. On success, the server joins the socket to **`user:{userId}`** automatically.
4. The client may emit **`join:repo`** with a repository UUID; the server verifies ownership before joining **`repo:{repositoryId}`**.

```mermaid
sequenceDiagram
  participant SPA as React (SocketContext)
  participant SIO as Socket.IO server
  participant DB as Supabase

  SPA->>SIO: io.connect(credentials)
  SIO->>SIO: JWT from handshake
  alt invalid
    SIO-->>SPA: connect_error
  else valid
    SIO->>SIO: join user:userId
    SPA->>SIO: emit join:repo repoId
    SIO->>DB: repositories.user_id == userId?
    SIO->>SIO: join repo:repoId
  end
```

## Review status events

When `runAnalyzeJob` updates a review (pending → processing → completed/failed), the worker emits:

```text
review:update  →  rooms: user:{userId}, repo:{repositoryId}
```

Payload fields used by the UI include `reviewId`, `status`, and optionally `overallScore`.

```mermaid
flowchart LR
  W[reviewJobProcessor] -->|emit review:update| SIO[Socket.IO]
  SIO --> U[user:userId room]
  SIO --> R[repo:repositoryId room]
  U --> SPA[React listeners]
  R --> SPA
  SPA --> CACHE[socketQuerySync + React Query]
```

## Client handling

| Component | Behaviour |
|-----------|-----------|
| `SocketContext.jsx` | Subscribes to `review:update`, fans out to registered listeners |
| `ReviewSocketCacheSync.jsx` | Calls `applyReviewUpdateToCaches` on each event |
| `socketQuerySync.js` | Patches dashboard/review list caches; debounced refetch on terminal states |
| `DashboardPage.jsx` | Also invalidates bundle on events; polling fallback |

## Degraded mode

If the socket is disconnected, `RealtimeUpdatesBanner` informs the user. Lists and detail pages still work via **REST** and periodic **refetchInterval** on the dashboard.

## Scale-out note

Multiple API instances require a **Redis Socket.IO adapter** so emits reach clients on other nodes. Single-node thesis deployments do not need this.

**Code references:** `backend/src/socket/registerSocketIO.js`, `backend/src/services/reviewJobProcessor.js`, `frontend/src/context/SocketContext.jsx`, `frontend/src/lib/socketQuerySync.js`.

*Documentation only.*
