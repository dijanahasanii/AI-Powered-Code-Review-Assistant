import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { safeDistanceToNow } from '../utils/safeDates';
import { ClipboardList, GitCommit, ChevronLeft, ChevronRight, GitBranch } from 'lucide-react';
import { reviewsApi } from '../api/client';
import { ScoreRing, StatusBadge, EmptyState, PageHeader } from '../components/common/UI';
import { ReviewRowSkeleton } from '../components/common/Skeletons';

const STATUS_FILTERS = ['all', 'completed', 'processing', 'pending', 'failed'];
const LIMIT = 15;

export default function ReviewsPage() {
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);

  const { data, isLoading, isPlaceholderData, isError, refetch } = useQuery({
    queryKey: ['reviews', { status, page, limit: LIMIT }],
    queryFn: () =>
      reviewsApi.list({ ...(status !== 'all' && { status }), page, limit: LIMIT }).then((r) => r.data),
    placeholderData: (prev) => prev,
  });

  const reviews = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const handleStatusChange = (next) => {
    setStatus(next);
    setPage(1);
  };

  const emptyDescription =
    status !== 'all'
      ? `No ${status} reviews. Try a different filter or trigger a manual run from Repositories.`
      : 'Push code to a connected repository or use “Review latest” on Repositories for the default branch.';

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Reviews"
        description={total > 0 ? `${total} review${total !== 1 ? 's' : ''} total` : 'Browse every queued and completed AI review'}
      />

      <div className="flex gap-1.5 mb-5 flex-wrap" role="group" aria-label="Filter by status">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => handleStatusChange(s)}
            aria-pressed={status === s}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 ${
              status === s
                ? 'bg-brand-600 text-white shadow-sm'
                : 'bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700'
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {isError ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-red-300 mb-3">Could not load reviews. Check your connection and try again.</p>
          <button type="button" className="btn-secondary text-xs py-2 px-4" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      ) : isLoading ? (
        <div className="card divide-y divide-gray-800">
          {Array.from({ length: 8 }).map((_, i) => (
            <ReviewRowSkeleton key={i} />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No reviews found"
          description={emptyDescription}
        />
      ) : (
        <>
          <div
            className={`card divide-y divide-gray-800 ${
              isPlaceholderData ? 'opacity-70' : ''
            } transition-opacity`}
          >
            {reviews.map((review) => (
              <Link
                key={review.id}
                to={`/reviews/${review.id}`}
                className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-4 hover:bg-gray-800/40 transition-colors"
              >
                <ScoreRing score={review.overall_score} size={42} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="flex items-center gap-1.5 text-sm font-mono font-medium text-gray-200">
                      <GitCommit size={12} className="text-gray-500 shrink-0" aria-hidden="true" />
                      {review.commit_sha?.slice(0, 7)}
                    </span>
                    {review.branch && (
                      <span className="flex items-center gap-1 text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded font-mono">
                        <GitBranch size={10} aria-hidden="true" />
                        {review.branch}
                      </span>
                    )}
                    {review.pr_number && (
                      <span className="text-xs text-brand-400 font-medium">PR #{review.pr_number}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {review.repositories?.full_name}
                    {review.author ? ` · ${review.author}` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  <StatusBadge status={review.status} />
                  <span className="text-xs text-gray-500 hidden sm:block whitespace-nowrap">
                    {safeDistanceToNow(review.created_at)}
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 mt-4">
              <span className="text-xs text-gray-500">
                Page {page} of {totalPages} · {total} reviews
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  aria-label="Previous page"
                  className="btn-secondary py-1.5 px-3 disabled:opacity-40"
                >
                  <ChevronLeft size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  aria-label="Next page"
                  className="btn-secondary py-1.5 px-3 disabled:opacity-40"
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
