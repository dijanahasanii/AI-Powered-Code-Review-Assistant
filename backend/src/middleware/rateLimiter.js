const rateLimit = require('express-rate-limit');

const isProduction = process.env.NODE_ENV === 'production';

/** Dev: generous limits for HMR, React Query refetch, and rapid UI iteration. Prod: tighter defaults unless env overrides. */
const defaultRateLimitWindowMs = isProduction ? 15 * 60 * 1000 : 30 * 60 * 1000;
const defaultRateLimitMax = isProduction ? 100 : 10_000;

/** GitHub webhook delivery bursts must not consume the global quota (would drop pushes). Health probes must remain cheap. */
const skipWebhookAndProbeTraffic = (req) => {
  const path = String(req.originalUrl || req.url || '');
  return path.startsWith('/api/webhooks') || path === '/health' || path.startsWith('/health?');
};

const rateLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || defaultRateLimitWindowMs,
  max: Number(process.env.RATE_LIMIT_MAX) || defaultRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
  skip: skipWebhookAndProbeTraffic,
});

/** Applied on /api/auth/github, /github/callback, and /logout only (see routes/auth.js). */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many auth attempts, please try again later.' },
});

module.exports = { rateLimiter, authLimiter };
