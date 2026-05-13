'use strict';

const crypto = require('crypto');

/**
 * Maximum lifetime of the OAuth `state` value (mitigates replay if a captured URL is reused).
 * RFC 6749 recommends an unpredictable `state`; we additionally bind expiry + HMAC.
 */
const STATE_MAX_AGE_MS = 10 * 60 * 1000;

function signingSecret() {
  const s = process.env.JWT_SECRET;
  return typeof s === 'string' && s.length > 0 ? s : null;
}

/**
 * Create an opaque `state` parameter for GitHub's authorize URL.
 * Uses HMAC-SHA256 over (nonce + expiry) keyed by JWT_SECRET — no DB rows or session middleware.
 * Purpose: CSRF / session-fixation resistance on OAuth return (GitHub echoes `state` back unchanged).
 */
function createGithubOAuthState() {
  const secret = signingSecret();
  if (!secret) {
    const err = new Error('JWT_SECRET is required to sign OAuth state');
    err.code = 'OAUTH_STATE_CONFIG';
    throw err;
  }
  const nonce = crypto.randomBytes(16).toString('base64url');
  const exp = Date.now() + STATE_MAX_AGE_MS;
  const payload = `${nonce}.${exp}`;
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

/**
 * Verify `state` returned on `/auth/callback` before exchanging `code` with GitHub.
 */
function verifyGithubOAuthState(stateParam) {
  if (typeof stateParam !== 'string' || !stateParam.trim()) return false;
  const secret = signingSecret();
  if (!secret) return false;

  const trimmed = stateParam.trim();
  const parts = trimmed.split('.');
  if (parts.length !== 3) return false;

  const [nonce, expStr, sig] = parts;
  if (!nonce || !expStr || !sig) return false;

  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;

  const payload = `${nonce}.${exp}`;
  const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');

  const a = Buffer.from(sig, 'utf8');
  const b = Buffer.from(expectedSig, 'utf8');
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

module.exports = {
  createGithubOAuthState,
  verifyGithubOAuthState,
  STATE_MAX_AGE_MS,
};
