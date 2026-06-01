'use strict';

const crypto = require('crypto');
const { logger } = require('../utils/logger');

/** @type {Map<string, Promise<void>>} */
const inProcessTails = new Map();

/**
 * Serialize issue-tracking sync per repository within this Node process.
 * @param {string} repositoryId
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withInProcessRepositoryLock(repositoryId, fn) {
  const prev = inProcessTails.get(repositoryId) || Promise.resolve();
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  inProcessTails.set(
    repositoryId,
    prev.then(() => gate).catch(() => gate)
  );
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Distributed lock when Bull/Redis queue is enabled (multiple workers / API instances).
 * @param {string} repositoryId
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withRedisRepositoryLock(repositoryId, fn) {
  if (process.env.QUEUE_DRIVER !== 'redis') {
    return fn();
  }
  const url = (process.env.REDIS_URL || '').trim();
  if (!url) {
    return fn();
  }

  let Redis;
  try {
    Redis = require('ioredis');
  } catch {
    return fn();
  }

  const client = new Redis(url, {
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    lazyConnect: true,
  });

  const key = `acr:issue-sync:${repositoryId}`;
  const token = crypto.randomBytes(16).toString('hex');
  const ttlSec = 600;
  let acquired = false;

  try {
    await client.connect();
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const ok = await client.set(key, token, 'EX', ttlSec, 'NX');
      if (ok === 'OK') {
        acquired = true;
        break;
      }
      await sleep(500);
    }
    if (!acquired) {
      throw new Error(
        `Timed out waiting for repository issue sync lock (repository ${repositoryId})`
      );
    }
    return await fn();
  } finally {
    if (acquired) {
      try {
        await client.eval(
          "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
          1,
          key,
          token
        );
      } catch (err) {
        logger.warn(`[issue-sync] Redis lock release failed: ${err.message}`);
      }
    }
    try {
      client.disconnect();
    } catch {
      /* ignore */
    }
  }
}

/**
 * @param {string} repositoryId
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withRepositoryIssueSyncLock(repositoryId, fn) {
  return withInProcessRepositoryLock(repositoryId, () =>
    withRedisRepositoryLock(repositoryId, fn)
  );
}

module.exports = {
  withRepositoryIssueSyncLock,
  withInProcessRepositoryLock,
};
