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

/** True when `incomingOrigin` header matches any allowed FRONTEND_URL entry. */
function isAllowedFrontendOrigin(incomingOrigin, rawFrontendUrlEnv, nodeEnv = process.env.NODE_ENV) {
  if (!incomingOrigin) return true;
  const cand = browserOrigin(incomingOrigin);
  if (!cand) return false;

  const allowList = parseCommaOrigins(rawFrontendUrlEnv || 'http://localhost:5173');

  const devLocalhostBypass =
    nodeEnv !== 'production' &&
    (() => {
      try {
        const h = new URL(incomingOrigin).hostname;
        return h === 'localhost' || h === '127.0.0.1';
      } catch {
        return false;
      }
    })();

  if (devLocalhostBypass) return true;

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
  primaryFrontendBase,
  allFrontendBaseStrings,
};
