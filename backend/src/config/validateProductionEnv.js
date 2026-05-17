'use strict';

/**
 * Production-only startup checks. OpenAI keys are not validated here: reviews use snapshot + static rules
 * (`getReviewAiRuntimeInfo().usesOpenAiApi === false`); add env checks if you enable paid LLM calls later.
 */

const { logger } = require('../utils/logger');
const { validateTokenEncryptionKey } = require('../utils/tokenCrypto');
const { validateCookieSecurity } = require('../utils/authCookie');

const FORBIDDEN_CLIENT_SERVICE_ROLE_ENV = [
  'VITE_SUPABASE_SERVICE_KEY',
  'NEXT_PUBLIC_SUPABASE_SERVICE_KEY',
  'PUBLIC_SUPABASE_SERVICE_KEY',
];

function looksPlaceholder(value) {
  if (value == null || typeof value !== 'string') return true;
  const t = value.trim().toLowerCase();
  if (!t) return true;
  if (t.includes('your_github') || t.includes('your-supabase') || t === 'changeme') return true;
  if (t.includes('example') && t.includes('oauth')) return true;
  if (t.includes('your-ngrok') || t.includes('your-backend')) return true;
  return false;
}

function validateSupabaseUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return 'SUPABASE_URL must use https in production';
  } catch {
    return 'SUPABASE_URL is not a valid absolute URL';
  }
  return null;
}

function isLocalhostHostname(hostname) {
  const h = String(hostname || '').toLowerCase();
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '::1' ||
    h.endsWith('.localhost') ||
    h.endsWith('.local')
  );
}

/**
 * @param {string} url
 * @returns {string|null} error message or null if valid
 */
function validateBackendUrl(url) {
  const raw = (url || '').trim().replace(/\/+$/, '');
  if (!raw || looksPlaceholder(raw)) {
    return 'BACKEND_URL must be set to your public HTTPS API base URL in production (no trailing slash).';
  }
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return 'BACKEND_URL is not a valid absolute URL.';
  }
  if (parsed.protocol !== 'https:') {
    return 'BACKEND_URL must use https in production (GitHub webhook delivery requires a public HTTPS endpoint).';
  }
  if (isLocalhostHostname(parsed.hostname)) {
    return 'BACKEND_URL must not use localhost, 127.0.0.1, or .local hostnames in production.';
  }
  return null;
}

/**
 * @returns {string[]} error messages
 */
function validateNoClientExposedServiceRoleKeys() {
  const errors = [];
  for (const key of FORBIDDEN_CLIENT_SERVICE_ROLE_ENV) {
    if (process.env[key]) {
      errors.push(
        `${key} must not be set in the API process — Supabase service role belongs in backend secrets only (SUPABASE_SERVICE_KEY).`
      );
    }
  }
  return errors;
}

/**
 * Fail fast on misconfiguration in production. Development stays permissive so local / partial setups work.
 * Does not replace `database.js` checks for Supabase — those still run when the DB module loads.
 */
function validateProductionEnvironment() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  if (nodeEnv === 'test') return;

  const cookieErr = validateCookieSecurity();
  if (cookieErr && nodeEnv === 'production') {
    logger.error(`[env] ${cookieErr}`);
    process.exit(1);
  }
  if (cookieErr && nodeEnv !== 'production') {
    logger.warn(`[env] ${cookieErr}`);
  }

  const clientKeyErrors = validateNoClientExposedServiceRoleKeys();
  if (clientKeyErrors.length) {
    clientKeyErrors.forEach((msg) => logger.error(`[env] ${msg}`));
    process.exit(1);
  }

  if (nodeEnv !== 'production') {
    const jwt = process.env.JWT_SECRET;
    if (!jwt || jwt.length < 32) {
      logger.warn(
        '[env] JWT_SECRET should be at least 32 characters before production deploy (required for OAuth state signing and JWTs).'
      );
    }
    const encKey = validateTokenEncryptionKey();
    if (encKey) {
      logger.warn(`[env] ${encKey.replace(' in production', ' before production deploy')}`);
    }
    return;
  }

  const errors = [];

  const jwt = process.env.JWT_SECRET;
  if (!jwt || jwt.length < 32) {
    errors.push('JWT_SECRET must be set and at least 32 characters in production.');
  }

  const encErr = validateTokenEncryptionKey();
  if (encErr) errors.push(encErr);

  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl || looksPlaceholder(supabaseUrl)) {
    errors.push('SUPABASE_URL must be set to your Supabase project URL in production.');
  } else {
    const urlErr = validateSupabaseUrl(supabaseUrl.trim());
    if (urlErr) errors.push(urlErr);
  }

  const svc = process.env.SUPABASE_SERVICE_KEY;
  if (!svc || svc.length < 20) {
    errors.push('SUPABASE_SERVICE_KEY must be set (service role key) in production.');
  }

  if (!process.env.GITHUB_CLIENT_ID || looksPlaceholder(process.env.GITHUB_CLIENT_ID)) {
    errors.push('GITHUB_CLIENT_ID must be set to your GitHub OAuth App client id in production.');
  }
  if (!process.env.GITHUB_CLIENT_SECRET || looksPlaceholder(process.env.GITHUB_CLIENT_SECRET)) {
    errors.push('GITHUB_CLIENT_SECRET must be set in production.');
  }

  const wh = process.env.GITHUB_WEBHOOK_SECRET;
  if (!wh || wh.length < 16) {
    errors.push(
      'GITHUB_WEBHOOK_SECRET must be set (16+ random characters) in production so webhook signatures can be verified.'
    );
  }

  const fe = (process.env.FRONTEND_URL || '').trim();
  if (!fe) {
    errors.push(
      'FRONTEND_URL must list at least one SPA origin in production (comma-separated). Used for CORS, Socket.IO, and OAuth redirect_uri validation.'
    );
  }

  const backendErr = validateBackendUrl(process.env.BACKEND_URL);
  if (backendErr) errors.push(backendErr);

  if (process.env.QUEUE_DRIVER !== 'redis') {
    errors.push(
      'QUEUE_DRIVER must be "redis" in production so review jobs survive restarts and support multiple API instances.'
    );
  }

  const redisUrl = (process.env.REDIS_URL || '').trim();
  if (!redisUrl || looksPlaceholder(redisUrl)) {
    errors.push('REDIS_URL must be set in production when QUEUE_DRIVER=redis.');
  }

  if (cookieErr) errors.push(cookieErr);

  errors.push(...validateNoClientExposedServiceRoleKeys());

  if (errors.length) {
    errors.forEach((msg) => logger.error(`[env] ${msg}`));
    logger.error(
      `[env] Fix ${errors.length} production configuration error(s) above — process exiting so the API does not start half-configured.`
    );
    process.exit(1);
  }

  logger.info('[env] Production environment validation passed.');
}

module.exports = {
  validateProductionEnvironment,
  validateBackendUrl,
  validateTokenEncryptionKey,
  validateNoClientExposedServiceRoleKeys,
  looksPlaceholder,
  FORBIDDEN_CLIENT_SERVICE_ROLE_ENV,
};
