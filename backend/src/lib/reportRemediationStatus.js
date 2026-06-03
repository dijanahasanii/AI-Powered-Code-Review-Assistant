'use strict';

/**
 * Remediation lifecycle for analysis_reports.
 * not_needed — zero active issues; no Apply fixes / no pending badge.
 */
function remediationStatusForIssueCount(issueCount) {
  return (Number(issueCount) || 0) > 0 ? 'pending' : 'not_needed';
}

function normalizeReportRemediation(report) {
  if (!report) return report;
  const count = Number(report.issue_count) || 0;
  if (count === 0) {
    const status = report.remediation_status;
    if (!status || status === 'pending') {
      return { ...report, remediation_status: 'not_needed' };
    }
  }
  return report;
}

function formatRemediationStatusLabel(status) {
  if (status === 'not_needed') return 'Not needed (no active findings)';
  if (status === 'pushed') return 'Fixes pushed';
  return status || '—';
}

module.exports = {
  remediationStatusForIssueCount,
  normalizeReportRemediation,
  formatRemediationStatusLabel,
};
