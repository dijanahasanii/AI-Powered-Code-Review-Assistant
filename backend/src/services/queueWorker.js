const { logger } = require('../utils/logger');
const { useInlineJobQueue } = require('./queueConfig');
const { setSocketIo, attachBullProcessor } = require('./reviewJobProcessor');

/**
 * Wire Socket.io and start workers. In development, jobs run inline (no Redis).
 */
const initializeWorker = (io) => {
  setSocketIo(io);

  if (useInlineJobQueue()) {
    logger.info('Review jobs: in-process (no Redis). Set QUEUE_DRIVER=redis to use Bull.');
    return;
  }

  attachBullProcessor();
  logger.info('Review jobs: Bull + Redis (QUEUE_DRIVER=redis)');
};

module.exports = { initializeWorker };
