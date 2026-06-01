import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSocket } from '../context/SocketContext';
import { Link } from 'react-router-dom';
import { FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { reportsApi } from '../api/client';
import { describeApiFailure } from '../lib/apiErrors';
import { PageHeader, EmptyState } from '../components/common/UI';
import { ReportListCard } from '../features/reports/components/ReportListCard';
import { ReviewCardSkeleton } from '../components/common/Skeletons';
import { queryKeys } from '../lib/queryKeys';

const LIMIT = 15;

export default function ReportsPage() {
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const { connected, onReviewUpdate } = useSocket();
  const pollMs = connected ? 30_000 : 15_000;

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: queryKeys.reportsList({ page, limit: LIMIT }),
    queryFn: () => reportsApi.list({ page, limit: LIMIT }).then((r) => r.data),
    staleTime: 15_000,
    refetchOnMount: 'always',
    refetchInterval: pollMs,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    return onReviewUpdate((update) => {
      if (update?.status === 'completed') {
        queryClient.invalidateQueries({ queryKey: queryKeys.reportsAll });
      }
    });
  }, [onReviewUpdate, queryClient]);

  const reports = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const showSkeleton = !isError && isPending && data === undefined;
  const loadError = isError ? describeApiFailure(error, { resourceLabel: 'analysis reports' }) : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader
        title="AI Reports"
        description={
          total > 0
            ? `${total} persisted analysis report${total !== 1 ? 's' : ''}`
            : 'Markdown audit trails from completed repository analyses'
        }
        hint="Each completed analysis generates a report you can review and optionally remediate after explicit confirmation."
      />

      {isError && loadError ? (
        <div className="card overflow-hidden p-10 text-center" role="alert">
          <p className="mb-1 text-sm font-semibold text-red-900 dark:text-red-200">{loadError.title}</p>
          <p className="mb-3 whitespace-pre-wrap text-sm text-red-800 dark:text-red-300">{loadError.detail}</p>
          {loadError.title === 'Database setup required' && (
            <p className="mb-4 text-left text-xs leading-relaxed text-desk-muted">
              Open{' '}
              <a
                href="https://supabase.com/dashboard/project/lhgybgflaqazblzukfcz/sql/new"
                target="_blank"
                rel="noreferrer"
                className="text-brand-400 underline"
              >
                Supabase SQL Editor
              </a>
              , paste{' '}
              <code className="rounded bg-desk-elevated px-1">backend/migrations/add_analysis_reports.sql</code>, click
              Run, then Retry.
            </p>
          )}
          <button type="button" className="btn-secondary px-4 py-2 text-xs" onClick={() => refetch()}>
            Retry
          </button>
          </div>
      ) : showSkeleton ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ReviewCardSkeleton key={i} />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="card overflow-hidden">
          <EmptyState
            icon={FileText}
            title="No analysis reports yet"
            description="Complete a repository analysis from Repositories or via webhook push. Reports appear here automatically."
            action={
              <Link to="/repositories" className="btn-primary px-4 py-2 text-sm">
                Go to Repositories
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {reports.map((report) => (
              <ReportListCard key={report.id} report={report} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-3">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="btn-secondary p-2 disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs text-desk-muted">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="btn-secondary p-2 disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
