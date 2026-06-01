import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { safeDistanceToNow } from '../lib/safeDates';
import { ClipboardList, GitCommit, ChevronLeft, ChevronRight, GitBranch } from 'lucide-react';
import clsx from 'clsx';
import { reviewsApi } from '../api/client';
import { describeApiFailure } from '../lib/apiErrors';
import { useAuth } from '../context/AuthContext';
import { ScoreRing, StatusBadge, EmptyState, PageHeader } from '../components/common/UI';
import { ReviewCardSkeleton } from '../components/common/Skeletons';
import { queryKeys } from '../lib/queryKeys';

const STATUS_FILTERS = ['all', 'completed', 'processing', 'pending', 'failed'];
const LIMIT = 15;

export default function ReviewsPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);

  const { data, isPending, isFetching, isError, error, refetch } = useQuery({
    queryKey: queryKeys.reviewsList({ status, page, limit: LIMIT }),
    queryFn: () =>
      reviewsApi.list({ ...(status !== 'all' && { status }), page, limit: LIMIT }).then((r) => r.data),
    staleTime: 15_000,
    refetchOnMount: 'always',
    placeholderData: (prev, prevQuery) => {
      const prevKey = prevQuery?.queryKey;
      const nextKey = queryKeys.reviewsList({ status, page, limit: LIMIT });
      if (
        prevKey?.[0] === nextKey[0] &&
        prevKey?.[1]?.page === nextKey[1]?.page &&
        prevKey?.[1]?.status === nextKey[1]?.status
      ) {
        return prev;
      }
      return undefined;
    },
  });

  const reviews = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const showReviewsSkeleton = !isError && isPending && data === undefined;

  const handleStatusChange = (next) => {
    setStatus(next);
    setPage(1);
  };

  const loadError = isError ? describeApiFailure(error, { resourceLabel: 'the reviews list' }) : null;

  const emptyDescription =
    status !== 'all'
      ? `No ${status} reviews. Try a different filter or trigger a manual run from Repositories.`
      : 'Push code to a connected repository or use “Review latest” on Repositories to pick a branch.';

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader
        title="Reviews"
        description={total > 0 ? `${total} review${total !== 1 ? 's' : ''} total` : 'Browse every queued and completed AI review'}
        hint={
          user?.username
            ? `Runs for workspaces linked while signed in as @${user.username}. Use filters below to narrow by status.`
            : 'Use filters to narrow queued and completed runs by status.'
        }
      />

      <div className="mb-6 inline-flex flex-wrap gap-1 rounded-md border border-desk-border bg-desk-panel p-1" role="group" aria-label="Filter by status">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => handleStatusChange(s)}
            aria-pressed={status === s}
            className={clsx(
              'rounded px-3 py-1.5 text-xs font-medium capitalize transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/55 focus-visible:ring-offset-2 focus-visible:ring-offset-desk-panel dark:focus-visible:ring-offset-desk-canvas',
              status === s
                ? 'bg-desk-elevated text-gray-900 shadow-sm ring-1 ring-desk-border dark:text-gray-50'
                : 'text-desk-muted hover:bg-desk-canvas hover:text-gray-800 dark:hover:text-gray-200'
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {isError && loadError ? (
        <div className="card overflow-hidden p-10 text-center" role="alert" aria-live="polite">
          <p className="mb-1 text-sm font-semibold text-red-900 dark:text-red-200">{loadError.title}</p>
          <p className="mb-3 text-sm text-red-800 dark:text-red-300">{loadError.detail}</p>
          <button type="button" className="btn-secondary px-4 py-2 text-xs" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      ) : showReviewsSkeleton ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ReviewCardSkeleton key={i} />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="card overflow-hidden">
          <EmptyState
            icon={ClipboardList}
            title="No reviews found"
            description={emptyDescription}
            action={
              <Link
                to="/repositories"
                className="btn-secondary inline-flex px-4 py-2 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/55 focus-visible:ring-offset-2 focus-visible:ring-offset-desk-canvas dark:focus-visible:ring-offset-desk-panel"
              >
                Go to repositories
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <div
            className={clsx(
              'max-h-none overflow-visible lg:max-h-[min(32rem,calc(100vh-14rem))] lg:overflow-y-auto lg:overscroll-contain lg:pr-1',
              isFetching && data ? 'opacity-70' : '',
              'transition-opacity'
            )}
          >
          <div
            className={clsx(
              'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'
            )}
          >
            {reviews.map((review) => (
              <Link
                key={review.id}
                to={`/reviews/${review.id}`}
                className="card card-interactive group flex flex-col p-5"
              >
                <div className="flex items-start gap-4">
                  <ScoreRing score={review.overall_score} size={48} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex items-center gap-1 font-mono text-[13px] font-semibold text-gray-900 dark:text-gray-100">
                        <GitCommit size={12} className="text-desk-muted" aria-hidden="true" />
                        {review.commit_sha?.slice(0, 7)}
                      </span>
                      <StatusBadge status={review.status} compact />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[11px] text-desk-muted">
                      <span className="min-w-0 truncate" title={review.repositories?.full_name || undefined}>
                        {review.repositories?.full_name}
                      </span>
                      {review.branch && (
                        <span className="inline-flex items-center gap-1 rounded border border-desk-border bg-desk-canvas px-1.5 py-0 text-desk-muted">
                          <GitBranch size={10} aria-hidden="true" />
                          {review.branch}
                        </span>
                      )}
                    </div>
                    {review.author && (
                      <p className="mt-2 truncate text-[11px] text-desk-subtle">{review.author}</p>
                    )}
                    {review.pr_number && (
                      <p className="mt-2 text-[11px] font-medium text-brand-400">PR #{review.pr_number}</p>
                    )}
                  </div>
                </div>
                <div className="mt-6 flex items-center justify-between border-t border-desk-border pt-4 text-[11px] text-gray-600 dark:text-desk-subtle">
                  <span>Open analysis</span>
                  <span className="tabular-nums">{safeDistanceToNow(review.created_at)}</span>
                </div>
              </Link>
            ))}
          </div>
          </div>

          {totalPages > 1 && (
            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-desk-muted">
                Page {page} of {totalPages} · {total} reviews
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  aria-label="Previous page"
                  className="btn-secondary p-2 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/55 focus-visible:ring-offset-2 focus-visible:ring-offset-desk-canvas dark:focus-visible:ring-offset-desk-panel"
                >
                  <ChevronLeft size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  aria-label="Next page"
                  className="btn-secondary p-2 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/55 focus-visible:ring-offset-2 focus-visible:ring-offset-desk-canvas dark:focus-visible:ring-offset-desk-panel"
                >
                  <ChevronRight size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
