/**
 * GitHub REST helpers for repository webhooks (no Express).
 */
const { Octokit } = require('@octokit/rest');
const { AppError } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');

function createOctokit(accessToken) {
  if (!accessToken || typeof accessToken !== 'string') {
    throw new AppError('No GitHub access token available — sign in again', 401);
  }
  return new Octokit({ auth: accessToken });
}

/**
 * Turn Octokit webhook errors into something users can act on (404 is often "wrong account / no admin").
 */
function formatWebhookFailureMessage(fullName, err) {
  const status = err?.status;
  const raw = typeof err?.message === 'string' ? err.message : String(err);

  if (status === 404) {
    return (
      `GitHub returned 404 for "${fullName}". Usually: the repo was renamed/deleted, or your logged-in GitHub user ` +
      `cannot administer webhooks there (need owner or admin — collaborators without admin cannot install hooks). ` +
      `Disconnect repos you only have read access to (e.g. a coworker's repo) and use "Install webhook" on repos you control.`
    );
  }
  if (status === 403) {
    return `GitHub denied webhook access for "${fullName}". You need admin rights on that repository. ${raw}`;
  }
  return raw.replace(/\s+-\s+https:\/\/docs\.github\.com\/[^\s]+$/i, '').trim() || raw;
}

/**
 * Register push/PR webhook on GitHub for this repo URL.
 * Optionally removes a previous hook id (stale tunnel / reconnect).
 * @returns {{ webhookId: number|null, reason?: string }}
 */
async function installGithubPushWebhook(octokit, fullName, { previousHookId } = {}) {
  const backendBase = (process.env.BACKEND_URL || '').replace(/\/+$/, '');
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  const [owner, repoName] = fullName.split('/');

  if (!backendBase || backendBase.includes('your-backend')) {
    logger.warn(
      '[repos] BACKEND_URL missing or placeholder — webhook not registered. Use a PUBLIC https URL (e.g. ngrok).'
    );
    return { webhookId: null, reason: 'BACKEND_URL is not set or is still a placeholder' };
  }
  if (!secret) {
    logger.warn('[repos] GITHUB_WEBHOOK_SECRET missing — webhook not registered.');
    return { webhookId: null, reason: 'GITHUB_WEBHOOK_SECRET is not set in backend/.env' };
  }

  if (previousHookId) {
    try {
      await octokit.repos.deleteWebhook({ owner, repo: repoName, hook_id: previousHookId });
      logger.info(`[repos] Removed previous webhook ${previousHookId} on ${fullName}`);
    } catch (e) {
      logger.warn(`[repos] Could not remove webhook ${previousHookId}: ${e.message}`);
    }
  }

  try {
    const { data: hook } = await octokit.repos.createWebhook({
      owner,
      repo: repoName,
      config: {
        url: `${backendBase}/api/webhooks/github`,
        content_type: 'json',
        secret,
      },
      events: ['push', 'pull_request'],
      active: true,
    });
    logger.info(`Webhook installed on ${fullName}: ${backendBase}/api/webhooks/github`);
    return { webhookId: hook.id };
  } catch (hookErr) {
    const reason = formatWebhookFailureMessage(fullName, hookErr);
    logger.warn(`Could not install webhook for ${fullName}: ${reason}`);
    return { webhookId: null, reason };
  }
}

module.exports = {
  createOctokit,
  formatWebhookFailureMessage,
  installGithubPushWebhook,
};
