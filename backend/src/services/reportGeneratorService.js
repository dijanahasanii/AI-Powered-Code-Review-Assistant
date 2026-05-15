'use strict';

const fs = require('fs/promises');
const path = require('path');
const { supabase } = require('../config/database');
const reportsRepository = require('../repositories/reportsRepository');
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
    `| Remediation status | ${remediationStatus} |`,
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
  const remediationStatus = 'pending';

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
 * Load issues for a review from DB (for remediation).
 */
async function loadReviewIssues(reviewId) {
  const { data, error } = await supabase
    .from('review_issues')
    .select('*')
    .eq('review_id', reviewId)
    .order('severity', { ascending: true });
  if (error) throw new Error(`loadReviewIssues: ${error.message}`);
  return data || [];
}

module.exports = {
  REPORTS_DIR,
  buildMarkdownReport,
  generateAndPersistReport,
  readReportMarkdown,
  loadReviewIssues,
  countSeverities,
  isFixAvailable,
};
