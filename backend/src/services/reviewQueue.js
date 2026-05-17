const Bull = require('bull');
const { logger } = require('../utils/logger');
const { useInlineJobQueue } = require('./queueConfig');

let reviewQueue = null;

if (!useInlineJobQueue()) {
  reviewQueue = new Bull('code-reviews', {
    redis: process.env.REDIS_URL || 'redis://localhost:6379',
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  });

  reviewQueue.on('error', (err) => {
    logger.error('Queue error:', err);
  });

  reviewQueue.on('failed', (job, err) => {
    logger.error(`Job ${job.id} failed: ${err.message}`);
  });
}

/**
 * Enqueue an AI review. In-process unless QUEUE_DRIVER=redis.
 */
async function enqueueAnalyzeJob(data) {
  if (useInlineJobQueue()) {
    const { runAnalyzeJob } = require('./reviewJobProcessor');
    logger.debug('Running inline analyze job', {
      reviewId: data?.reviewId,
      repositoryId: data?.repositoryId,
    });
    void Promise.resolve()
      .then(() => runAnalyzeJob(data, { rethrowOnError: false }))
      .catch((err) => {
        logger.error(`Inline analyze job failed: ${err.message}`, {
          reviewId: data?.reviewId,
          repositoryId: data?.repositoryId,
          stack: err?.stack,
        });
      });
    return;
  }

  const job = await reviewQueue.add('analyze', data);
  logger.info('Queued Bull analyze job', {
    jobId: job?.id,
    reviewId: data?.reviewId,
    repositoryId: data?.repositoryId,
  });
}

async function closeReviewQueue() {
  if (reviewQueue) {
    await reviewQueue.close();
  }
}

module.exports = { reviewQueue, enqueueAnalyzeJob, closeReviewQueue };
