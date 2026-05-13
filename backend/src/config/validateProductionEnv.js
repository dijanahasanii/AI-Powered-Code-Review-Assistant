'use strict';

/**
 * Production-only startup checks. OpenAI keys are not validated here: reviews use snapshot + static rules
 * (`getReviewAiRuntimeInfo().usesOpenAiApi === false`); add env checks if you enable paid LLM calls later.
 */

const { logger } = require('../utils/logger');

function looksPlaceholder(value) {
  if (value == null || typeof value !== 'string') return true;
  const t = value.trim().toLowerCase();
  if (!t) return true;
  if (t.includes('your_github') || t.includes('your-supabase') || t === 'changeme') return true;
  if (t.includes('example') && t.includes('oauth')) return true;
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

/**
 * Fail fast on misconfiguration in production. Development stays permissive so local / partial setups work.
 * Does not replace `database.js` checks for Supabase — those still run when the DB module loads.
 */
function validateProductionEnvironment() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  if (nodeEnv === 'test') return;

  if (nodeEnv !== 'production') {
    const jwt = process.env.JWT_SECRET;
    if (!jwt || jwt.length < 32) {
      logger.warn(
        '[env] JWT_SECRET should be at least 32 characters before production deploy (required for OAuth state signing and JWTs).'
      );
    }
    return;
  }

  const errors = [];

  const jwt = process.env.JWT_SECRET;
  if (!jwt || jwt.length < 32) {
    errors.push('JWT_SECRET must be set and at least 32 characters in production.');
  }

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

  if (errors.length) {
    errors.forEach((msg) => logger.error(`[env] ${msg}`));
    logger.error(
      `[env] Fix ${errors.length} production configuration error(s) above — process exiting so the API does not start half-configured.`
    );
    process.exit(1);
  }

  logger.info('[env] Production environment validation passed.');
}

module.exports = { validateProductionEnvironment };
