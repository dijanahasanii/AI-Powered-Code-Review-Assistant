import { useMemo } from 'react';
import { SEVERITY_ORDER } from '../../reviews/analysisConstants';

const WRAP = {
  clean:
    'border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.08] to-transparent dark:from-emerald-500/[0.12]',
  attention:
    'border-amber-500/25 bg-gradient-to-br from-amber-500/[0.08] to-transparent dark:from-amber-500/[0.1]',
  serious:
    'border-red-500/28 bg-gradient-to-br from-red-500/[0.1] to-transparent dark:from-red-500/[0.12]',
};

export function ReportHeroBanner({ issueCount, severitySummary, remediationStatus }) {
  const issueCounts = useMemo(() => {
    const s = severitySummary || {};
    return {
      critical: s.critical ?? 0,
      warning: s.warning ?? 0,
      info: s.info ?? 0,
      suggestion: s.suggestion ?? 0,
    };
  }, [severitySummary]);

  const copy = useMemo(() => {
    if (issueCount === 0) {
      return {
        wrap: WRAP.clean,
        headline: 'Clean scan — no issues recorded',
        sub: 'This report is saved as your audit trail. You can still review the full analysis below.',
      };
    }

    const parts = SEVERITY_ORDER.filter((k) => issueCounts[k] > 0).map((k) => {
      const n = issueCounts[k];
      const labels = {
        critical: `${n} critical`,
        warning: `${n} warning`,
        info: `${n} info`,
        suggestion: `${n} suggestion`,
      };
      return labels[k];
    });

    const wrap = issueCounts.critical > 0 ? WRAP.serious : WRAP.attention;
    const headline =
      issueCount === 1 ? '1 finding needs your attention' : `${issueCount} findings in this report`;
    let sub = parts.join(' · ') + '. Review details below before applying fixes.';
    if (remediationStatus === 'pushed') {
      sub = 'Remediation was applied and pushed to the analyzed branch.';
    } else if (['running', 'validating', 'confirmed'].includes(remediationStatus)) {
      sub = 'Remediation is in progress — status updates automatically.';
    }

    return { wrap, headline, sub };
  }, [issueCount, issueCounts, remediationStatus]);

  return (
    <div
      className={`mb-6 rounded-2xl border px-5 py-4 sm:px-6 sm:py-5 ${copy.wrap}`}
      role="status"
    >
      <p className="text-base font-semibold tracking-tight text-gray-900 dark:text-gray-50 sm:text-lg">
        {copy.headline}
      </p>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-desk-muted">{copy.sub}</p>
    </div>
  );
}
