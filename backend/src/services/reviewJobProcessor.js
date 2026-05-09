const { supabase } = require('../config/database');
const { analyzeCode } = require('./openaiService');
const { fetchCommitDiff, postPRComments } = require('./githubService');
const { logger } = require('../utils/logger');

let ioSingleton = null;

function setSocketIo(io) {
  ioSingleton = io;
}

/**
 * Run one analyze job (used by Bull worker and by inline queue).
 * @param {object} jobData - reviewId, repositoryId, commitSha, repoFullName, prNumber?, userId
 * @param {object} [opts]
 * @param {boolean} [opts.rethrowOnError=false] - set true when using Bull so failed jobs retry
 */
async function runAnalyzeJob(jobData, { rethrowOnError = false } = {}) {
  const { reviewId, repositoryId, commitSha, repoFullName, prNumber, userId } = jobData || {};
  const io = ioSingleton;

  if (!reviewId || !repositoryId || !commitSha || !repoFullName || !userId) {
    const msg = `Invalid analyze job payload: ${JSON.stringify(jobData)}`;
    logger.error(msg);
    throw new Error(msg);
  }

  logger.info(`Processing review for commit ${commitSha} (review ${reviewId})`);

  try {
    await updateReviewStatus(reviewId, 'processing', { error_message: null });
    emitUpdate(io, userId, repositoryId, { reviewId, status: 'processing' });

    let diff = '';
    let fileStats = [];
    try {
      const bundle = await fetchCommitDiff(repoFullName, commitSha, userId);
      diff = bundle.diff;
      fileStats = bundle.fileStats;
    } catch (diffErr) {
      logger.warn(
        `fetchCommitDiff (${commitSha.slice(0, 7)}): ${diffErr.message} — continuing with snapshot-only analysis`
      );
    }

    const { data: repo } = await supabase
      .from('repositories')
      .select('name, language')
      .eq('id', repositoryId)
      .single();

    const analysis = await analyzeCode(diff, {
      repoName: repoFullName,
      language: repo?.language,
      userId,
      commitSha,
    });

    await finalizeReview(reviewId, analysis, fileStats);

    if (prNumber) {
      await postPRComments(repoFullName, prNumber, commitSha, analysis.issues, userId);
    }

    emitUpdate(io, userId, repositoryId, {
      reviewId,
      status: 'completed',
      overallScore: analysis.overallScore,
      issueCount: analysis.issues.length,
    });

    logger.info(`Review ${reviewId} completed successfully`);
  } catch (err) {
    logger.error(`Review ${reviewId} failed: ${err.message}`, err);
    await markReviewFailed(reviewId, err);
    emitUpdate(io, userId, repositoryId, { reviewId, status: 'failed', error: err.message });
    if (rethrowOnError) throw err;
  }
}

function attachBullProcessor() {
  const { reviewQueue } = require('./reviewQueue');
  if (!reviewQueue) return;

  reviewQueue.process('analyze', 3, async (job) => {
    await runAnalyzeJob(job.data, { rethrowOnError: true });
  });
}

const throwIfDbError = (ctx, error) => {
  if (error) {
    logger.error(`${ctx}: ${error.message}`, { code: error.code, details: error.details });
    throw new Error(`${ctx}: ${error.message}`);
  }
};

const truncateErr = (msg) =>
  String(msg || 'Unknown error')
    .substring(0, 4000)
    .trim();

const updateReviewStatus = async (reviewId, status, extraPatch = {}) => {
  const { error } = await supabase
    .from('code_reviews')
    .update({
      status,
      ...(status === 'completed' ? { completed_at: new Date().toISOString() } : {}),
      ...extraPatch,
    })
    .eq('id', reviewId);
  throwIfDbError('updateReviewStatus', error);
};

/** Marks review failed and stores a user-visible reason (error_message column, or summary fallback). */
const markReviewFailed = async (reviewId, err) => {
  const message = truncateErr(err?.message ? `${err.message}` : `${err}`);
  let { error } = await supabase
    .from('code_reviews')
    .update({
      status: 'failed',
      error_message: message,
      completed_at: null,
    })
    .eq('id', reviewId);

  if (error) {
    logger.warn(
      'Could not save error_message (column missing?) — falling back to summary prefix. Run: ALTER TABLE code_reviews ADD COLUMN IF NOT EXISTS error_message TEXT;'
    );
    ({ error } = await supabase
      .from('code_reviews')
      .update({
        status: 'failed',
        summary: `[Review failed] ${message}`.substring(0, 8000),
        completed_at: null,
      })
      .eq('id', reviewId));
  }

  throwIfDbError('markReviewFailed', error);
};

const finalizeReview = async (reviewId, analysis, fileStats) => {
  let issuesInserted = false;

  try {
    if (analysis.issues.length > 0) {
      const { error: insErr } = await supabase.from('review_issues').insert(
        analysis.issues.map((issue) => ({
          review_id: reviewId,
          file_path: issue.filePath,
          line_number: issue.lineNumber,
          severity: issue.severity,
          category: issue.category,
          title: issue.title,
          description: issue.description,
          suggestion: issue.suggestion,
          code_snippet: issue.codeSnippet ?? null,
          matched_rule: issue.matchedRule ?? null,
        }))
      );
      throwIfDbError('finalizeReview(issues)', insErr);
      issuesInserted = true;
    }

    if (fileStats.length > 0) {
      const issuesByFile = analysis.issues.reduce((acc, issue) => {
        acc[issue.filePath] = (acc[issue.filePath] || 0) + 1;
        return acc;
      }, {});

      const { error: fsErr } = await supabase.from('review_file_stats').insert(
        fileStats.map((f) => ({
          review_id: reviewId,
          file_path: f.filePath,
          additions: f.additions,
          deletions: f.deletions,
          issues_count: issuesByFile[f.filePath] || 0,
        }))
      );
      throwIfDbError('finalizeReview(file_stats)', fsErr);
    }

    const { error: upErr } = await supabase
      .from('code_reviews')
      .update({
        status: 'completed',
        summary: analysis.summary,
        overall_score: analysis.overallScore,
        completed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('id', reviewId);
    throwIfDbError('finalizeReview(update)', upErr);
  } catch (e) {
    if (issuesInserted) {
      const { error: delErr } = await supabase.from('review_issues').delete().eq('review_id', reviewId);
      if (delErr) logger.error(`finalizeReview rollback issues: ${delErr.message}`);
    }
    await supabase.from('review_file_stats').delete().eq('review_id', reviewId);
    throw e;
  }
};

const emitUpdate = (io, userId, repositoryId, data) => {
  if (!io) return;
  io.to(`repo:${repositoryId}`).emit('review:update', data);
  io.to(`user:${userId}`).emit('review:update', data);
};

module.exports = {
  setSocketIo,
  runAnalyzeJob,
  attachBullProcessor,
};
