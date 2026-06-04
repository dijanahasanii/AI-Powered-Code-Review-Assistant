const { logger } = require('../utils/logger');
const { useInlineJobQueue } = require('./queueConfig');
const {
  isAutoRemediationEnabled,
  AUTO_REMEDIATION_DISABLED_MESSAGE,
} = require('../lib/remediationFeatureFlag');

/**
 * Enqueue remediation (inline async by default, mirrors analyze queue pattern).
 */
async function enqueueRemediationJob(data) {
  if (!isAutoRemediationEnabled()) {
    const err = new Error(AUTO_REMEDIATION_DISABLED_MESSAGE);
    err.code = 'REMEDIATION_DISABLED';
    throw err;
  }

  const { runRemediation } = require('./remediationService');

  const run = () =>
    runRemediation(data).catch((err) => {
      logger.error(`Remediation job failed: ${err.message}`, {
        reportId: data?.reportId,
        stack: err?.stack,
      });
    });

  if (useInlineJobQueue()) {
    void Promise.resolve().then(run);
    return;
  }

  const { reviewQueue } = require('./reviewQueue');
  if (reviewQueue) {
    await reviewQueue.add('remediate', data);
    return;
  }

  void Promise.resolve().then(run);
}

module.exports = { enqueueRemediationJob };
