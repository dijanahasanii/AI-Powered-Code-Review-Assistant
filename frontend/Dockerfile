# Build stage
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

# Injected at `docker compose build`; leave blank to use SPA same-origin (/api + /socket.io proxies)
ARG VITE_API_URL=
ARG VITE_WS_URL=
ARG VITE_GITHUB_CLIENT_ID=
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL
ENV VITE_GITHUB_CLIENT_ID=$VITE_GITHUB_CLIENT_ID

COPY . .
RUN npm run build

# Production stage — serve with Nginx
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
