import { format } from 'date-fns';
import {
  FolderGit2,
  GitBranch,
  GitCommit,
  Clock,
  FileText,
  CheckCircle2,
} from 'lucide-react';
import { RemediationStatusBadge } from '../../../components/common/UI';

function MetaRow({ icon: Icon, label, value, mono = false, children }) {
  return (
    <div className="flex gap-3 border-b border-desk-border/80 py-3 last:border-0 last:pb-0 first:pt-0">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-desk-border bg-desk-canvas">
        <Icon size={15} className="text-brand-400/90" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-desk-muted">{label}</p>
        {children || (
          <p
            className={`mt-0.5 text-sm font-medium text-gray-900 dark:text-gray-50 ${mono ? 'truncate font-mono text-[13px]' : ''}`}
            title={typeof value === 'string' ? value : undefined}
          >
            {value}
          </p>
        )}
      </div>
    </div>
  );
}

export function ReportMetadataPanel({ report }) {
  const generated = report.created_at
    ? format(new Date(report.created_at), 'MMM d, yyyy · HH:mm')
    : '—';

  return (
    <div>
      <section className="card overflow-hidden">
        <div className="border-b border-desk-border bg-desk-elevated/40 px-4 py-3 sm:px-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-desk-muted">Report details</h2>
        </div>
        <div className="px-4 py-3 sm:px-5 sm:py-4">
          <MetaRow icon={FolderGit2} label="Repository" value={report.repository_name} />
          <MetaRow icon={FileText} label="Analysis type" value={report.analysis_type || 'Code Analysis'} />
          <MetaRow icon={GitBranch} label="Branch" value={report.analyzed_branch || 'main'} mono />
          {report.commit_sha && (
            <MetaRow icon={GitCommit} label="Analyzed commit" value={report.commit_sha.slice(0, 12)} mono />
          )}
          <MetaRow icon={Clock} label="Generated" value={generated} />
          <MetaRow icon={CheckCircle2} label="Remediation">
            <div className="mt-1.5">
              <RemediationStatusBadge status={report.remediation_status} />
            </div>
          </MetaRow>
          {report.push_commit_sha && (
            <MetaRow
              icon={GitCommit}
              label="Push commit"
              value={`${report.push_commit_sha.slice(0, 7)}${report.pushed_at ? ` · ${format(new Date(report.pushed_at), 'MMM d HH:mm')}` : ''}`}
              mono
            />
          )}
        </div>
      </section>
    </div>
  );
}
