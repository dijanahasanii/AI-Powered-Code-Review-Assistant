const rateLimit = require('express-rate-limit');

/** GitHub webhook delivery bursts must not consume the global quota (would drop pushes). Health probes must remain cheap. */
const skipWebhookAndProbeTraffic = (req) => {
  const path = String(req.originalUrl || req.url || '');
  return path.startsWith('/api/webhooks') || path === '/health' || path.startsWith('/health?');
};

const rateLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 min
  max: Number(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
  skip: skipWebhookAndProbeTraffic,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, error: 'Too many auth attempts, please try again later.' },
});

module.exports = { rateLimiter, authLimiter };
