const { Octokit } = require('@octokit/rest');
const { supabase } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');

const getOctokit = (accessToken) => {
  if (!accessToken || typeof accessToken !== 'string') {
    throw new AppError('No GitHub access token available — sign in again', 401);
  }
  return new Octokit({ auth: accessToken });
};

const getUserToken = async (userId) => {
  const { data: userRecord, error } = await supabase
    .from('users')
    .select('access_token')
    .eq('id', userId)
    .single();

  if (error || !userRecord?.access_token) {
    throw new AppError('GitHub access token not found — please log in again', 401);
  }
  return userRecord.access_token;
};

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

/**
 * GET /api/repos
 * List repositories the user has connected
 */
const listRepos = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('repositories')
      .select(`
        id, full_name, name, description, language,
        is_private, webhook_active, created_at,
        code_reviews(id, status, overall_score, created_at)
      `)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .order('created_at', { foreignTable: 'code_reviews', ascending: false });

    if (error) throw new AppError('Failed to fetch repositories', 500);

    res.json({ success: true, data: data || [] });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/repos/github
 * List GitHub repos available to connect (from GitHub API)
 */
const listGithubRepos = async (req, res, next) => {
  try {
    // Fetch fresh token from DB
    const token = await getUserToken(req.user.id);
    const octokit = getOctokit(token);
    const { data: repos } = await octokit.repos.listForAuthenticatedUser({
      sort: 'updated',
      per_page: 100,
    });

    res.json({
      success: true,
      data: repos.map((r) => ({
        githubRepoId: r.id,
        fullName: r.full_name,
        name: r.name,
        description: r.description,
        language: r.language,
        isPrivate: r.private,
        updatedAt: r.updated_at,
      })),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/repos
 * Connect a GitHub repo — creates DB record + installs webhook
 */
const connectRepo = async (req, res, next) => {
  try {
    const { githubRepoId, fullName, name, description, language, isPrivate } = req.body;

    if (!fullName || typeof fullName !== 'string' || !fullName.includes('/')) {
      throw new AppError('Invalid fullName — expected "owner/repo" format', 400);
    }

    // Check not already connected
    const { data: existing } = await supabase
      .from('repositories')
      .select('id')
      .eq('github_repo_id', githubRepoId)
      .eq('user_id', req.user.id)
      .single();

    if (existing) throw new AppError('Repository already connected', 409);

    const token = await getUserToken(req.user.id);
    const octokit = getOctokit(token);
    const { webhookId } = await installGithubPushWebhook(octokit, fullName, { previousHookId: null });

    // Save to database
    const { data: newRepo, error } = await supabase
      .from('repositories')
      .insert({
        user_id: req.user.id,
        github_repo_id: githubRepoId,
        full_name: fullName,
        name,
        description,
        language,
        is_private: isPrivate,
        webhook_id: webhookId,
        webhook_active: !!webhookId,
      })
      .select()
      .single();

    if (error) throw new AppError('Failed to save repository', 500);

    res.status(201).json({ success: true, data: newRepo });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/repos/:id
 * Disconnect a repo — removes webhook + DB record
 */
const disconnectRepo = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: repo, error } = await supabase
      .from('repositories')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (error || !repo) throw new AppError('Repository not found', 404);

    // Remove GitHub webhook (best-effort — still remove DB row if GitHub 404)
    if (repo.webhook_id) {
      const token = await getUserToken(req.user.id);
      const octokit = getOctokit(token);
      const [owner, repoName] = repo.full_name.split('/');
      try {
        await octokit.repos.deleteWebhook({ owner, repo: repoName, hook_id: repo.webhook_id });
      } catch (e) {
        logger.warn(`Could not delete webhook ${repo.webhook_id}: ${e.message}`);
      }
    }

    // Remove reviews first (handles DBs missing ON DELETE CASCADE on older migrations)
    const { error: revDelErr } = await supabase.from('code_reviews').delete().eq('repository_id', id);
    if (revDelErr) {
      logger.error(`[repos] delete code_reviews for repo ${id}:`, revDelErr);
      throw new AppError(`Could not remove reviews for this repository: ${revDelErr.message}`, 500);
    }

    const { error: delErr } = await supabase.from('repositories').delete().eq('id', id);
    if (delErr) {
      logger.error(`[repos] delete repository ${id}:`, delErr);
      throw new AppError(`Could not disconnect repository: ${delErr.message}`, 500);
    }

    res.json({ success: true, message: 'Repository disconnected' });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/repos/:id/sync-webhook
 * Re-install GitHub webhook from current BACKEND_URL (no disconnect).
 */
const syncRepoWebhook = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: repo, error } = await supabase
      .from('repositories')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (error || !repo) throw new AppError('Repository not found', 404);

    const token = await getUserToken(req.user.id);
    const octokit = getOctokit(token);

    const { webhookId, reason } = await installGithubPushWebhook(octokit, repo.full_name, {
      previousHookId: repo.webhook_id || null,
    });

    const { data: updated, error: updErr } = await supabase
      .from('repositories')
      .update({
        webhook_id: webhookId,
        webhook_active: !!webhookId,
      })
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select('id, full_name, webhook_id, webhook_active')
      .single();

    if (updErr) throw new AppError('Could not update repository', 500);

    if (!webhookId) {
      throw new AppError(
        reason ||
          'Could not register GitHub webhook. Check BACKEND_URL (public HTTPS, ngrok running), GITHUB_WEBHOOK_SECRET, and GitHub permissions.',
        422
      );
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

module.exports = { listRepos, listGithubRepos, connectRepo, disconnectRepo, syncRepoWebhook };
