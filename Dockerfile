# ── Stage 1: build frontend SPA ───────────────────────────────────────────────
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# Same-origin production: omit VITE_API_URL / VITE_WS_URL (see frontend/src/config/publicUrls.js)
RUN npm run build

# ── Stage 2: production API + static SPA ─────────────────────────────────────
FROM node:20-alpine

WORKDIR /app/backend

ENV NODE_ENV=production

# Install git and openssh (required for auto-remediation)
RUN apk add --no-cache git openssh

RUN git config --global user.name "AI Code Review Assistant" && \
    git config --global user.email "bot@ai-review.app"

COPY backend/package.json backend/package-lock.json ./

RUN npm ci --omit=dev

COPY backend/ ./

COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

EXPOSE 3001

CMD ["node", "src/server.js"]