/**
 * Repository connection flows: list, GitHub picker, connect, disconnect, webhook sync.
 */
const { AppError } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');
const { getGithubAccessTokenForUser } = require('./userTokenService');
const reposRepository = require('../repositories/reposRepository');
const { createOctokit, installGithubPushWebhook } = require('./githubWebhookService');
const { deleteReportsForRepository } = require('./reportGeneratorService');

async function requireGithubToken(userId) {
  const token = await getGithubAccessTokenForUser(userId);
  if (!token) {
    throw new AppError('GitHub access token not found — please log in again', 401);
  }
  return token;
}

async function listConnectedRepos(userId) {
  const { data, error } = await reposRepository.listConnectedWithReviewsForUser(userId);
  if (error) throw new AppError('Failed to fetch repositories', 500);
  return data || [];
}

async function listGithubReposPreview(userId) {
  const token = await requireGithubToken(userId);
  const octokit = createOctokit(token);
  const { data: repos } = await octokit.repos.listForAuthenticatedUser({
    sort: 'updated',
    per_page: 100,
  });

  return repos.map((r) => ({
    githubRepoId: r.id,
    fullName: r.full_name,
    name: r.name,
    description: r.description,
    language: r.language,
    isPrivate: r.private,
    updatedAt: r.updated_at,
  }));
}

async function connectRepository(userId, body) {
  const { githubRepoId, fullName, name, description, language, isPrivate } = body;

  if (!fullName || typeof fullName !== 'string' || !fullName.includes('/')) {
    throw new AppError('Invalid fullName — expected "owner/repo" format', 400);
  }

  const { data: existing } = await reposRepository.findIdByGithubRepoIdForUser(githubRepoId, userId);
  if (existing) throw new AppError('Repository already connected', 409);

  const token = await requireGithubToken(userId);
  const octokit = createOctokit(token);
  const { webhookId } = await installGithubPushWebhook(octokit, fullName, { previousHookId: null });

  const { data: newRepo, error } = await reposRepository.insertRepository({
    user_id: userId,
    github_repo_id: githubRepoId,
    full_name: fullName,
    name,
    description,
    language,
    is_private: isPrivate,
    webhook_id: webhookId,
    webhook_active: !!webhookId,
  });

  if (error) throw new AppError('Failed to save repository', 500);
  return newRepo;
}

async function disconnectRepository(userId, repositoryId) {
  const { data: repo, error } = await reposRepository.findByIdAndUserId(repositoryId, userId);

  if (error || !repo) throw new AppError('Repository not found', 404);

  try {
    await deleteReportsForRepository(repositoryId);
  } catch (e) {
    logger.error(`[repos] delete analysis reports for ${repositoryId}: ${e.message}`);
    throw new AppError('Could not remove analysis reports for this repository', 500);
  }

  // DB: code_reviews CASCADE from repositories; reports removed explicitly above (and via FK when present).
  const { error: delErr } = await reposRepository.deleteById(repositoryId);
  if (delErr) {
    logger.error(`[repos] delete repository ${repositoryId}:`, delErr);
    throw new AppError(`Could not disconnect repository: ${delErr.message}`, 500);
  }

  // GitHub webhook removal can take seconds (TLS + API latency). Do not block the client; best-effort cleanup.
  if (repo.webhook_id) {
    const fullName = repo.full_name;
    const hookId = repo.webhook_id;
    void (async () => {
      try {
        const token = await requireGithubToken(userId);
        const octokit = createOctokit(token);
        const [owner, repoName] = fullName.split('/');
        await octokit.repos.deleteWebhook({ owner, repo: repoName, hook_id: hookId });
      } catch (e) {
        logger.warn(`[repos] async webhook delete hook ${hookId} for ${fullName}: ${e.message}`);
      }
    })();
  }
}

async function syncWebhook(userId, repositoryId) {
  const { data: repo, error } = await reposRepository.findByIdAndUserId(repositoryId, userId);

  if (error || !repo) throw new AppError('Repository not found', 404);

  const token = await requireGithubToken(userId);
  const octokit = createOctokit(token);

  const { webhookId, reason } = await installGithubPushWebhook(octokit, repo.full_name, {
    previousHookId: repo.webhook_id || null,
  });

  const { data: updated, error: updErr } = await reposRepository.updateByIdForUser(repositoryId, userId, {
    webhook_id: webhookId,
    webhook_active: !!webhookId,
  });

  if (updErr) throw new AppError('Could not update repository', 500);

  if (!webhookId) {
    throw new AppError(
      reason ||
        'Could not register GitHub webhook. Check BACKEND_URL (public HTTPS, ngrok running), GITHUB_WEBHOOK_SECRET, and GitHub permissions.',
      422
    );
  }

  return updated;
}

async function listRepoBranches(userId, repositoryId) {
  const { data: repo, error } = await reposRepository.findByIdAndUserId(repositoryId, userId);

  if (error || !repo) throw new AppError('Repository not found', 404);

  const token = await requireGithubToken(userId);
  const octokit = createOctokit(token);
  const [owner, repoName] = repo.full_name.split('/');

  const { data: remote } = await octokit.repos.get({ owner, repo: repoName });
  const { data: branchRows } = await octokit.repos.listBranches({
    owner,
    repo: repoName,
    per_page: 100,
  });

  return {
    defaultBranch: remote.default_branch,
    branches: branchRows.map((b) => b.name),
  };
}

module.exports = {
  listConnectedRepos,
  listGithubReposPreview,
  connectRepository,
  disconnectRepository,
  syncWebhook,
  listRepoBranches,
};
