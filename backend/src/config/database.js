/**
 * Backend-only Supabase client (service role). Never import this module from the frontend or
 * expose SUPABASE_SERVICE_KEY via VITE_* / NEXT_PUBLIC_* env vars — it bypasses Row Level Security.
 */
const { createClient } = require('@supabase/supabase-js');
const { logger } = require('../utils/logger');

/**
 * SUPABASE_URL must be the project base only, e.g. https://xxxxx.supabase.co
 * (no trailing slash). If `/rest/v1` is pasted in, requests become
 * .../rest/v1/rest/v1/... → PostgREST PGRST125 "Invalid path".
 */
function normalizeSupabaseUrl(raw) {
  if (!raw || typeof raw !== 'string') return raw;
  let url = raw.trim().replace(/\/+$/, '');
  while (/\/rest\/v1$/i.test(url)) {
    url = url.replace(/\/rest\/v1$/i, '');
  }
  return url.replace(/\/+$/, '');
}

// Validate required env vars at startup
const requiredVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
requiredVars.forEach((v) => {
  if (!process.env[v]) {
    logger.error(`Missing required environment variable: ${v}`);
    process.exit(1);
  }
});

const rawUrl = process.env.SUPABASE_URL;
const supabaseUrl = normalizeSupabaseUrl(rawUrl);
if (rawUrl !== supabaseUrl) {
  logger.warn('SUPABASE_URL was normalized — use the project URL only (https://*.supabase.co), not …/rest/v1');
}

const supabase = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  }
);

module.exports = { supabase };
