/**
 * Parses FRONTEND_URL (comma-separated) and compares browser Origin reliably
 * (trailing slashes / minor formatting must not break CORS).
 */

function parseCommaOrigins(raw) {
  return (typeof raw === 'string' ? raw : '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Returns URL.origin for absolute URLs; empty string on parse failure. */
function browserOrigin(orig) {
  if (!orig || typeof orig !== 'string') return '';
  try {
    return new URL(orig.trim()).origin;
  } catch {
    return '';
  }
}

/**
 * True when `hostname` is an IPv4 address inside common private LAN ranges
 * (RFC1918-style use: 10/8, 172.16–172.31/12, 192.168/16).
 * Used only for non-production dev relaxations — never broadens production CORS.
 */
function isPrivateLanIPv4(hostname) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (!m) return false;
  const o = (i) => Number(m[i]);
  const a = o(1);
  const b = o(2);
  const c = o(3);
  const d = o(4);
  if ([a, b, c, d].some((n) => n > 255 || n < 0)) return false;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

/**
 * Development-only relaxed origin check (REST CORS, Socket.IO, OAuth callback host).
 *
 * - Production (`nodeEnv === 'production'`): always false — only `FRONTEND_URL` allow-list applies.
 * - Non-production: allows loopback (localhost, 127.0.0.1, ::1), private LAN IPv4 above,
 *   and optional explicit extras from `FRONTEND_DEV_EXTRA_ORIGINS` (comma-separated origins).
 *
 * Risk if misused: if a deployment runs with NODE_ENV!=production on a trusted network,
 * any device on the same LAN could use a browser against the API (same as pre-existing
 * localhost-only dev bypass, now extended for LAN/mobile testing). Production is unchanged.
 */
function isDevelopmentRelaxedOrigin(incomingOrigin, nodeEnv, extraOriginsEnv) {
  if (nodeEnv === 'production' || !incomingOrigin) return false;
  let hostname;
  try {
    hostname = new URL(incomingOrigin).hostname;
  } catch {
    return false;
  }
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
  // Node reports IPv6 loopback host as "[::1]" for URLs like http://[::1]:5173/
  if (hostname === '[::1]' || hostname === '::1') return true;
  if (isPrivateLanIPv4(hostname)) return true;
  for (const entry of parseCommaOrigins(extraOriginsEnv || '')) {
    if (browserOrigin(entry) === browserOrigin(incomingOrigin)) return true;
  }
  return false;
}

/** True when `incomingOrigin` header matches any allowed FRONTEND_URL entry. */
function isAllowedFrontendOrigin(incomingOrigin, rawFrontendUrlEnv, nodeEnv = process.env.NODE_ENV) {
  if (!incomingOrigin) return true;
  const cand = browserOrigin(incomingOrigin);
  if (!cand) return false;

  const allowList = parseCommaOrigins(rawFrontendUrlEnv || 'http://localhost:5173');

  const devRelaxedBypass =
    isDevelopmentRelaxedOrigin(incomingOrigin, nodeEnv, process.env.FRONTEND_DEV_EXTRA_ORIGINS);

  if (devRelaxedBypass) return true;

  return allowList.some((entry) => browserOrigin(entry) === cand);
}

/** First SPA base string (trimmed); used only for backend-initiated OAuth links. */
function primaryFrontendBase(rawFrontendUrlEnv) {
  const first = parseCommaOrigins(rawFrontendUrlEnv || 'http://localhost:5173')[0];
  return (first || 'http://localhost:5173').replace(/\/+$/, '');
}

/** All SPA bases (strings as provided, trimmed); for OAuth redirect validation. */
function allFrontendBaseStrings(rawFrontendUrlEnv) {
  return parseCommaOrigins(rawFrontendUrlEnv || 'http://localhost:5173');
}

module.exports = {
  parseCommaOrigins,
  browserOrigin,
  isAllowedFrontendOrigin,
  isDevelopmentRelaxedOrigin,
  primaryFrontendBase,
  allFrontendBaseStrings,
};
