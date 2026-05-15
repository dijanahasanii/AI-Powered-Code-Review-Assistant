import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { SeverityBadge } from '../../../components/common/UI';
import { SEVERITY_ORDER } from '../analysisConstants';
import { IssueAccordionRow } from './IssueAccordionRow';

export function CategoryAccordion({ bucket, issues, initiallyOpen }) {
  const BucketIcon = bucket.icon;
  const [open, setOpen] = useState(initiallyOpen);
  const sevHints = useMemo(() => {
    const c = {};
    issues.forEach((i) => {
      if (i.severity) c[i.severity] = (c[i.severity] || 0) + 1;
    });
    return c;
  }, [issues]);

  return (
    <section
      className="card overflow-hidden"
      aria-label={`${bucket.title}: ${issues.length} issues`}
      id={`analysis-${bucket.id}`}
    >
      <button
        type="button"
        className="flex w-full flex-col gap-1 border-b border-desk-border px-4 py-3.5 text-left transition-colors hover:bg-desk-elevated/40 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-desk-border bg-desk-canvas">
            <BucketIcon size={17} className="text-gray-600 dark:text-gray-300" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[13px] font-semibold tracking-tight text-gray-900 dark:text-gray-50">
                {bucket.title}
              </h3>
              <span className="rounded-full border border-desk-border bg-desk-elevated px-2 py-0.5 text-[11px] font-medium tabular-nums text-desk-muted">
                {issues.length} issue{issues.length !== 1 ? 's' : ''}
              </span>
            </div>
            <p className="mt-0.5 text-[12px] text-desk-muted">{bucket.description}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 pl-12 sm:pl-0">
          <div className="flex flex-wrap gap-1.5">
            {SEVERITY_ORDER.filter((s) => sevHints[s] > 0).map((sev) => (
              <span key={sev} className="tabular-nums">
                <SeverityBadge severity={sev} />
                <span className="ml-0.5 align-middle text-[11px] text-desk-muted">{sevHints[sev]}</span>
              </span>
            ))}
          </div>
          <ChevronDown
            size={18}
            className={clsx('text-desk-muted transition-transform duration-200', open && 'rotate-180')}
            aria-hidden="true"
          />
        </div>
      </button>
      {open && (
        <div className="max-h-72 overflow-y-auto overscroll-contain border-t border-desk-border p-3 sm:max-h-80 sm:p-4">
          <div className="space-y-2">
            {issues.map((issue, i) => (
              <IssueAccordionRow
                key={issue.id ?? `${bucket.id}-${i}-${issue.line_number ?? 'x'}`}
                issue={issue}
                defaultOpen={false}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
