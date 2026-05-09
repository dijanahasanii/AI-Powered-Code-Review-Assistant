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

    // Install GitHub webhook
    const token = await getUserToken(req.user.id);
    const octokit = getOctokit(token);
    const [owner, repo] = fullName.split('/');

    let webhookId = null;
    const backendBase = (process.env.BACKEND_URL || '').replace(/\/+$/, '');
    const secret = process.env.GITHUB_WEBHOOK_SECRET;

    if (!backendBase || backendBase.includes('your-backend')) {
      logger.warn(
        `[repos] BACKEND_URL is missing or placeholder — webhook not registered. Add a PUBLIC HTTPS URL (e.g. ngrok) to .env, then reconnect the repo.`
      );
    } else if (!secret) {
      logger.warn('[repos] GITHUB_WEBHOOK_SECRET missing — webhook not registered.');
    } else {
      try {
        const { data: hook } = await octokit.repos.createWebhook({
          owner,
          repo,
          config: {
            url: `${backendBase}/api/webhooks/github`,
            content_type: 'json',
            secret,
          },
          events: ['push', 'pull_request'],
          active: true,
        });
        webhookId = hook.id;
        logger.info(`Webhook installed on ${fullName}: ${backendBase}/api/webhooks/github`);
      } catch (hookErr) {
        logger.warn(`Could not install webhook for ${fullName}: ${hookErr.message}`);
      }
    }

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

    // Remove GitHub webhook
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

    await supabase.from('repositories').delete().eq('id', id);

    res.json({ success: true, message: 'Repository disconnected' });
  } catch (err) {
    next(err);
  }
};

module.exports = { listRepos, listGithubRepos, connectRepo, disconnectRepo };
