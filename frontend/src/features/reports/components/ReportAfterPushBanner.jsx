import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { CheckCircle2, ArrowRight } from 'lucide-react';

/**
 * Shown after remediation_status === 'pushed'. Clarifies that findings below are a
 * before-fix snapshot; post-fix results live under Reviews (direct review link comes later).
 */
export function ReportAfterPushBanner({ report }) {
  if (!report || report.remediation_status !== 'pushed') {
    return null;
  }

  const pushShort = report.push_commit_sha?.slice(0, 7);
  const pushedAt = report.pushed_at
    ? format(new Date(report.pushed_at), "MMM d, yyyy · HH:mm")
    : null;

  return (
    <section
      className="mb-8 rounded-xl border border-emerald-600/30 bg-emerald-500/[0.1] px-4 py-4 sm:px-5 sm:py-5 dark:border-emerald-500/35 dark:bg-emerald-500/[0.08]"
      aria-label="After fixes were pushed"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <CheckCircle2
            size={22}
            className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400"
            aria-hidden="true"
          />
          <div>
            <h2 className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">
              Fixes were pushed to GitHub
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-emerald-900/90 dark:text-emerald-100/85">
              {pushShort ? (
                <>
                  Fix commit <span className="font-mono font-medium">{pushShort}</span>
                  {pushedAt ? <> · {pushedAt}</> : null}.{' '}
                </>
              ) : pushedAt ? (
                <>Pushed {pushedAt}. </>
              ) : null}
              The score and issue list on this page are from <strong className="font-medium">before</strong> the fix —
              they do not update automatically.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-emerald-900/80 dark:text-emerald-100/75">
              To see how the code looks after the fix, open <strong className="font-medium">Repositories</strong>, click{' '}
              <strong className="font-medium">Review latest</strong> for this repo (branch{' '}
              <code className="font-mono text-[0.9em]">main</code> or the one you pushed), then check{' '}
              <strong className="font-medium">Reviews</strong> for the new run when it completes.
            </p>
          </div>
        </div>

        <Link
          to="/repositories"
          className="btn-secondary inline-flex shrink-0 items-center justify-center gap-2 self-start border-emerald-600/25 bg-white/60 px-4 py-2 text-sm font-medium text-emerald-950 hover:bg-white/90 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-50 dark:hover:bg-emerald-950/60"
        >
          Repositories · Review latest
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
