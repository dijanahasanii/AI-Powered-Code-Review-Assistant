/**
 * Dashboard review statistics aggregation (no HTTP).
 */
const { AppError } = require('../middleware/errorHandler');
const reposRepository = require('../repositories/reposRepository');
const reviewsRepository = require('../repositories/reviewsRepository');

const emptyStats = () => ({
  total: 0,
  completed: 0,
  pending: 0,
  processing: 0,
  avgScore: null,
  issues: {},
});

/**
 * @param {string} userId
 * @returns {Promise<object>}
 */
async function getDashboardReviewStats(userId) {
  const { data: repos, error: reposErr } = await reposRepository.listIdsForUser(userId);

  if (reposErr) throw new AppError('Failed to load repositories for stats', 500);

  const repoIds = (repos || []).map((r) => r.id);
  if (repoIds.length === 0) {
    return emptyStats();
  }

  const { data: reviews, error: reviewsErr } = await reviewsRepository.listReviewsForStats(repoIds);

  if (reviewsErr) throw new AppError('Failed to load reviews for stats', 500);

  const safeReviews = reviews || [];
  if (safeReviews.length === 0) {
    return emptyStats();
  }

  const reviewIds = safeReviews.map((r) => r.id);
  const { data: issueRows } = await reviewsRepository.listIssueSeveritiesForReviews(reviewIds);

  const safeIssues = issueRows || [];

  const completed = safeReviews.filter((r) => r.status === 'completed');
  const scored = completed.filter((r) => r.overall_score != null);
  const avgScore =
    scored.length > 0
      ? Math.round(scored.reduce((sum, r) => sum + Number(r.overall_score), 0) / scored.length)
      : null;

  const issueSeverityCounts = safeIssues.reduce((acc, issue) => {
    if (issue?.severity) acc[issue.severity] = (acc[issue.severity] || 0) + 1;
    return acc;
  }, {});

  return {
    total: safeReviews.length,
    completed: completed.length,
    pending: safeReviews.filter((r) => r.status === 'pending').length,
    processing: safeReviews.filter((r) => r.status === 'processing').length,
    avgScore,
    issues: issueSeverityCounts,
  };
}

module.exports = {
  getDashboardReviewStats,
};
