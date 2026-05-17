require('dotenv').config();
const { validateProductionEnvironment } = require('./config/validateProductionEnv');
validateProductionEnvironment();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const { createServer } = require('http');
const { Server } = require('socket.io');

const { logger } = require('./utils/logger');
const { isAllowedFrontendOrigin, parseCommaOrigins } = require('./utils/frontendOrigins');

process.on('unhandledRejection', (reason) => {
  const msg = reason instanceof Error ? reason.stack : String(reason);
  logger.error(`Unhandled promise rejection: ${msg}`);
});
const { errorHandler } = require('./middleware/errorHandler');
const { rateLimiter } = require('./middleware/rateLimiter');
const authRoutes = require('./routes/auth');
const repoRoutes = require('./routes/repos');
const reviewRoutes = require('./routes/reviews');
const reportRoutes = require('./routes/reports');
const webhookRoutes = require('./routes/webhooks');
const { initializeWorker } = require('./services/queueWorker');
const { getReviewAiRuntimeInfo } = require('./services/openaiService');
const { registerSocketIO } = require('./socket/registerSocketIO');
const { buildHealthPayload } = require('./utils/healthPayload');

const app = express();
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}
const httpServer = createServer(app);

/** CORS / Socket.IO: allow non-browser probes (no Origin) and validated SPA origins only. */
function resolveCorsOrigin(origin, cb) {
  cb(
    null,
    isAllowedFrontendOrigin(origin || '', process.env.FRONTEND_URL, process.env.NODE_ENV)
  );
}

/** Best-effort production warnings (does not block startup). */
function logProductionDeploymentHints() {
  if (process.env.NODE_ENV !== 'production') return;

  const fe = parseCommaOrigins(process.env.FRONTEND_URL);
  if (!fe.length) logger.warn('[deploy] FRONTEND_URL is empty — CORS/socket may reject browsers.');

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    logger.warn('[deploy] JWT_SECRET should be at least 32 random characters in production.');
  }

  const { validateBackendUrl } = require('./config/validateProductionEnv');
  const backendErr = validateBackendUrl(process.env.BACKEND_URL);
  if (backendErr) {
    logger.warn(`[deploy] ${backendErr}`);
  }

  fe.forEach((entry) => {
    try {
      const u = new URL(entry.trim());
      if (u.hostname !== 'localhost' && u.hostname !== '127.0.0.1' && u.protocol === 'http:') {
        logger.warn(`[deploy] FRONTEND_URL entry uses http:// (${entry}) — use https in production.`);
      }
    } catch {
      /* ignore */
    }
  });
}

// ── WebSocket setup ──────────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: resolveCorsOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Attach io to app so controllers can emit events
app.set('io', io);

registerSocketIO(io);

// ── Core middleware ──────────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: resolveCorsOrigin,
    credentials: true,
  })
);

// Raw body parser for GitHub webhook signature verification — MUST come before json parser
app.use('/api/webhooks', express.raw({ type: 'application/json', limit: '1024kb' }));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: (msg) => logger.http(msg.trim()) } }));
app.use(rateLimiter);

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/repos', repoRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/webhooks', webhookRoutes);

app.get('/health', async (_req, res) => {
  try {
    const body = await buildHealthPayload();
    res.status(200).json(body);
  } catch (e) {
    logger.warn(`Health check unexpected error: ${e?.message || e}`);
    res.status(200).json({
      status: 'degraded',
      timestamp: new Date().toISOString(),
      reviewAi: getReviewAiRuntimeInfo(),
      database: { reachable: false, error: 'health_handler_failed' },
    });
  }
});

// JSON 404 for unknown routes (Express default is plain HTML)
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

// ── Error handling ───────────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    logger.error(`Port ${PORT} is already in use — stop the other process or set PORT to a free port.`);
    process.exit(1);
  }
  throw err;
});

const { warnIfRedisPersistenceMissing } = require('./config/redisPersistenceCheck');
const { closeReviewQueue } = require('./services/reviewQueue');

function startServer() {
  httpServer.listen(PORT, () => {
    logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    logProductionDeploymentHints();
    initializeWorker(io);
    void warnIfRedisPersistenceMissing();

    const base = (process.env.BACKEND_URL || '').replace(/\/+$/, '');
    const hasSecret = !!process.env.GITHUB_WEBHOOK_SECRET;
    if (!base || base.includes('your-backend') || !hasSecret) {
      logger.warn(
        '┌─ GitHub webhooks (auto-review on push) ─────────────────────────────────────'
      );
      logger.warn(
        '│ Set BACKEND_URL to a PUBLIC https URL (use ngrok: npx ngrok http ' +
          PORT +
          ').'
      );
      logger.warn('│ Set GITHUB_WEBHOOK_SECRET to a long random string (same when you reconnect).');
      logger.warn(
        '│ Then in the app: disconnect repo → connect again → push code. Details: WEBHOOK_QUICKSTART.md'
      );
      logger.warn(
        '└──────────────────────────────────────────────────────────────────────────────'
      );
    } else {
      logger.info(`Webhooks exposed at: ${base}/api/webhooks/github`);
    }
  });
}

if (require.main === module) {
  startServer();
}

/**
 * Graceful shutdown for tests and process managers.
 */
async function closeHttpServer() {
  await closeReviewQueue();
  return new Promise((resolve, reject) => {
    io.close();
    if (!httpServer.listening) {
      resolve();
      return;
    }
    httpServer.close((err) => (err ? reject(err) : resolve()));
  });
}

module.exports = { app, httpServer, io, startServer, closeHttpServer };
