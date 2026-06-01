/**
 * Dashboard review statistics aggregation (no HTTP).
 */
const { AppError } = require('../middleware/errorHandler');
const reposRepository = require('../repositories/reposRepository');
const reviewsRepository = require('../repositories/reviewsRepository');
const reportsRepository = require('../repositories/reportsRepository');
const repositoryIssuesRepository = require('../repositories/repositoryIssuesRepository');

const SEVERITY_KEYS = ['critical', 'warning', 'info', 'suggestion'];
const LEGACY_ISSUE_FALLBACK_REVIEW_CAP = 150;
const STATS_CACHE_TTL_MS = 20_000;

/** @type {Map<string, { at: number, data: object }>} */
const statsCache = new Map();

const emptyStats = () => ({
  total: 0,
  completed: 0,
  pending: 0,
  processing: 0,
  avgScore: null,
  repoCount: 0,
  issues: {},
});

function sumSeveritySummaries(rows) {
  const counts = Object.fromEntries(SEVERITY_KEYS.map((k) => [k, 0]));
  for (const row of rows || []) {
    const s = row?.severity_summary || {};
    for (const k of SEVERITY_KEYS) {
      counts[k] += Number(s[k]) || 0;
    }
  }
  return counts;
}

async function aggregateIssueSeverities(repoIds) {
  const { data: activeTracked, error: trackedErr } =
    await repositoryIssuesRepository.listActiveByRepositoryIds(repoIds);

  if (!trackedErr && (activeTracked || []).length > 0) {
    return (activeTracked || []).reduce((acc, row) => {
      if (row?.severity) acc[row.severity] = (acc[row.severity] || 0) + 1;
      return acc;
    }, Object.fromEntries(SEVERITY_KEYS.map((k) => [k, 0])));
  }

  const { data: summaryRows, error: sumErr } =
    await reportsRepository.listSeveritySummariesForRepos(repoIds);

  if (sumErr) {
    throw new AppError('Failed to load report severity summaries for stats', 500);
  }

  const fromReports = sumSeveritySummaries(summaryRows);
  const reportTotal = SEVERITY_KEYS.reduce((n, k) => n + fromReports[k], 0);

  if (reportTotal > 0) {
    return fromReports;
  }

  const { data: recentCompleted, error: recentErr } =
    await reviewsRepository.listRecentCompletedReviewIds(repoIds, LEGACY_ISSUE_FALLBACK_REVIEW_CAP);
  if (recentErr) {
    throw new AppError('Failed to load reviews for legacy stats fallback', 500);
  }

  const reviewIds = (recentCompleted || []).map((r) => r.id);
  if (!reviewIds.length) return fromReports;

  const { data: issueRows, error: issuesErr } =
    await reviewsRepository.listIssueSeveritiesForReviews(reviewIds);

  if (issuesErr) {
    throw new AppError('Failed to load issue severities for stats', 500);
  }

  return (issueRows || []).reduce((acc, issue) => {
    if (issue?.severity) acc[issue.severity] = (acc[issue.severity] || 0) + 1;
    return acc;
  }, {});
}

async function computeDashboardReviewStats(userId) {
  const { data: repos, error: reposErr } = await reposRepository.listIdsForUser(userId);

  if (reposErr) throw new AppError('Failed to load repositories for stats', 500);

  const repoIds = (repos || []).map((r) => r.id);
  if (repoIds.length === 0) {
    return emptyStats();
  }

  const { data: counts, error: countsErr } = await reviewsRepository.countReviewsForRepos(repoIds);

  if (countsErr) throw new AppError('Failed to load review counts for stats', 500);

  const issueSeverityCounts = await aggregateIssueSeverities(repoIds);

  return {
    total: counts.total,
    completed: counts.completed,
    pending: counts.pending,
    processing: counts.processing,
    avgScore: counts.avgScore,
    repoCount: repoIds.length,
    issues: issueSeverityCounts,
  };
}

function invalidateDashboardStatsCache(userId) {
  if (userId) statsCache.delete(userId);
  else statsCache.clear();
}

/**
 * @param {string} userId
 * @returns {Promise<object>}
 */
async function getDashboardReviewStats(userId) {
  const hit = statsCache.get(userId);
  if (hit && Date.now() - hit.at < STATS_CACHE_TTL_MS) {
    return hit.data;
  }

  const data = await computeDashboardReviewStats(userId);
  statsCache.set(userId, { at: Date.now(), data });
  return data;
}

module.exports = {
  getDashboardReviewStats,
  invalidateDashboardStatsCache,
};
