import { useMemo } from 'react';
import { SEVERITY_ORDER } from '../analysisConstants';

const PHRASE = {
  critical: (n) => `${n} serious`,
  warning: (n) => `${n} need attention`,
  info: (n) => `${n} FYI`,
  suggestion: (n) => `${n} suggestion${n === 1 ? '' : 's'}`,
};

const WRAP = {
  clean:
    'border-emerald-500/25 bg-emerald-500/[0.07] dark:border-emerald-500/30 dark:bg-emerald-500/[0.08]',
  attention:
    'border-amber-500/25 bg-amber-500/[0.07] dark:border-amber-500/28 dark:bg-amber-500/[0.06]',
  serious:
    'border-red-500/28 bg-red-500/[0.07] dark:border-red-500/35 dark:bg-red-500/[0.08]',
};

/**
 * Plain-language headline for completed reviews so the takeaway is obvious before
 * scores, commit metadata, and the technical summary.
 */
export function ReviewVerdictBanner({ status, issueCounts, totalIssues }) {
  const copy = useMemo(() => {
    if (status !== 'completed') return null;

    if (totalIssues === 0) {
      return {
        wrap: WRAP.clean,
        headline: 'Nothing flagged this time',
        sub:
          'Our checks did not report issues for this run. The summary below still describes the change — worth a quick read.',
      };
    }

    const parts = SEVERITY_ORDER.filter((s) => issueCounts[s] > 0).map((s) => PHRASE[s](issueCounts[s]));
    const headline =
      totalIssues === 1 ? 'We found 1 thing to look at' : `We found ${totalIssues} things to look at`;
    const sub = `${parts.join(' · ')}. Scroll to “What we found” for titles, snippets, and rules.`;
    const wrap = issueCounts.critical > 0 ? WRAP.serious : WRAP.attention;

    return { wrap, headline, sub };
  }, [status, issueCounts, totalIssues]);

  if (!copy) return null;

  return (
    <div
      className={`mb-5 rounded-xl border px-4 py-3.5 sm:px-5 sm:py-4 ${copy.wrap}`}
      role="status"
      aria-live="polite"
    >
      <p className="text-[15px] font-semibold leading-snug text-gray-900 dark:text-gray-50">{copy.headline}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-desk-muted">{copy.sub}</p>
    </div>
  );
}
