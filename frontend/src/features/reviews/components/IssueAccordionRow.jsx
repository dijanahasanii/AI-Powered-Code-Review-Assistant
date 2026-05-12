import { useState } from 'react';
import { ChevronDown, FileCode, Lightbulb } from 'lucide-react';
import clsx from 'clsx';
import { SeverityBadge } from '../../../components/common/UI';
import { CATEGORY_DISPLAY, SEVERITY_META } from '../analysisConstants';

export function IssueAccordionRow({ issue, defaultOpen }) {
  const meta = SEVERITY_META[issue.severity] ?? SEVERITY_META.info;
  const Icon = meta.icon;
  const typeLabel = issue.category
    ? CATEGORY_DISPLAY[issue.category] ||
      `${issue.category.charAt(0).toUpperCase()}${issue.category.slice(1)}`
    : null;
  const hasSnippet =
    typeof issue.code_snippet === 'string' && issue.code_snippet.trim().length > 0;
  const [open, setOpen] = useState(Boolean(defaultOpen));

  return (
    <div
      className={clsx(
        'overflow-hidden rounded-lg border bg-desk-canvas shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.04]',
        meta.wrap
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 px-3 py-3 text-left sm:gap-4 sm:px-4"
        aria-expanded={open}
      >
        <Icon size={16} className={clsx('mt-0.5 shrink-0', meta.color)} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start gap-x-2 gap-y-1.5">
            <SeverityBadge severity={issue.severity} plainLanguage />
            {typeLabel && (
              <span className="inline-flex rounded border border-desk-border bg-desk-panel px-1.5 py-0 text-[11px] text-desk-muted">
                <span className="text-desk-muted">Topic:</span>
                <span className="ml-1 font-medium text-gray-800 dark:text-gray-200">{typeLabel}</span>
              </span>
            )}
            <span className="w-full basis-full break-words text-[13px] font-semibold leading-snug text-gray-900 dark:text-gray-100">
              {issue.title}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[11px] text-desk-muted">
            <span
              className="inline-flex max-w-[min(100%,28rem)] min-w-0 items-center truncate"
              title={issue.file_path}
            >
              <FileCode size={12} className="mr-1 shrink-0 text-desk-subtle" aria-hidden="true" />
              {issue.file_path ?? '—'}
            </span>
            <span className="text-desk-muted">:</span>
            <span className="tabular-nums text-brand-700 dark:text-brand-400">
              {issue.line_number != null && issue.line_number !== '' ? issue.line_number : '—'}
            </span>
          </div>
        </div>
        <ChevronDown
          size={18}
          className={clsx(
            'mt-1 shrink-0 text-desk-muted transition-transform duration-200',
            open && 'rotate-180'
          )}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="space-y-3 border-t border-desk-border px-3 pb-4 pt-3 sm:px-4">
          {hasSnippet && (
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-desk-muted">
                Matched line
              </p>
              <pre className="max-h-52 overflow-x-auto overflow-y-auto whitespace-pre-wrap break-all rounded-md border border-desk-border bg-[#010409] p-3 font-mono text-[12px] leading-relaxed text-[#79c0ff]">
                {issue.code_snippet.trim()}
              </pre>
            </div>
          )}

          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-desk-muted">
              Why you&apos;re seeing this
            </p>
            {issue.matched_rule ? (
              <p className="mb-2 text-[12px] leading-relaxed text-amber-950 dark:text-amber-200/90">
                <span className="text-desk-muted">What we checked: </span>
                {issue.matched_rule}
              </p>
            ) : null}
            <p className="text-sm leading-relaxed text-gray-800 dark:text-gray-300 break-words">{issue.description}</p>
          </div>

          {issue.suggestion && (
            <div className="rounded-md border border-brand-700/35 bg-brand-900/25 p-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-brand-700 dark:text-brand-400">
                <Lightbulb size={12} aria-hidden="true" />
                What to try
              </p>
              <p className="text-[12px] leading-relaxed text-gray-800 dark:text-gray-300">{issue.suggestion}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
