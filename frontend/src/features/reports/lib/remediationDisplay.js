/**
 * UI helpers for analysis_reports.remediation_status.
 */

export function effectiveRemediationStatus(report) {
  if (!report) return null;
  const count = Number(report.issue_count) || 0;
  if (count === 0) {
    const status = report.remediation_status;
    if (!status || status === 'pending') return 'not_needed';
  }
  return report.remediation_status;
}

/** Hide badge when there is nothing to remediate. */
export function shouldShowRemediationBadge(report) {
  const status = effectiveRemediationStatus(report);
  return status && status !== 'not_needed';
}
