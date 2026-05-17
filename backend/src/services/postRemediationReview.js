'use strict';

const { logger } = require('../utils/logger');
const reviewsRepository = require('../repositories/reviewsRepository');
const reportsRepository = require('../repositories/reportsRepository');
const reposRepository = require('../repositories/reposRepository');
const { supabase } = require('../config/database');
const { isRegressionAgainstBaseline } = require('./remediationScan');

/**
 * After fixes are pushed, queue a fresh analysis on that commit so scores/issues stay current.
 */
async function queueReanalysisAfterRemediationPush({
  reportId,
  repositoryId,
  userId,
  repoFullName,
  pushCommitSha,
  branch,
  logParts,
  appendLog,
}) {
  const { enqueueManualReview } = require('./reviewLifecycleService');

  const { data: repo, error: repoErr } = await reposRepository.findByIdAndUserId(repositoryId, userId);
  if (repoErr || !repo) {
    appendLog(logParts, 'Could not queue re-scan: repository not found');
    return null;
  }

  try {
    const result = await enqueueManualReview({
      repositoryId,
      repo,
      userId,
      commitSha: pushCommitSha,
      branch: branch || 'main',
      triggeredBy: 'remediation',
    });

    const reviewId = result.review.id;
    appendLog(
      logParts,
      `Queued re-scan of fixed code (review ${reviewId.slice(0, 8)}${result.reanalysis ? ', re-running' : ''})`
    );

    const { error: linkErr } = await reportsRepository.updateReportById(reportId, {
      follow_up_review_id: reviewId,
    });
    if (linkErr && /follow_up_review_id/i.test(String(linkErr.message || ''))) {
      logger.warn(
        'follow_up_review_id column missing — run backend/migrations/add_follow_up_review_id.sql'
      );
    }

    logger.info('Post-remediation re-analysis queued', {
      reportId,
      reviewId,
      commit: pushCommitSha.slice(0, 7),
    });

    return result.review;
  } catch (err) {
    appendLog(
      logParts,
      `Could not queue automatic re-scan: ${err.message}. Use Repositories → Review latest.`
    );
    logger.warn(`Post-remediation re-scan failed: ${err.message}`, { reportId });
    return null;
  }
}

/**
 * @param {object} report - analysis_reports row (+ repositories join from getReportWithRepo)
 */
async function buildFollowUpForReport(report) {
  if (report.remediation_status !== 'pushed') return null;

  const pushSha = report.push_commit_sha;
  if (!pushSha && !report.follow_up_review_id) return null;

  let review = null;

  if (report.follow_up_review_id) {
    const { data, error } = await reviewsRepository.selectReviewById(report.follow_up_review_id);
    if (!error && data) review = data;
  }

  if (!review && pushSha) {
    const { data, error } = await reviewsRepository.findReviewForRepoCommitMaybe(
      report.repository_id,
      pushSha
    );
    if (!error && data) review = data;
  }

  if (!review) {
    return {
      status: 'pending',
      reviewId: null,
      message: 'Waiting to start re-scan of fixed code…',
    };
  }

  let issueCount = null;
  if (review.status === 'completed') {
    const { count, error: countErr } = await supabase
      .from('review_issues')
      .select('id', { count: 'exact', head: true })
      .eq('review_id', review.id);
    if (!countErr) issueCount = count ?? 0;
  }

  let followUpReportId = null;
  const { data: fuReport } = await reportsRepository.findReportByReviewId(review.id);
  if (fuReport?.id) followUpReportId = fuReport.id;

  let originalScore = null;
  if (report.review_id) {
    const { data: orig } = await reviewsRepository.selectReviewById(report.review_id);
    originalScore = orig?.overall_score ?? null;
  }

  const originalIssueCount = report.issue_count ?? null;
  const scanned = {
    count: issueCount,
    score: review.overall_score,
  };
  const regression =
    review.status === 'completed' &&
    isRegressionAgainstBaseline(originalIssueCount, originalScore, {
      count: scanned.count,
      score: scanned.score,
    });

  return {
    reviewId: review.id,
    status: review.status,
    overallScore: review.overall_score,
    summary: review.summary,
    completedAt: review.completed_at,
    commitSha: review.commit_sha,
    issueCount,
    reportId: followUpReportId,
    originalIssueCount,
    originalScore,
    regression,
    displayIssueCount: regression ? originalIssueCount : issueCount,
    displayScore: regression ? originalScore : review.overall_score,
    scannedIssueCount: issueCount,
    scannedScore: review.overall_score,
  };
}

module.exports = {
  queueReanalysisAfterRemediationPush,
  buildFollowUpForReport,
};
