'use strict';

const Redis = require('ioredis');
const { logger } = require('../utils/logger');
const { useInlineJobQueue } = require('../services/queueConfig');

const PERSISTENCE_WARNING =
  'Redis persistence not detected. Jobs may be lost after restart.';

/**
 * Best-effort AOF/RDB check when Bull queue uses Redis. Does not block startup.
 */
async function warnIfRedisPersistenceMissing() {
  if (useInlineJobQueue()) return;

  const url = (process.env.REDIS_URL || 'redis://localhost:6379').trim();
  const redis = new Redis(url, {
    maxRetriesPerRequest: 1,
    connectTimeout: 4000,
    lazyConnect: true,
  });

  try {
    await redis.connect();
    const appendonly = await redis.config('GET', 'appendonly');
    const save = await redis.config('GET', 'save');

    const aofOn = appendonly && appendonly[1] === 'yes';
    const saveOn = save && save[1] != null && String(save[1]).trim() !== '';

    if (!aofOn && !saveOn) {
      logger.warn(`[redis] ${PERSISTENCE_WARNING}`);
      logger.warn(
        '[redis] Recommended: enable AOF (`appendonly yes`) or RDB snapshots (`save` directives) in redis.conf.'
      );
    }
  } catch (err) {
    logger.warn(`[redis] Could not verify persistence settings: ${err.message}`);
    logger.warn(`[redis] ${PERSISTENCE_WARNING}`);
  } finally {
    try {
      redis.disconnect();
    } catch {
      /* ignore */
    }
  }
}

module.exports = { warnIfRedisPersistenceMissing, PERSISTENCE_WARNING };
