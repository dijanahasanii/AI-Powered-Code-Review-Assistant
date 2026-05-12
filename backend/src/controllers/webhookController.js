const crypto = require('crypto');
const { supabase } = require('../config/database');
const { enqueueAnalyzeJob } = require('../services/reviewQueue');
const { logger } = require('../utils/logger');

/**
 * Verify that the request genuinely came from GitHub
 * Uses HMAC-SHA256 of the raw body with the webhook secret
 */
const verifyGithubSignature = (rawBody, signatureHeader) => {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!signatureHeader || !secret) return false;

  const sigBuf = Buffer.from(signatureHeader);
  const expectedBuf = Buffer.from(
    `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`
  );

  // timingSafeEqual throws on length mismatch — treat as invalid
  if (sigBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expectedBuf);
};

/**
 * GET /api/webhooks/github — connectivity probe only. GitHub always POSTs webhook deliveries.
 */
const describeGithubWebhookEndpoint = (_req, res) => {
  res.status(200).json({
    ok: true,
    message: 'GitHub webhook receiver is active. Deliveries use POST with a JSON body and X-Hub-Signature-256.',
  });
};

/**
 * POST /api/webhooks/github
 * Receives push and pull_request events from GitHub
 */
const handleGithubWebhook = async (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  const event = req.headers['x-github-event'];
  const raw = req.body;
  if (!Buffer.isBuffer(raw) || raw.length === 0) {
    return res.status(400).json({ error: 'Empty body' });
  }

  // req.body is raw Buffer due to express.raw() in server.js
  if (!verifyGithubSignature(raw, signature)) {
    logger.warn('Invalid GitHub webhook signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Parse the raw body now that signature is verified
  let payload;
  try {
    payload = JSON.parse(raw.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  logger.info(`GitHub webhook received: event=${event}, repo=${payload.repository?.full_name}`);

  // Acknowledge immediately — GitHub expects < 10s response
  res.status(200).json({ received: true });

  setImmediate(() => {
    void (async () => {
      try {
        if (event === 'push') {
          await handlePushEvent(payload);
        } else if (
          event === 'pull_request' &&
          ['opened', 'synchronize', 'reopened'].includes(payload.action)
        ) {
          await handlePullRequestEvent(payload);
        }
      } catch (err) {
        logger.error(`Error processing webhook event=${event}: ${err.message}`, { stack: err.stack });
      }
    })();
  });
};

const handlePushEvent = async (payload) => {
  const { repository, head_commit, ref } = payload;

  if (!head_commit?.id) {
    logger.debug('Push event has no head_commit id (branch deletion?) — skipping');
    return;
  }
  if (!repository?.id) {
    logger.warn('Push event missing repository.id — skipping');
    return;
  }

  const { data: repo, error: repoErr } = await supabase
    .from('repositories')
    .select('id, user_id')
    .eq('github_repo_id', repository.id)
    .eq('webhook_active', true)
    .maybeSingle();

  if (repoErr) {
    logger.error(`DB error looking up repo ${repository.id}: ${repoErr.message}`);
    return;
  }
  if (!repo) {
    logger.debug(`No connected repo found for github_id=${repository.id}`);
    return;
  }

  const branch = ref.replace('refs/heads/', '');

  // Avoid duplicate reviews for the same commit
  const { data: existing } = await supabase
    .from('code_reviews')
    .select('id')
    .eq('repository_id', repo.id)
    .eq('commit_sha', head_commit.id)
    .maybeSingle();

  if (existing) {
    logger.debug(`Review already exists for commit ${head_commit.id}`);
    return;
  }

  // Create review record
  const { data: review, error: insErr } = await supabase
    .from('code_reviews')
    .insert({
      repository_id: repo.id,
      commit_sha: head_commit.id,
      branch,
      author: head_commit.author?.name,
      status: 'pending',
      triggered_by: 'webhook',
    })
    .select()
    .single();

  if (insErr || !review) {
    logger.error(`Webhook push: failed to insert review (${insErr?.code}) ${insErr?.message}`);
    return;
  }

  try {
    await enqueueAnalyzeJob({
      reviewId: review.id,
      repositoryId: repo.id,
      commitSha: head_commit.id,
      repoFullName: repository.full_name,
      userId: repo.user_id,
    });
    logger.info(`Queued analysis for commit ${head_commit.id} in ${repository.full_name}`);
  } catch (queueErr) {
    logger.error(`Failed to enqueue review job: ${queueErr.message}`);
  }
};

const handlePullRequestEvent = async (payload) => {
  const { repository, pull_request } = payload;

  if (!repository?.id || !pull_request?.head?.sha) {
    logger.warn('Pull request event missing required fields — skipping');
    return;
  }

  const { data: repo, error: repoErr } = await supabase
    .from('repositories')
    .select('id, user_id')
    .eq('github_repo_id', repository.id)
    .eq('webhook_active', true)
    .maybeSingle();

  if (repoErr) {
    logger.error(`DB error looking up repo for PR: ${repoErr.message}`);
    return;
  }
  if (!repo) return;

  const sha = pull_request.head.sha;
  const { data: dup } = await supabase
    .from('code_reviews')
    .select('id')
    .eq('repository_id', repo.id)
    .eq('commit_sha', sha)
    .maybeSingle();

  if (dup) {
    logger.debug(`Webhook PR: review exists for ${sha.slice(0, 7)}`);
    return;
  }

  const { data: review, error: insErr } = await supabase
    .from('code_reviews')
    .insert({
      repository_id: repo.id,
      commit_sha: sha,
      branch: pull_request.head.ref,
      pr_number: pull_request.number,
      author: pull_request.user?.login,
      status: 'pending',
      triggered_by: 'webhook',
    })
    .select()
    .single();

  if (insErr || !review) {
    logger.error(`Webhook PR: failed to insert review ${insErr?.message}`);
    return;
  }

  try {
    await enqueueAnalyzeJob({
      reviewId: review.id,
      repositoryId: repo.id,
      commitSha: pull_request.head.sha,
      repoFullName: repository.full_name,
      prNumber: pull_request.number,
      userId: repo.user_id,
    });
  } catch (queueErr) {
    logger.error(`Failed to enqueue PR review job: ${queueErr.message}`);
  }
};

module.exports = { handleGithubWebhook, describeGithubWebhookEndpoint };
