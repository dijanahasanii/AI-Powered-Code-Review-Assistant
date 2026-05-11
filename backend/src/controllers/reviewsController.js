const { AppError } = require('../middleware/errorHandler');
const reviewsRepository = require('../repositories/reviewsRepository');
const reposRepository = require('../repositories/reposRepository');
const {
  enqueueManualReview,
  enqueueReviewForLatestCommitOnDefaultBranch,
  retryPendingOrFailedReview,
} = require('../services/reviewLifecycleService');
const { getDashboardReviewStats } = require('../services/reviewStatsService');

/**
 * GET /api/reviews?repoId=xxx&page=1&limit=10
 */
const listReviews = async (req, res, next) => {
  try {
    const { repoId, status, page = 1, limit = 10 } = req.query;
    const from = (Number(page) - 1) * Number(limit);
    const to = from + Number(limit) - 1;

    const { data, error, count } = await reviewsRepository.listReviewsForUser({
      userId: req.user.id,
      repoId,
      status,
      from,
      to,
    });

    if (error) throw new AppError('Failed to fetch reviews', 500);

    res.json({
      success: true,
      data,
      pagination: { page: Number(page), limit: Number(limit), total: count },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/reviews/:id  — full review with all issues
 */
const getReview = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: review, error } = await reviewsRepository.getReviewWithRelations(id);

    if (error || !review) throw new AppError('Review not found', 404);

    if (review.repositories.user_id !== req.user.id) {
      throw new AppError('Forbidden', 403);
    }

    res.json({ success: true, data: review });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/reviews/trigger
 * Manually trigger a review for a specific commit
 */
const triggerReview = async (req, res, next) => {
  try {
    const { repositoryId, commitSha, branch } = req.body;

    const { data: repo, error } = await reposRepository.findByIdAndUserId(repositoryId, req.user.id);

    if (error || !repo) throw new AppError('Repository not found', 404);

    const result = await enqueueManualReview({
      repositoryId,
      repo,
      userId: req.user.id,
      commitSha,
      branch,
    });

    res.status(202).json({
      success: true,
      data: result.review,
      meta: {
        reanalysis: result.reanalysis,
        duplicatePending: result.duplicatePending,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/reviews/trigger/latest
 * Queue a review for the latest commit on the repo default branch (GitHub API)
 */
const triggerLatestReview = async (req, res, next) => {
  try {
    const { repositoryId } = req.body;

    const result = await enqueueReviewForLatestCommitOnDefaultBranch({
      repositoryId,
      userId: req.user.id,
    });

    res.status(202).json({
      success: true,
      data: result.review,
      meta: {
        reanalysis: result.reanalysis,
        duplicatePending: result.duplicatePending,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/reviews/stats
 * Dashboard summary statistics
 */
const getStats = async (req, res, next) => {
  try {
    const data = await getDashboardReviewStats(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/reviews/retry/:id — re-queue pending or retry after failed (same row)
 */
const retryPendingAnalyze = async (req, res, next) => {
  try {
    const { id } = req.params;

    await retryPendingOrFailedReview({ reviewId: id, userId: req.user.id });

    res.status(202).json({ success: true, message: 'Analysis re-queued' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listReviews,
  getReview,
  triggerReview,
  triggerLatestReview,
  retryPendingAnalyze,
  getStats,
};
