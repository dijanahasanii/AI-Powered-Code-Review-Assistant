import { useEffect, useState } from 'react';
import { Terminal, ChevronDown } from 'lucide-react';
import clsx from 'clsx';

const AUTO_OPEN_STATUSES = new Set(['failed', 'running', 'validating', 'confirmed']);

export function ReportRemediationLog({ log, status }) {
  const shouldDefaultOpen = AUTO_OPEN_STATUSES.has(status);
  const [open, setOpen] = useState(shouldDefaultOpen);

  useEffect(() => {
    if (shouldDefaultOpen) setOpen(true);
  }, [shouldDefaultOpen, status]);

  if (!log?.trim()) return null;

  const isActive = ['running', 'validating', 'confirmed'].includes(status);
  const isFailed = status === 'failed';

  return (
    <section
      id="remediation-log"
      className={clsx(
        'scroll-mt-24 overflow-hidden rounded-2xl border shadow-sm',
        isFailed
          ? 'border-red-500/25 bg-gradient-to-b from-red-500/[0.06] to-desk-canvas/40'
          : 'border-desk-border bg-gradient-to-b from-desk-panel to-desk-canvas/40'
      )}
      aria-label="Remediation activity log"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-desk-elevated/30 sm:px-6 sm:py-5"
        aria-expanded={open}
        aria-controls="remediation-log-panel"
      >
        <div
          className={clsx(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border',
            isFailed ? 'border-red-500/25 bg-red-500/10' : 'border-desk-border bg-desk-elevated/50'
          )}
        >
          <Terminal
            size={18}
            className={clsx(isFailed ? 'text-red-400' : isActive ? 'text-amber-400' : 'text-desk-muted')}
            aria-hidden="true"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-desk-muted">Technical</p>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">Remediation log</h2>
          <p className="mt-1 text-sm text-desk-muted">
            {isActive
              ? 'Live trace while fixes are applied and validated.'
              : isFailed
                ? 'Step-by-step output from the last failed push attempt.'
                : 'Clone, patch, validate, and push steps from Apply fixes.'}
          </p>
        </div>
        <ChevronDown
          size={20}
          className={clsx('mt-1 shrink-0 text-desk-muted transition-transform duration-200', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div id="remediation-log-panel" className="border-t border-desk-border/80 px-4 pb-5 pt-2 sm:px-6 sm:pb-6">
          <pre
            className={clsx(
              'max-h-[min(20rem,50vh)] overflow-auto whitespace-pre-wrap rounded-xl border px-4 py-3 font-mono text-[11px] leading-relaxed',
              isFailed
                ? 'border-red-500/20 bg-black/25 text-red-100/90'
                : 'border-desk-border bg-desk-canvas/90 text-desk-muted',
              isActive && 'animate-pulse'
            )}
          >
            {log}
          </pre>
        </div>
      )}
    </section>
  );
}
