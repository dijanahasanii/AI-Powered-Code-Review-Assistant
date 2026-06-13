'use strict';

const fs = require('fs/promises');
const path = require('path');
const { supabase } = require('../config/database');
const reportsRepository = require('../repositories/reportsRepository');
const { remediationStatusForIssueCount, formatRemediationStatusLabel } = require('../lib/reportRemediationStatus');
const { logger } = require('../utils/logger');

const REPORTS_DIR = path.join(__dirname, '..', '..', 'reports');

function countSeverities(issues) {
  const summary = { critical: 0, warning: 0, info: 0, suggestion: 0 };
  for (const issue of issues || []) {
    const key = String(issue.severity || 'info').toLowerCase();
    if (Object.prototype.hasOwnProperty.call(summary, key)) {
      summary[key] += 1;
    } else {
      summary.info += 1;
    }
  }
  return summary;
}

function inferAnalysisType(issues, triggeredBy) {
  const categories = new Set((issues || []).map((i) => i.category).filter(Boolean));
  if (categories.has('security')) return 'Security Audit';
  if (categories.has('performance')) return 'Performance Review';
  if (triggeredBy === 'manual') return 'Manual Analysis';
  return 'Code Analysis';
}

function isFixAvailable(issue) {
  return Boolean(
    issue.suggestion &&
      issue.filePath &&
      ['critical', 'warning', 'info', 'suggestion'].includes(String(issue.severity))
  );
}

function buildMarkdownReport({
  repositoryName,
  branch,
  commitSha,
  generatedAt,
  analysisType,
  issues,
  summary,
  overallScore,
  remediationStatus,
}) {
  const severitySummary = countSeverities(issues);
  const lines = [
    `# AI Analysis Report`,
    ``,
    `## Metadata`,
    ``,
    `| Field | Value |`,
    `| --- | --- |`,
    `| Repository | ${repositoryName} |`,
    `| Branch | ${branch || '—'} |`,
    `| Commit | \`${commitSha || '—'}\` |`,
    `| Generated | ${generatedAt} |`,
    `| Analysis type | ${analysisType} |`,
    `| Overall score | ${overallScore != null ? overallScore : '—'} |`,
    `| Issue count | ${issues.length} |`,
    `| Remediation status | ${formatRemediationStatusLabel(remediationStatus)} |`,
    ``,
    `### Severity summary`,
    ``,
    `- Critical: ${severitySummary.critical}`,
    `- Warning: ${severitySummary.warning}`,
    `- Info: ${severitySummary.info}`,
    `- Suggestion: ${severitySummary.suggestion}`,
    ``,
  ];

  if (summary) {
    lines.push(`## Summary`, ``, summary, ``);
  }

  lines.push(`## Issues`, ``);

  if (issues.length === 0) {
    lines.push(`No issues were detected for this analysis run.`, ``);
  } else {
    issues.forEach((issue, index) => {
      const fixAvail = isFixAvailable(issue);
      lines.push(
        `### ${index + 1}. ${issue.title}`,
        ``,
        `- **Severity:** ${issue.severity}`,
        `- **Category:** ${issue.category || 'general'}`,
        `- **File:** \`${issue.filePath}\``,
        `- **Line:** ${issue.lineNumber ?? '—'}`,
        `- **Fix available:** ${fixAvail ? 'yes' : 'no'}`,
        ``,
        `**Description**`,
        ``,
        issue.description || '_No description._',
        ``
      );
      if (issue.matchedRule) {
        lines.push(`**Matched rule**`, ``, issue.matchedRule, ``);
      }
      if (issue.codeSnippet) {
        lines.push(`**Code snippet**`, ``, '```', issue.codeSnippet, '```', ``);
      }
      if (issue.suggestion) {
        lines.push(`**Suggested fix**`, ``, issue.suggestion, ``);
      }
      lines.push(`---`, ``);
    });
  }

  lines.push(
    `## Remediation`,
    ``,
    `Remediation requires explicit confirmation in the application UI.`,
    `Fixes are applied only to the analyzed branch after user approval.`,
    ``
  );

  return lines.join('\n');
}

async function ensureReportsDir() {
  await fs.mkdir(REPORTS_DIR, { recursive: true });
}

/**
 * Generate markdown report file and persist metadata after a completed review.
 * @param {object} opts
 * @param {string} opts.reviewId
 * @param {string} opts.repositoryId
 * @param {string} opts.repositoryName
 * @param {string} [opts.branch]
 * @param {string} [opts.commitSha]
 * @param {string} [opts.triggeredBy]
 * @param {object} opts.analysis
 */
async function generateAndPersistReport({
  reviewId,
  repositoryId,
  repositoryName,
  branch,
  commitSha,
  triggeredBy,
  analysis,
}) {
  const issues = analysis?.issues || [];
  const severitySummary = countSeverities(issues);
  const analysisType = inferAnalysisType(issues, triggeredBy);
  const generatedAt = new Date().toISOString();
  const remediationStatus = remediationStatusForIssueCount(issues.length);

  const markdown = buildMarkdownReport({
    repositoryName,
    branch,
    commitSha,
    generatedAt,
    analysisType,
    issues,
    summary: analysis?.summary,
    overallScore: analysis?.overallScore,
    remediationStatus,
  });

  await ensureReportsDir();

  const fileName = `${reviewId}.md`;
  const reportPath = `reports/${fileName}`;
  const absolutePath = path.join(REPORTS_DIR, fileName);

  await fs.writeFile(absolutePath, markdown, 'utf8');

  const { data: existingReport } = await reportsRepository.findReportByReviewId(reviewId);
  const keepRemediation =
    existingReport?.remediation_status === 'pushed' ||
    ['running', 'validating', 'confirmed'].includes(existingReport?.remediation_status);

  const row = {
    review_id: reviewId,
    repository_id: repositoryId,
    repository_name: repositoryName,
    analyzed_branch: branch || null,
    commit_sha: commitSha || null,
    report_path: reportPath,
    issue_count: issues.length,
    severity_summary: severitySummary,
    analysis_type: analysisType,
    remediation_status: keepRemediation ? existingReport.remediation_status : remediationStatus,
    remediation_log: keepRemediation ? existingReport.remediation_log : null,
    push_commit_sha: keepRemediation ? existingReport.push_commit_sha : null,
    pushed_at: keepRemediation ? existingReport.pushed_at : null,
  };

  const { data, error } = await reportsRepository.upsertReport(row);
  if (error) {
    logger.error(`generateAndPersistReport DB error: ${error.message}`, { reviewId });
    throw new Error(`Failed to persist analysis report: ${error.message}`);
  }

  logger.info('Analysis report persisted', {
    reviewId,
    reportId: data?.id,
    issueCount: issues.length,
  });

  return data;
}

async function readReportMarkdown(reportPath) {
  const relative = String(reportPath || '').replace(/^reports[/\\]/, '');
  const absolutePath = path.join(REPORTS_DIR, relative);
  return fs.readFile(absolutePath, 'utf8');
}

/**
 * Rebuild markdown from Supabase when the on-disk file is missing (ephemeral hosting / redeploy).
 * @param {object} report - analysis_reports row (review_id, repository_name, etc.)
 */
async function regenerateReportMarkdownFromDb(report) {
  const analysis = await buildAnalysisPayloadForReview(report.review_id);
  const markdown = buildMarkdownReport({
    repositoryName: report.repository_name,
    branch: report.analyzed_branch,
    commitSha: report.commit_sha,
    generatedAt: report.created_at || new Date().toISOString(),
    analysisType: report.analysis_type || inferAnalysisType(analysis.issues),
    issues: analysis.issues,
    summary: analysis.summary,
    overallScore: analysis.overallScore,
    remediationStatus: report.remediation_status,
  });

  const absolutePath =
    resolveReportAbsolutePath(report.report_path) ||
    path.join(REPORTS_DIR, `${report.review_id}.md`);
  try {
    await ensureReportsDir();
    await fs.writeFile(absolutePath, markdown, 'utf8');
  } catch (writeErr) {
    logger.warn(`regenerateReportMarkdownFromDb: could not rewrite file: ${writeErr.message}`);
  }

  return markdown;
}

/**
 * Read persisted markdown, or rebuild from DB if the file was lost (Railway ephemeral disk).
 */
async function readOrRegenerateReportMarkdown(report) {
  try {
    return await readReportMarkdown(report.report_path);
  } catch (err) {
    if (err?.code !== 'ENOENT') throw err;
    logger.warn(
      `Report file missing on disk (${report.report_path}) — regenerating from database for review ${report.review_id}`
    );
    return regenerateReportMarkdownFromDb(report);
  }
}

function resolveReportAbsolutePath(reportPath) {
  const relative = String(reportPath || '').replace(/^reports[/\\]/, '');
  if (!relative) return null;
  return path.join(REPORTS_DIR, relative);
}

/**
 * Remove analysis_reports rows and markdown files for a disconnected repository.
 */
async function deleteReportsForRepository(repositoryId) {
  const { data: rows, error } = await reportsRepository.listReportPathsByRepositoryId(repositoryId);
  if (error) {
    if (/analysis_reports/i.test(String(error.message || '')) || error.code === '42P01') {
      return { deleted: 0 };
    }
    throw new Error(`deleteReportsForRepository: ${error.message}`);
  }

  const list = rows || [];
  await Promise.all(
    list.map(async (row) => {
      const absolutePath = resolveReportAbsolutePath(row.report_path);
      if (!absolutePath) return;
      try {
        await fs.unlink(absolutePath);
      } catch (err) {
        if (err?.code !== 'ENOENT') {
          logger.warn(`deleteReportsForRepository: could not remove file ${absolutePath}: ${err.message}`);
        }
      }
    })
  );

  const { error: delErr } = await reportsRepository.deleteByRepositoryId(repositoryId);
  if (delErr && !/analysis_reports/i.test(String(delErr.message || ''))) {
    throw new Error(`deleteReportsForRepository DB: ${delErr.message}`);
  }

  if (list.length) {
    logger.info(`Removed ${list.length} analysis report(s) for repository ${repositoryId}`);
  }
  return { deleted: list.length };
}

/**
 * Load issues for a review from DB (for remediation).
 */
async function loadReviewIssues(reviewId) {
  const { data, error } = await supabase
    .from('review_issues')
    .select('*')
    .eq('review_id', reviewId)
    .order('severity', { ascending: true });
  if (error) throw new Error(`loadReviewIssues: ${error.message}`);
  return (data || []).filter((row) => {
    const ls = row.lifecycle_status;
    return !ls || ls === 'open' || ls === 'reopened';
  });
}

function mapIssueRow(row) {
  return {
    filePath: row.file_path,
    lineNumber: row.line_number,
    severity: row.severity,
    category: row.category,
    title: row.title,
    description: row.description,
    suggestion: row.suggestion,
    codeSnippet: row.code_snippet,
    matchedRule: row.matched_rule,
  };
}

async function buildAnalysisPayloadForReview(reviewId) {
  const { data: issues, error: issuesErr } = await supabase
    .from('review_issues')
    .select('*')
    .eq('review_id', reviewId);
  if (issuesErr) throw new Error(`buildAnalysisPayloadForReview: ${issuesErr.message}`);

  const { data: reviewFull, error: reviewErr } = await supabase
    .from('code_reviews')
    .select('summary, overall_score')
    .eq('id', reviewId)
    .single();
  if (reviewErr) throw new Error(`buildAnalysisPayloadForReview: ${reviewErr.message}`);

  return {
    summary: reviewFull?.summary ?? null,
    overallScore: reviewFull?.overall_score ?? null,
    issues: (issues || []).map(mapIssueRow),
  };
}

/**
 * Create analysis_reports for completed reviews that never got a report (e.g. transient DB error).
 */
async function ensureMissingReportsForUser(userId, { limit = 20 } = {}) {
  const { data: repos, error: repoErr } = await supabase
    .from('repositories')
    .select('id, name, full_name')
    .eq('user_id', userId);
  if (repoErr) throw new Error(`ensureMissingReportsForUser: ${repoErr.message}`);

  const repoList = repos || [];
  const repoIds = repoList.map((r) => r.id);
  if (!repoIds.length) return { created: 0 };

  const repoById = new Map(repoList.map((r) => [r.id, r]));

  const { data: completed, error: revErr } = await supabase
    .from('code_reviews')
    .select('id, repository_id, commit_sha, branch, triggered_by')
    .in('repository_id', repoIds)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(100);
  if (revErr) throw new Error(`ensureMissingReportsForUser: ${revErr.message}`);

  const reviewRows = completed || [];
  if (!reviewRows.length) return { created: 0 };

  const reviewIds = reviewRows.map((r) => r.id);
  const { data: existingReports, error: repErr } = await supabase
    .from('analysis_reports')
    .select('review_id')
    .in('review_id', reviewIds);
  if (repErr) {
    if (/analysis_reports/i.test(String(repErr.message || '')) || repErr.code === 'PGRST205') {
      return { created: 0 };
    }
    throw new Error(`ensureMissingReportsForUser: ${repErr.message}`);
  }

  const hasReport = new Set((existingReports || []).map((r) => r.review_id));
  let created = 0;

  for (const review of reviewRows) {
    if (created >= limit) break;
    if (hasReport.has(review.id)) continue;

    const repo = repoById.get(review.repository_id);
    const repositoryName =
      repo?.name || repo?.full_name?.split('/').pop() || 'repository';

    try {
      const analysis = await buildAnalysisPayloadForReview(review.id);
      await generateAndPersistReport({
        reviewId: review.id,
        repositoryId: review.repository_id,
        repositoryName,
        branch: review.branch,
        commitSha: review.commit_sha,
        triggeredBy: review.triggered_by,
        analysis,
      });
      created += 1;
      hasReport.add(review.id);
    } catch (err) {
      logger.error(`ensureMissingReportsForUser backfill failed: ${err.message}`, {
        reviewId: review.id,
      });
    }
  }

  if (created > 0) {
    logger.info(`Backfilled ${created} missing analysis report(s) for user ${userId}`);
  }

  return { created };
}

module.exports = {
  REPORTS_DIR,
  buildMarkdownReport,
  generateAndPersistReport,
  readReportMarkdown,
  readOrRegenerateReportMarkdown,
  regenerateReportMarkdownFromDb,
  deleteReportsForRepository,
  loadReviewIssues,
  buildAnalysisPayloadForReview,
  ensureMissingReportsForUser,
  countSeverities,
  isFixAvailable,
};
