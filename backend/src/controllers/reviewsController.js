const { Octokit } = require('@octokit/rest');
const { supabase } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const { enqueueAnalyzeJob } = require('../services/reviewQueue');
const { logger } = require('../utils/logger');

const throwIfDbError = (ctx, error) => {
  if (error) {
    throw new AppError(`${ctx}: ${error.message}`, 500);
  }
};

/**
 * Loads an existing row (after unique violation) and either requeues a fresh analysis
 * (completed/failed) or acknowledges an in-flight/reused row without duplicating workers.
 */
async function resolveExistingManualReview(repositoryId, commitSha, repo, userId, branchLabel) {
  const { data: existing, error: fetchErr } = await supabase
    .from('code_reviews')
    .select('id, status, repository_id, commit_sha, branch')
    .eq('repository_id', repositoryId)
    .eq('commit_sha', commitSha)
    .single();

  if (fetchErr || !existing) {
    throw new AppError('A review exists for this commit but could not be loaded.', 500);
  }

  if (existing.status === 'processing') {
    throw new AppError(
      'A review for this commit is already running. Wait for it to finish, then trigger again.',
      409
    );
  }

  const jobPayload = {
    reviewId: existing.id,
    repositoryId,
    commitSha,
    repoFullName: repo.full_name,
    userId,
  };

  if (existing.status === 'pending') {
    logger.debug(
      `[reviews] Duplicate trigger for pending review ${existing.id.slice(0, 8)} — not re-enqueued`
    );
    return { review: existing, reanalysis: false, duplicatePending: true };
  }

  // completed | failed → wipe prior results and analyze again (same snapshot / latest tips)
  const reviewId = existing.id;

  const { error: delIssues } = await supabase.from('review_issues').delete().eq('review_id', reviewId);
  throwIfDbError('deleteReviewIssues', delIssues);

  const { error: delStats } = await supabase.from('review_file_stats').delete().eq('review_id', reviewId);
  throwIfDbError('deleteReviewFileStats', delStats);

  const { error: updErr } = await supabase
    .from('code_reviews')
    .update({
      status: 'pending',
      summary: null,
      overall_score: null,
      completed_at: null,
      error_message: null,
      branch: branchLabel || existing.branch || 'main',
      triggered_by: 'manual',
    })
    .eq('id', reviewId);
  throwIfDbError('resetCodeReview', updErr);

  await enqueueAnalyzeJob(jobPayload);

  const { data: review, error: loadErr } = await supabase
    .from('code_reviews')
    .select()
    .eq('id', reviewId)
    .single();
  throwIfDbError('loadReviewAfterReset', loadErr);

  return { review, reanalysis: true, duplicatePending: false };
}

async function enqueueManualReview({
  repositoryId,
  repo,
  userId,
  commitSha,
  branch,
}) {
  const branchLabel = branch || 'main';

  const { data: review, error: insertError } = await supabase
    .from('code_reviews')
    .insert({
      repository_id: repositoryId,
      commit_sha: commitSha,
      branch: branchLabel,
      status: 'pending',
      triggered_by: 'manual',
    })
    .select()
    .single();

  if (!insertError) {
    await enqueueAnalyzeJob({
      reviewId: review.id,
      repositoryId,
      commitSha,
      repoFullName: repo.full_name,
      userId,
    });
    return { review, reanalysis: false, duplicatePending: false };
  }

  if (insertError.code === '23505') {
    return resolveExistingManualReview(repositoryId, commitSha, repo, userId, branchLabel);
  }

  throw new AppError('Failed to create review', 500);
}

/**
 * GET /api/reviews?repoId=xxx&page=1&limit=10
 */
const listReviews = async (req, res, next) => {
  try {
    const { repoId, status, page = 1, limit = 10 } = req.query;
    const from = (Number(page) - 1) * Number(limit);
    const to = from + Number(limit) - 1;

    let query = supabase
      .from('code_reviews')
      .select(`
        id, commit_sha, branch, pr_number, author, status,
        overall_score, summary, created_at, completed_at,
        repositories!inner(id, full_name, user_id)
      `, { count: 'exact' })
      .eq('repositories.user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (repoId) query = query.eq('repository_id', repoId);
    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;
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

    const { data: review, error } = await supabase
      .from('code_reviews')
      .select(`
        *,
        repositories!inner(id, full_name, user_id),
        review_issues(*),
        review_file_stats(*)
      `)
      .eq('id', id)
      .single();

    if (error || !review) throw new AppError('Review not found', 404);

    // Authorization: ensure review belongs to requesting user
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

    // Verify repo ownership
    const { data: repo, error } = await supabase
      .from('repositories')
      .select('*')
      .eq('id', repositoryId)
      .eq('user_id', req.user.id)
      .single();

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

    const { data: repo, error } = await supabase
      .from('repositories')
      .select('*')
      .eq('id', repositoryId)
      .eq('user_id', req.user.id)
      .single();

    if (error || !repo) throw new AppError('Repository not found', 404);

    const { data: userRecord } = await supabase
      .from('users')
      .select('access_token')
      .eq('id', req.user.id)
      .single();

    if (!userRecord?.access_token) {
      throw new AppError('GitHub token unavailable — sign out and sign in again', 400);
    }

    const octokit = new Octokit({ auth: userRecord.access_token });
    const [owner, repoName] = repo.full_name.split('/');

    const { data: remote } = await octokit.repos.get({ owner, repo: repoName });
    const defaultBranch = remote.default_branch;

    const { data: commits } = await octokit.repos.listCommits({
      owner,
      repo: repoName,
      sha: defaultBranch,
      per_page: 1,
    });

    const head = commits[0];
    if (!head?.sha) throw new AppError('Could not resolve latest commit from GitHub', 502);

    const result = await enqueueManualReview({
      repositoryId,
      repo,
      userId: req.user.id,
      commitSha: head.sha,
      branch: defaultBranch,
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
    const empty = {
      total: 0,
      completed: 0,
      pending: 0,
      processing: 0,
      avgScore: null,
      issues: {},
    };

    const { data: repos, error: reposErr } = await supabase
      .from('repositories')
      .select('id')
      .eq('user_id', req.user.id);

    if (reposErr) throw new AppError('Failed to load repositories for stats', 500);

    const repoIds = (repos || []).map((r) => r.id);
    if (repoIds.length === 0) {
      return res.json({ success: true, data: empty });
    }

    const { data: reviews, error: reviewsErr } = await supabase
      .from('code_reviews')
      .select('id, status, overall_score')
      .in('repository_id', repoIds);

    if (reviewsErr) throw new AppError('Failed to load reviews for stats', 500);

    const safeReviews = reviews || [];
    if (safeReviews.length === 0) {
      return res.json({ success: true, data: empty });
    }

    const reviewIds = safeReviews.map((r) => r.id);
    const { data: issueRows } = await supabase
      .from('review_issues')
      .select('severity')
      .in('review_id', reviewIds);

    const safeIssues = issueRows || [];

    const completed = safeReviews.filter((r) => r.status === 'completed');
    const scored = completed.filter((r) => r.overall_score != null);
    const avgScore =
      scored.length > 0
        ? Math.round(
            scored.reduce((sum, r) => sum + Number(r.overall_score), 0) / scored.length
          )
        : null;

    const issueSeverityCounts = safeIssues.reduce((acc, issue) => {
      if (issue?.severity) acc[issue.severity] = (acc[issue.severity] || 0) + 1;
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        total: safeReviews.length,
        completed: completed.length,
        pending: safeReviews.filter((r) => r.status === 'pending').length,
        processing: safeReviews.filter((r) => r.status === 'processing').length,
        avgScore,
        issues: issueSeverityCounts,
      },
    });
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

    const { data: review, error: revErr } = await supabase
      .from('code_reviews')
      .select('id, repository_id, commit_sha, status, pr_number')
      .eq('id', id)
      .single();

    if (revErr || !review) throw new AppError('Review not found', 404);

    const { data: repoRow, error: repoErr } = await supabase
      .from('repositories')
      .select('id, full_name, user_id')
      .eq('id', review.repository_id)
      .single();

    if (repoErr || !repoRow) throw new AppError('Repository not found', 404);
    if (repoRow.user_id !== req.user.id) throw new AppError('Forbidden', 403);

    if (!['pending', 'failed'].includes(review.status)) {
      throw new AppError(
        `Only pending or failed reviews can be re-run from here (current: ${review.status})`,
        400
      );
    }

    if (review.status === 'failed') {
      const { error: clearIssues } = await supabase.from('review_issues').delete().eq('review_id', id);
      if (clearIssues) throw new AppError('Could not reset review issues', 500);
      const { error: clearStats } = await supabase.from('review_file_stats').delete().eq('review_id', id);
      if (clearStats) throw new AppError('Could not reset review file stats', 500);

      const { error: resetErr } = await supabase
        .from('code_reviews')
        .update({
          status: 'pending',
          summary: null,
          overall_score: null,
          error_message: null,
          completed_at: null,
          triggered_by: 'manual',
        })
        .eq('id', id);
      if (resetErr) throw new AppError('Could not reset review row', 500);
      logger.info(`Retry/failed cleared review ${id.slice(0, 8)}, re-queueing`);
    }

    await enqueueAnalyzeJob({
      reviewId: review.id,
      repositoryId: review.repository_id,
      commitSha: review.commit_sha,
      repoFullName: repoRow.full_name,
      prNumber: review.pr_number,
      userId: repoRow.user_id,
    });

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
