import { format } from 'date-fns';
import { GitBranch, GitCommit, Clock, Wrench } from 'lucide-react';
import clsx from 'clsx';
import { ScoreRing, RemediationStatusBadge, SeverityBadge } from '../../../components/common/UI';
import { SEVERITY_ORDER } from '../../reviews/analysisConstants';
import { shouldShowRemediationBadge } from '../lib/remediationDisplay';

function MetaChip({ icon: Icon, children, mono }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-lg border border-desk-border/80 bg-desk-canvas/60 px-2.5 py-1 text-xs text-desk-muted',
        mono && 'font-mono text-[11px]'
      )}
    >
      <Icon size={12} className="shrink-0 text-brand-400/80" aria-hidden="true" />
      <span className="text-gray-800 dark:text-gray-200">{children}</span>
    </span>
  );
}

export function ReportDetailHeader({
  report,
  overallScore,
  severitySummary,
  canApplyFixes,
  onApplyFixes,
}) {
  const s = severitySummary || {};
  const generated = report.created_at
    ? format(new Date(report.created_at), "MMM d, yyyy · HH:mm")
    : null;

  const remediationNote = ['running', 'validating', 'confirmed'].includes(report.remediation_status)
    ? 'Remediation is running — this page refreshes automatically.'
    : null;

  return (
    <header className="card mb-8 overflow-hidden p-0">
      <div className="border-b border-desk-border/80 bg-gradient-to-br from-desk-elevated/50 via-desk-panel to-desk-canvas/30 px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-1 gap-4">
            {overallScore != null && <ScoreRing score={overallScore} size={64} />}
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-400">
                {report.analysis_type || 'Analysis report'}
              </p>
              <h1 className="mt-0.5 text-xl font-bold tracking-tight text-gray-900 dark:text-gray-50 sm:text-2xl">
                {report.repository_name}
              </h1>
              {generated && (
                <p className="mt-1 flex items-center gap-1.5 text-sm text-desk-muted">
                  <Clock size={14} className="shrink-0 opacity-70" aria-hidden="true" />
                  {generated}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col items-stretch gap-2 sm:items-end sm:pt-1">
            {shouldShowRemediationBadge(report) && (
              <RemediationStatusBadge status={report.remediation_status} />
            )}
            {canApplyFixes && (
              <button
                type="button"
                className="btn-primary inline-flex items-center justify-center gap-2 px-4 py-2 text-sm"
                onClick={onApplyFixes}
              >
                <Wrench size={15} aria-hidden="true" />
                Apply fixes
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <MetaChip icon={GitBranch}>{report.analyzed_branch || 'main'}</MetaChip>
          {report.commit_sha && (
            <MetaChip icon={GitCommit} mono>
              {report.commit_sha.slice(0, 12)}
            </MetaChip>
          )}
          {report.push_commit_sha && (
            <MetaChip icon={GitCommit} mono>
              push {report.push_commit_sha.slice(0, 7)}
            </MetaChip>
          )}
        </div>

        {remediationNote && (
          <p className="mt-4 text-sm leading-relaxed text-desk-muted">{remediationNote}</p>
        )}
      </div>

      {(report.issue_count ?? 0) > 0 && (
        <div
          className="flex flex-wrap items-center gap-2 px-5 py-3 sm:px-6"
          aria-label="Severity breakdown"
        >
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-desk-muted">
            {report.issue_count} finding{report.issue_count !== 1 ? 's' : ''}
          </span>
          {SEVERITY_ORDER.map((sev) =>
            (s[sev] ?? 0) > 0 ? (
              <span
                key={sev}
                className="inline-flex items-center gap-1.5 rounded-full border border-desk-border bg-desk-canvas/80 px-2.5 py-0.5"
              >
                <SeverityBadge severity={sev} plainLanguage />
                <span className="tabular-nums text-xs font-medium text-desk-muted">{s[sev]}</span>
              </span>
            ) : null
          )}
        </div>
      )}
    </header>
  );
}
