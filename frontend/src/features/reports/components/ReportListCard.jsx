import { Link } from 'react-router-dom';
import { GitCommit, GitBranch } from 'lucide-react';
import { safeDistanceToNow } from '../../../lib/safeDates';
import { RemediationStatusBadge } from '../../../components/common/UI';

function severityLabel(summary) {
  if (!summary || typeof summary !== 'object') return null;
  const parts = [];
  if (summary.critical) parts.push(`${summary.critical} critical`);
  if (summary.warning) parts.push(`${summary.warning} warning`);
  if (summary.info) parts.push(`${summary.info} info`);
  if (summary.suggestion) parts.push(`${summary.suggestion} suggestion`);
  return parts.length ? parts.join(', ') : null;
}

export function ReportListCard({ report }) {
  const sev = severityLabel(report.severity_summary);
  const issueCount = report.issue_count ?? 0;

  return (
    <Link
      to={`/reports/${report.id}`}
      className="card card-interactive group flex flex-col p-5"
    >
      <div className="flex items-start gap-4">
        <div
          className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-full border-2 border-desk-border bg-desk-canvas text-center"
          aria-label={`${issueCount} issues in report`}
        >
          <span className="text-lg font-semibold tabular-nums leading-none text-gray-900 dark:text-gray-50">
            {issueCount}
          </span>
          <span className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-desk-muted">issues</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {report.commit_sha ? (
              <span className="flex items-center gap-1 font-mono text-[13px] font-semibold text-gray-900 dark:text-gray-100">
                <GitCommit size={12} className="text-desk-muted" aria-hidden="true" />
                {report.commit_sha.slice(0, 7)}
              </span>
            ) : (
              <span className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">
                {report.analysis_type || 'Code Analysis'}
              </span>
            )}
            <RemediationStatusBadge status={report.remediation_status} compact />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[11px] text-desk-muted">
            <span className="min-w-0 truncate" title={report.repository_name}>
              {report.repository_name}
            </span>
            {report.analyzed_branch && (
              <span className="inline-flex items-center gap-1 rounded border border-desk-border bg-desk-canvas px-1.5 py-0 text-desk-muted">
                <GitBranch size={10} aria-hidden="true" />
                {report.analyzed_branch}
              </span>
            )}
          </div>
          {sev && <p className="mt-2 text-[11px] text-desk-muted">{sev}</p>}
        </div>
      </div>
      <div className="mt-6 flex items-center justify-between border-t border-desk-border pt-4 text-[11px] text-gray-600 dark:text-desk-subtle">
        <span>Open report</span>
        <span className="tabular-nums">{safeDistanceToNow(report.created_at)}</span>
      </div>
    </Link>
  );
}
