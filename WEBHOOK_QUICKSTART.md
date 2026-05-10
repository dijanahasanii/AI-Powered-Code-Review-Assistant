# GitHub webhook quick start (push-to-review)

Automated reviews on **push** and **pull request** events need GitHub to reach your backend over **public HTTPS**. Your API registers a webhook when you **Connect** a repo in the app.

If `BACKEND_URL` is missing or not public, repos save with **`webhook_active: false`** and you see:

> Push-to-review is off for at least one repo

Manual **Review latest** in the UI still works; only **automatic** pushes are affected.

---

## 1. Choose a tunnel (local development)

Expose the backend port (**default `3001`**) as HTTPS:

```bash
npx ngrok http 3001
```

Copy the **HTTPS** forwarding URL (e.g. `https://xxxx.ngrok-free.app`). No trailing slash.

**Alternatives:** Cloudflare Tunnel, localtunnel, or any stable public URL that forwards to your API.

---

## 2. Configure `backend/.env`

From `backend/.env.example`, ensure both are set (see your real `.env`; do not commit secrets):

| Variable                  | Purpose |
|---------------------------|--------|
| `BACKEND_URL`             | Public **https** base URL GitHub calls (tunnel URL in dev). Example: `https://xxxx.ngrok-free.app` |
| `GITHUB_WEBHOOK_SECRET`   | Long random string. The backend sends it when creating the webhook; GitHub uses it to sign deliveries. |

**Optional:** sync ngrok URL into `.env` automatically (ngrok must be running):

```bash
cd backend
node scripts/sync-ngrok-url.js
```

Restart the backend after changing `.env`.

---

## 3. Install webhooks (after fixing `.env`)

**Option A — in the app (no disconnect)**

1. Open **Repositories**.
2. Use **Install webhooks (all)** in the amber banner **or** **Install webhook** on a single repo card.

The API calls **`POST /api/repos/:id/sync-webhook`**, deletes any stale GitHub hook id stored in the DB (if present), registers a fresh webhook at your current `BACKEND_URL`, and sets **`webhook_active`** to true on success.

**Option B — manual**

1. **Disconnect** the repo, then **Connect** again.

Check that GitHub shows a webhook whose URL ends with **`/api/webhooks/github`** and matches your current `BACKEND_URL`.

---

## 4. Verify

1. Backend log on startup should show something like: `Webhooks exposed at: https://…/api/webhooks/github`.
2. In GitHub → repo → **Settings** → **Webhooks** → latest delivery status **200**.
3. Push a commit on a tracked branch → a review should enqueue (monitor **Reviews** in the app).

---

## 5. Production

Deploy the API behind a permanent **HTTPS** domain, set **`BACKEND_URL`** to that origin (no path), keep **`GITHUB_WEBHOOK_SECRET`** set, restart, then reconnect repos if the URL changed from development.

---

## Troubleshooting

- **Banner still appears:** At least one connected repo still has `webhook_active` false → disconnect/connect after env is correct.
- **GitHub deliveries fail:** Firewall, wrong URL, or backend down; check webhook **Recent Deliveries** in GitHub.
- **Signature errors:** Changing `GITHUB_WEBHOOK_SECRET` without recreating the hook → disconnect and connect again.
