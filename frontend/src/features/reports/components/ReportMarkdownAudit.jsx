import { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FileArchive, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { Spinner } from '../../../components/common/UI';

function markdownForArchiveView(raw) {
  if (!raw?.trim()) return '';
  const issuesIdx = raw.indexOf('## Issues');
  if (issuesIdx >= 0) return raw.slice(issuesIdx).trim();
  const remediationIdx = raw.indexOf('## Remediation');
  if (remediationIdx >= 0) return raw.slice(remediationIdx).trim();
  return raw.trim();
}

export function ReportMarkdownAudit({ markdown, isLoading, isError, reportPath }) {
  const [open, setOpen] = useState(false);
  const displayMd = useMemo(() => markdownForArchiveView(markdown), [markdown]);
  const fileLabel = reportPath?.replace(/^reports\//, '') || 'report.md';

  return (
    <section
      id="audit-document"
      className="scroll-mt-24 overflow-hidden rounded-2xl border border-desk-border bg-gradient-to-b from-desk-panel to-desk-canvas/40 shadow-sm"
      aria-label="Persisted report archive"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-desk-elevated/30 sm:px-6 sm:py-5"
        aria-expanded={open}
        aria-controls="report-archive-panel"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand-500/25 bg-brand-500/10">
          <FileArchive size={18} className="text-brand-400" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-desk-muted">Archive</p>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">Persisted report file</h2>
          <p className="mt-1 text-sm text-desk-muted">
            Server-side markdown for audit history. The interactive sections above are the primary view.
          </p>
          <p className="mt-2 font-mono text-[11px] text-desk-subtle">{fileLabel}</p>
        </div>
        <ChevronDown
          size={20}
          className={clsx('mt-1 shrink-0 text-desk-muted transition-transform duration-200', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div id="report-archive-panel" className="border-t border-desk-border px-4 pb-5 pt-2 sm:px-6 sm:pb-6">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : isError ? (
            <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              Could not load the markdown report file.
            </p>
          ) : !displayMd ? (
            <p className="text-sm text-desk-muted">No archive content available.</p>
          ) : (
            <div className="relative">
              <div className="report-markdown report-markdown-archive max-h-[min(32rem,55vh)] overflow-y-auto overscroll-contain rounded-xl border border-desk-border bg-desk-canvas/90 px-4 py-5 sm:px-6 sm:py-6">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayMd}</ReactMarkdown>
              </div>
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-14 rounded-b-xl bg-gradient-to-t from-desk-canvas via-desk-canvas/80 to-transparent"
                aria-hidden="true"
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
