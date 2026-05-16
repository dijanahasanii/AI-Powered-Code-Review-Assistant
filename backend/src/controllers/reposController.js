const {
  listConnectedRepos,
  listGithubReposPreview,
  connectRepository,
  disconnectRepository,
  syncWebhook,
  listRepoBranches,
} = require('../services/reposService');

/**
 * GET /api/repos
 * List repositories the user has connected
 */
const listRepos = async (req, res, next) => {
  try {
    const data = await listConnectedRepos(req.user.id);
    res.json({ success: true, data });
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
    const data = await listGithubReposPreview(req.user.id);
    res.json({ success: true, data });
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
    const newRepo = await connectRepository(req.user.id, req.body);
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
    await disconnectRepository(req.user.id, id);
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
    const updated = await syncWebhook(req.user.id, id);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/repos/:id/branches
 * Branch names for manual review picker (first 100 from GitHub).
 */
const listBranches = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = await listRepoBranches(req.user.id, id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listRepos,
  listGithubRepos,
  connectRepo,
  disconnectRepo,
  syncRepoWebhook,
  listBranches,
};
