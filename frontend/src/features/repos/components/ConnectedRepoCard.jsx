import {
  Lock,
  Globe,
  Activity,
  RefreshCw,
  Sparkles,
  Trash2,
  AlertOctagon,
} from 'lucide-react';
import { Spinner } from '../../../components/common/UI';
import { getCompletedReviewsNewestFirst, repoHealthStatus } from '../lib/repoReviewStats';

export function ConnectedRepoCard({
  repo,
  busyReviewRepoId,
  busySyncWebhookId,
  syncAllWebhooksPending,
  disconnectPending,
  onReviewLatest,
  onSyncWebhook,
  onDisconnect,
}) {
  const completedReviews = getCompletedReviewsNewestFirst(repo);
  const latestScore = completedReviews[0]?.overall_score;
  const status = repoHealthStatus(repo);

  return (
    <div role="listitem" className="card card-interactive flex flex-col p-5">
      <div className="flex items-start justify-between gap-3 border-b border-desk-border pb-4">
        <div className="flex min-w-0 items-start gap-3">
          {repo.is_private ? (
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-desk-border bg-desk-canvas">
              <Lock size={16} className="text-desk-muted" aria-label="Private repository" />
            </div>
          ) : (
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-desk-border bg-desk-canvas">
              <Globe size={16} className="text-desk-muted" aria-label="Public repository" />
            </div>
          )}
          <div className="min-w-0">
            <p
              className="truncate font-mono text-[13px] font-semibold leading-snug text-gray-900 dark:text-gray-50"
              title={repo.full_name}
            >
              {repo.full_name}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${status.className}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} aria-hidden="true" />
                {status.label}
              </span>
            </div>
          </div>
        </div>
      </div>

      <dl className="mt-4 grid gap-3 text-[12px]">
        <div className="flex items-start gap-2 text-desk-muted">
          <Activity size={14} className="mt-0.5 shrink-0 opacity-70" aria-hidden="true" />
          <div>
            <dt className="sr-only">Status detail</dt>
            <dd className="text-gray-700 dark:text-gray-300">{status.detail}</dd>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-desk-muted">
          {repo.language && (
            <span className="rounded border border-desk-border bg-desk-canvas px-1.5 py-0">{repo.language}</span>
          )}
          <span className="tabular-nums">{repo.code_reviews?.length ?? 0} review runs</span>
          {completedReviews.length > 0 &&
            (latestScore != null ? (
              <span className="tabular-nums text-gray-600 dark:text-gray-400">Latest {latestScore}/100</span>
            ) : (
              <span className="tabular-nums text-gray-600 dark:text-gray-500">Latest · not scored</span>
            ))}
        </div>
      </dl>

      {status.key === 'webhook' && (
        <>
          <p className="mt-4 flex gap-2 rounded-md border border-amber-500/25 bg-amber-500/5 p-3 text-[11px] leading-snug text-amber-950 dark:text-amber-50/95">
            <AlertOctagon size={14} className="mt-0.5 shrink-0 opacity-90" aria-hidden="true" />
            Use Install webhook once <code className="font-mono text-amber-900 dark:text-amber-200/95">BACKEND_URL</code> is public
            and ngrok is running — or disconnect/reconnect after env changes.
          </p>
          <button
            type="button"
            aria-label={`Install GitHub webhook for ${repo.full_name}`}
            aria-busy={busySyncWebhookId === repo.id}
            className="btn-secondary mt-3 w-full justify-center gap-2 border border-amber-500/30 px-3 py-2 text-xs font-semibold hover:border-amber-400/50"
            disabled={busySyncWebhookId === repo.id || syncAllWebhooksPending || disconnectPending}
            onClick={() => onSyncWebhook(repo.id)}
          >
            {busySyncWebhookId === repo.id ? <Spinner size="sm" /> : <RefreshCw size={14} aria-hidden="true" />}
            Install webhook
          </button>
        </>
      )}

      <div className="mt-auto flex gap-2 border-t border-desk-border pt-4">
        <button
          type="button"
          title="Review latest commit on default branch"
          aria-label={`Review latest commit for ${repo.full_name}`}
          aria-busy={busyReviewRepoId === repo.id}
          onClick={() => onReviewLatest(repo.id)}
          disabled={
            busyReviewRepoId === repo.id || disconnectPending || syncAllWebhooksPending
          }
          className="btn-secondary inline-flex min-h-[2.25rem] min-w-0 flex-1 items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium"
        >
          {busyReviewRepoId === repo.id ? <Spinner size="sm" /> : <Sparkles size={13} aria-hidden="true" />}
          <span className="truncate">Review latest</span>
        </button>
        <button
          type="button"
          aria-label={`Disconnect ${repo.full_name}`}
          onClick={() => onDisconnect(repo)}
          disabled={disconnectPending}
          className="rounded-md border border-transparent p-2 text-desk-muted transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-40"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}
