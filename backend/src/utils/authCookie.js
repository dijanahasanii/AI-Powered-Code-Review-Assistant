'use strict';

const cookie = require('cookie');
const { parseCommaOrigins } = require('./frontendOrigins');

const COOKIE_NAME = 'acr_session';

function parseExpiresInMs() {
  const raw = process.env.JWT_EXPIRES_IN || '7d';
  if (typeof raw === 'string' && /^\d+d$/i.test(raw.trim())) {
    return parseInt(raw, 10) * 24 * 60 * 60 * 1000;
  }
  return 7 * 24 * 60 * 60 * 1000;
}

/**
 * Origin browsers use for API calls (session cookies). BACKEND_URL may be ngrok for webhooks only.
 */
function resolveSessionApiOrigin() {
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    const backendRaw = (process.env.BACKEND_URL || '').trim();
    if (!backendRaw) return null;
    try {
      return new URL(backendRaw.replace(/\/+$/, '')).origin;
    } catch {
      return null;
    }
  }
  const port = Number(process.env.PORT) || 3001;
  // Jest binds a high random PORT; session cookies still target the normal local API port.
  if (port >= 10000) {
    return 'http://localhost:3001';
  }
  return `http://localhost:${port}`;
}

/**
 * True when any FRONTEND_URL origin differs from the API origin (e.g. Vercel + Railway).
 */
function usesCrossSiteSessionCookies() {
  const apiOrigin = resolveSessionApiOrigin();
  if (!apiOrigin) return false;
  const frontends = parseCommaOrigins(process.env.FRONTEND_URL);
  if (!frontends.length) return false;
  return frontends.some((entry) => {
    try {
      return new URL(entry.trim()).origin !== apiOrigin;
    } catch {
      return false;
    }
  });
}

/**
 * Session cookie options — httpOnly always; SameSite per SPA/API origin layout.
 */
function cookieBaseOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  const crossSite = usesCrossSiteSessionCookies();
  const apiOrigin = resolveSessionApiOrigin() || '';
  const localApi =
    !isProd && (apiOrigin.includes('localhost') || apiOrigin.includes('127.0.0.1'));
  return {
    httpOnly: true,
    // SameSite=None requires Secure; browsers allow Secure on http://localhost in dev.
    secure: isProd || (crossSite && localApi),
    sameSite: crossSite ? 'none' : 'lax',
    path: '/',
  };
}

/**
 * @returns {string|null} error message or null if valid
 */
function validateCookieSecurity() {
  const opts = cookieBaseOptions();
  if (opts.sameSite === 'none' && !opts.secure) {
    return 'Invalid session cookie configuration: SameSite=None requires Secure=true (set NODE_ENV=production or align FRONTEND_URL with BACKEND_URL origin).';
  }
  if (!opts.httpOnly) {
    return 'Session cookies must be httpOnly.';
  }
  return null;
}

function setAuthCookie(res, jwtToken) {
  res.cookie(COOKIE_NAME, jwtToken, {
    ...cookieBaseOptions(),
    maxAge: parseExpiresInMs(),
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, cookieBaseOptions());
}

function readAuthCookieHeader(cookieHeader) {
  if (!cookieHeader || typeof cookieHeader !== 'string') return null;
  const parsed = cookie.parse(cookieHeader);
  const token = parsed[COOKIE_NAME];
  if (token == null || typeof token !== 'string') return null;
  const trimmed = token.trim();
  return trimmed || null;
}

/**
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function getJwtFromRequest(req) {
  if (req.cookies && req.cookies[COOKIE_NAME]) {
    const c = String(req.cookies[COOKIE_NAME]).trim();
    if (c) return c;
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.split(' ')[1];
    if (bearer && bearer.trim()) return bearer.trim();
  }
  return readAuthCookieHeader(req.headers.cookie);
}

module.exports = {
  COOKIE_NAME,
  setAuthCookie,
  clearAuthCookie,
  getJwtFromRequest,
  readAuthCookieHeader,
  cookieBaseOptions,
  usesCrossSiteSessionCookies,
  validateCookieSecurity,
};
