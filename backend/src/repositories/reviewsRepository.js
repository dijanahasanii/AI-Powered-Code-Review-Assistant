/**
 * Data access for code_reviews, review_issues, and review_file_stats.
 * No HTTP or queue side effects.
 */
const { supabase } = require('../config/database');

/**
 * @param {string} repositoryId
 * @param {string} commitSha
 */
async function findReviewForRepoCommit(repositoryId, commitSha) {
  return supabase
    .from('code_reviews')
    .select('id, status, repository_id, commit_sha, branch')
    .eq('repository_id', repositoryId)
    .eq('commit_sha', commitSha)
    .single();
}

async function deleteReviewIssuesByReviewId(reviewId) {
  return supabase.from('review_issues').delete().eq('review_id', reviewId);
}

async function deleteReviewFileStatsByReviewId(reviewId) {
  return supabase.from('review_file_stats').delete().eq('review_id', reviewId);
}

/**
 * @param {string} reviewId
 * @param {object} patch
 */
async function updateCodeReviewById(reviewId, patch) {
  return supabase.from('code_reviews').update(patch).eq('id', reviewId);
}

async function insertManualReviewRow({ repositoryId, commitSha, branch, triggeredBy = 'manual' }) {
  return supabase
    .from('code_reviews')
    .insert({
      repository_id: repositoryId,
      commit_sha: commitSha,
      branch,
      status: 'pending',
      triggered_by: triggeredBy,
    })
    .select()
    .single();
}

async function selectReviewById(reviewId) {
  return supabase.from('code_reviews').select().eq('id', reviewId).single();
}

/**
 * @param {object} opts
 * @param {string} opts.userId
 * @param {string} [opts.repoId]
 * @param {string} [opts.status]
 * @param {number} opts.from
 * @param {number} opts.to
 */
async function listReviewsForUser({ userId, repoId, status, from, to }) {
  let query = supabase
    .from('code_reviews')
    .select(
      `
        id, commit_sha, branch, pr_number, author, status,
        overall_score, summary, created_at, completed_at,
        repositories!inner(id, full_name, user_id)
      `,
      { count: 'exact' }
    )
    .eq('repositories.user_id', userId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (repoId) query = query.eq('repository_id', repoId);
  if (status) query = query.eq('status', status);

  return query;
}

async function getReviewWithRelations(reviewId) {
  return supabase
    .from('code_reviews')
    .select(
      `
        *,
        repositories!inner(id, full_name, user_id),
        review_issues(*),
        review_file_stats(*)
      `
    )
    .eq('id', reviewId)
    .single();
}

/**
 * Minimal fields for retry flow.
 * @param {string} reviewId
 */
async function getReviewSummaryForRetry(reviewId) {
  return supabase
    .from('code_reviews')
    .select('id, repository_id, commit_sha, status, pr_number')
    .eq('id', reviewId)
    .single();
}

/**
 * @param {string[]} repositoryIds
 */
async function listReviewsForStats(repositoryIds) {
  if (!repositoryIds.length) {
    return { data: [], error: null };
  }
  return supabase
    .from('code_reviews')
    .select('id, status, overall_score')
    .in('repository_id', repositoryIds);
}

/**
 * @param {string[]} reviewIds
 */
async function listIssueSeveritiesForReviews(reviewIds) {
  if (!reviewIds.length) {
    return { data: [], error: null };
  }
  return supabase.from('review_issues').select('severity').in('review_id', reviewIds);
}

async function deleteCodeReviewsByRepositoryId(repositoryId) {
  return supabase.from('code_reviews').delete().eq('repository_id', repositoryId);
}

module.exports = {
  findReviewForRepoCommit,
  deleteReviewIssuesByReviewId,
  deleteReviewFileStatsByReviewId,
  updateCodeReviewById,
  insertManualReviewRow,
  selectReviewById,
  listReviewsForUser,
  getReviewWithRelations,
  getReviewSummaryForRetry,
  listReviewsForStats,
  listIssueSeveritiesForReviews,
  deleteCodeReviewsByRepositoryId,
};
