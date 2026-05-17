import { Link } from 'react-router-dom';
import { ArrowRight, Loader2, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import { ScoreRing } from '../../../components/common/UI';

/**
 * @param {object} props
 * @param {object} props.followUp - from GET /api/reports/:id
 * @param {boolean} props.rescanPending
 * @param {() => void} [props.onRescan]
 */
export function PostRemediationUpdateBanner({ followUp, rescanPending, onRescan }) {
  if (!followUp) return null;

  const originalIssues = followUp.originalIssueCount;
  const newIssues = followUp.displayIssueCount ?? followUp.issueCount;
  const scannedIssues = followUp.scannedIssueCount ?? followUp.issueCount;
  const originalScore = followUp.originalScore;
  const newScore = followUp.displayScore ?? followUp.overallScore;
  const scannedScore = followUp.scannedScore ?? followUp.overallScore;
  const regression = Boolean(followUp.regression);
  const inProgress = ['pending', 'processing'].includes(followUp.status);
  const done = followUp.status === 'completed';
  const missing = followUp.status === 'pending' && !followUp.reviewId;

  const scoreImproved =
    done &&
    !regression &&
    originalScore != null &&
    newScore != null &&
    Number(newScore) > Number(originalScore);
  const issuesReduced =
    done &&
    !regression &&
    originalIssues != null &&
    newIssues != null &&
    newIssues < originalIssues;

  let title = 'Checking your fixed code…';
  let body =
    'This page still shows the old review from before Apply fixes. A new scan is running on the commit that was pushed to GitHub.';

  if (missing) {
    title = 'Get an updated score';
    body =
      'Fixes were pushed, but this report has not been re-scanned yet. Run a new scan to see your updated rating and issue count.';
  } else if (done && regression) {
    title = 'Re-scan did not improve — showing your previous results';
    body = `GitHub scan found ${scannedIssues ?? 'more'} issue(s) (score ${scannedScore ?? '—'}). We keep showing ${originalIssues ?? 'your'} issue(s) and score ${originalScore ?? '—'} so the numbers do not go backwards. Fix the remaining items manually, then run Review latest.`;
  } else if (done) {
    title = 'Updated results after your fixes';
    body =
      'Fresh scan of what is on GitHub now. Open the updated report to see what is still left.';
  } else if (inProgress) {
    title = 'Scanning your fixed code…';
    body = 'Hang tight — we are re-running the analyzer on the commit you pushed.';
  }

  return (
    <section
      className={clsx(
        'mb-8 overflow-hidden rounded-2xl border px-4 py-4 sm:px-5',
        done && regression
          ? 'border-amber-500/30 bg-amber-500/[0.08]'
          : done && (scoreImproved || issuesReduced)
            ? 'border-green-500/30 bg-green-500/[0.08]'
            : 'border-brand-500/25 bg-brand-500/[0.06]'
      )}
      aria-live="polite"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">{title}</p>
          <p className="mt-1 text-sm leading-relaxed text-desk-muted">{body}</p>

          {done && (originalScore != null || originalIssues != null) && (
            <div className="mt-4 flex flex-wrap items-center gap-6">
              {originalScore != null && newScore != null && (
                <div className="flex items-center gap-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-desk-muted">Score</p>
                  <div className="opacity-60">
                    <ScoreRing score={originalScore} size={44} />
                  </div>
                  <ArrowRight size={16} className="text-desk-muted" aria-hidden="true" />
                  <div className={scoreImproved ? 'rounded-full ring-2 ring-green-500/40' : ''}>
                    <ScoreRing score={newScore} size={52} />
                  </div>
                </div>
              )}
              {originalIssues != null && newIssues != null && (
                <div className="text-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-desk-muted">
                    Issues found
                  </p>
                  <p className="mt-1 font-semibold tabular-nums text-gray-900 dark:text-gray-50">
                    <span className={issuesReduced ? 'text-green-600 dark:text-green-400' : ''}>
                      {newIssues}
                    </span>
                    <span className="mx-1.5 font-normal text-desk-muted">was</span>
                    <span className="text-desk-muted line-through">{originalIssues}</span>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          {done && followUp.reportId && (
            <Link
              to={`/reports/${followUp.reportId}`}
              className="btn-primary inline-flex items-center justify-center gap-2 px-4 py-2 text-sm"
            >
              Open updated report
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          )}
          {done && followUp.reviewId && !followUp.reportId && (
            <Link
              to={`/reviews/${followUp.reviewId}`}
              className="btn-primary inline-flex items-center justify-center gap-2 px-4 py-2 text-sm"
            >
              Open updated review
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          )}
          {(missing || (!inProgress && !done && onRescan)) && (
            <button
              type="button"
              className="btn-secondary inline-flex items-center justify-center gap-2 px-4 py-2 text-sm"
              disabled={rescanPending}
              onClick={onRescan}
            >
              {rescanPending ? (
                <Loader2 size={15} className="animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw size={15} aria-hidden="true" />
              )}
              {rescanPending ? 'Starting…' : 'Re-scan fixed code'}
            </button>
          )}
          {inProgress && (
            <span className="inline-flex items-center gap-2 text-sm text-desk-muted">
              <Loader2 size={16} className="animate-spin text-brand-400" aria-hidden="true" />
              Re-scan in progress
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
