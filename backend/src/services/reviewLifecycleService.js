/**
 * Manual review triggers: enqueue, duplicate handling, re-analysis, retry, latest-from-GitHub.
 * Uses repositories + reviewQueue; no Express types.
 */
const { AppError } = require('../middleware/errorHandler');
const { enqueueAnalyzeJob } = require('./reviewQueue');
const { createOctokit } = require('./githubWebhookService');
const { logger } = require('../utils/logger');
const reviewsRepository = require('../repositories/reviewsRepository');
const reposRepository = require('../repositories/reposRepository');
const { getGithubAccessTokenForUser } = require('./userTokenService');

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
  const { data: existing, error: fetchErr } = await reviewsRepository.findReviewForRepoCommit(
    repositoryId,
    commitSha
  );

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

  const reviewId = existing.id;

  const { error: delIssues } = await reviewsRepository.deleteReviewIssuesByReviewId(reviewId);
  throwIfDbError('deleteReviewIssues', delIssues);

  const { error: delStats } = await reviewsRepository.deleteReviewFileStatsByReviewId(reviewId);
  throwIfDbError('deleteReviewFileStats', delStats);

  const { error: updErr } = await reviewsRepository.updateCodeReviewById(reviewId, {
    status: 'pending',
    summary: null,
    overall_score: null,
    completed_at: null,
    error_message: null,
    branch: branchLabel || existing.branch || 'main',
    triggered_by: 'manual',
  });
  throwIfDbError('resetCodeReview', updErr);

  await enqueueAnalyzeJob(jobPayload);

  const { data: review, error: loadErr } = await reviewsRepository.selectReviewById(reviewId);
  throwIfDbError('loadReviewAfterReset', loadErr);

  return { review, reanalysis: true, duplicatePending: false };
}

/**
 * @param {{ repositoryId: string, repo: object, userId: string, commitSha: string, branch?: string }} params
 * @returns {Promise<{ review: object, reanalysis: boolean, duplicatePending: boolean }>}
 */
async function enqueueManualReview({ repositoryId, repo, userId, commitSha, branch }) {
  const branchLabel = branch || 'main';

  const { data: review, error: insertError } = await reviewsRepository.insertManualReviewRow({
    repositoryId,
    commitSha,
    branch: branchLabel,
    triggeredBy: 'manual',
  });

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
 * @param {{ userId: string, repositoryId: string, branch?: string }} params
 */
async function enqueueReviewForLatestCommitOnDefaultBranch({ userId, repositoryId, branch }) {
  const { data: repo, error } = await reposRepository.findByIdAndUserId(repositoryId, userId);

  if (error || !repo) throw new AppError('Repository not found', 404);

  const githubToken = await getGithubAccessTokenForUser(userId);

  if (!githubToken) {
    throw new AppError('GitHub token unavailable — sign out and sign in again', 400);
  }

  const octokit = createOctokit(githubToken);
  const [owner, repoName] = repo.full_name.split('/');

  const { data: remote } = await octokit.repos.get({ owner, repo: repoName });
  const defaultBranch = remote.default_branch;
  const targetBranch = String(branch || '').trim() || defaultBranch;

  let commits;
  try {
    ({ data: commits } = await octokit.repos.listCommits({
      owner,
      repo: repoName,
      sha: targetBranch,
      per_page: 1,
    }));
  } catch (e) {
    const msg = String(e?.message || '');
    if (msg.includes('Not Found') || e?.status === 404) {
      throw new AppError(`Branch "${targetBranch}" was not found on GitHub`, 404);
    }
    throw e;
  }

  const head = commits[0];
  if (!head?.sha) {
    throw new AppError(
      `Could not resolve latest commit on branch "${targetBranch}" (empty branch or no access)`,
      502
    );
  }

  return enqueueManualReview({
    repositoryId,
    repo,
    userId,
    commitSha: head.sha,
    branch: targetBranch,
  });
}

/**
 * Re-queue a pending job or reset a failed row and enqueue.
 * @param {{ reviewId: string, userId: string }} params
 */
async function retryPendingOrFailedReview({ reviewId, userId }) {
  const { data: review, error: revErr } = await reviewsRepository.getReviewSummaryForRetry(reviewId);

  if (revErr || !review) throw new AppError('Review not found', 404);

  const { data: repoRow, error: repoErr } = await reposRepository.findById(review.repository_id);

  if (repoErr || !repoRow) throw new AppError('Repository not found', 404);
  if (repoRow.user_id !== userId) throw new AppError('Forbidden', 403);

  if (!['pending', 'failed'].includes(review.status)) {
    throw new AppError(
      `Only pending or failed reviews can be re-run from here (current: ${review.status})`,
      400
    );
  }

  if (review.status === 'failed') {
    const { error: clearIssues } = await reviewsRepository.deleteReviewIssuesByReviewId(reviewId);
    if (clearIssues) throw new AppError('Could not reset review issues', 500);
    const { error: clearStats } = await reviewsRepository.deleteReviewFileStatsByReviewId(reviewId);
    if (clearStats) throw new AppError('Could not reset review file stats', 500);

    const { error: resetErr } = await reviewsRepository.updateCodeReviewById(reviewId, {
      status: 'pending',
      summary: null,
      overall_score: null,
      error_message: null,
      completed_at: null,
      triggered_by: 'manual',
    });
    if (resetErr) throw new AppError('Could not reset review row', 500);
    logger.info(`Retry/failed cleared review ${reviewId.slice(0, 8)}, re-queueing`);
  }

  await enqueueAnalyzeJob({
    reviewId: review.id,
    repositoryId: review.repository_id,
    commitSha: review.commit_sha,
    repoFullName: repoRow.full_name,
    prNumber: review.pr_number,
    userId: repoRow.user_id,
  });
}

module.exports = {
  enqueueManualReview,
  enqueueReviewForLatestCommitOnDefaultBranch,
  retryPendingOrFailedReview,
};
