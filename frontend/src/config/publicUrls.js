/**
 * Production-friendly API / Socket base URLs:
 * - If VITE_API_URL / VITE_WS_URL are set at build time, they win (needed when API/WebSocket live on another host).
 * - In dev without env, defaults to localhost:3001 for Vite (API not proxied for axios paths /api → full URL backend).
 * - In production builds without env, assumes reverse proxy serves /api (+ /socket.io) on the same origin as the SPA.
 */

function stripTrailingSlashes(url) {
  return String(url).replace(/\/+$/, '');
}

function readEnvTrim(name) {
  const v = import.meta.env[name];
  return typeof v === 'string' ? v.trim() : '';
}

let prodSameOriginLogged = false;

export function getPublicApiBaseUrl() {
  const fromEnv = readEnvTrim('VITE_API_URL');
  if (fromEnv !== '') return stripTrailingSlashes(fromEnv);

  if (import.meta.env.DEV) {
    return 'http://localhost:3001';
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    if (import.meta.env.PROD && !prodSameOriginLogged) {
      prodSameOriginLogged = true;
      // eslint-disable-next-line no-console
      console.info(
        '[deploy] VITE_API_URL unset — using same-origin for REST. Set VITE_API_URL if your API is on another host.'
      );
    }
    return stripTrailingSlashes(window.location.origin);
  }

  return 'http://localhost:3001';
}

export function getPublicSocketBaseUrl() {
  const fromEnv = readEnvTrim('VITE_WS_URL');
  if (fromEnv !== '') return stripTrailingSlashes(fromEnv);
  return getPublicApiBaseUrl();
}
