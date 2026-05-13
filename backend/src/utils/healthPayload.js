'use strict';

const { supabase } = require('../config/database');
const { getReviewAiRuntimeInfo } = require('../services/openaiService');

const DB_HEALTH_TIMEOUT_MS = 1200;

/**
 * GET /health payload — extends existing fields with optional `database` reachability (non-breaking for clients that ignore unknown keys).
 */
async function buildHealthPayload() {
  const payload = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    reviewAi: getReviewAiRuntimeInfo(),
  };

  const started = Date.now();
  try {
    const query = supabase.from('users').select('id').limit(1).maybeSingle();
    const result = await Promise.race([
      query,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), DB_HEALTH_TIMEOUT_MS)),
    ]);
    const latencyMs = Date.now() - started;
    if (result?.error) {
      payload.status = 'degraded';
      payload.database = {
        reachable: false,
        latencyMs,
        code: result.error.code || 'unknown',
      };
    } else {
      payload.database = { reachable: true, latencyMs };
    }
  } catch {
    payload.status = 'degraded';
    payload.database = {
      reachable: false,
      error: 'unavailable_or_timeout',
    };
  }

  return payload;
}

module.exports = { buildHealthPayload };
