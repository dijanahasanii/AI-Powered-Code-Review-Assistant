import { lazy, Suspense, useDeferredValue, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { safeDistanceToNow } from '../lib/safeDates';
import {
  BarChart3,
  AlertTriangle,
  Target,
  FolderGit2,
  Activity,
  GitCommit,
} from 'lucide-react';
import clsx from 'clsx';
import { reviewsApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import CollapsibleSection from '../components/common/CollapsibleSection';
import { ScoreRing, StatusBadge, PageHeader } from '../components/common/UI';
import { StatCardSkeleton, DashboardActivitySkeleton } from '../components/common/Skeletons';
import { queryKeys } from '../lib/queryKeys';

const DashboardFindingsChart = lazy(() =>
  import('../features/dashboard/DashboardFindingsChart').then((m) => ({
    default: m.DashboardFindingsChart,
  }))
);

const buildChartData = (issues = {}) => [
  { name: 'Critical', value: issues.critical || 0, color: '#f85149' },
  { name: 'Warning', value: issues.warning || 0, color: '#d29922' },
  { name: 'Info', value: issues.info || 0, color: '#58a6ff' },
  { name: 'Suggest', value: issues.suggestion || 0, color: '#a371f7' },
];

const MetricCard = ({ icon: Icon, label, value, sub, subAccent }) => (
  <div className="card flex flex-col p-4 sm:p-5 card-interactive">
    <div className="mb-3 flex items-start justify-between gap-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-desk-muted">{label}</p>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-desk-border bg-desk-canvas">
        <Icon size={15} className="text-desk-muted" aria-hidden="true" />
      </div>
    </div>
    <p
      className={clsx(
        'text-2xl font-semibold tabular-nums tracking-tight',
        subAccent ?? 'text-gray-900 dark:text-gray-50'
      )}
    >
      {value ?? '—'}
    </p>
    {sub && <p className="mt-2 text-xs leading-snug text-desk-muted">{sub}</p>}
  </div>
);

export default function DashboardPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { connected, onReviewUpdate } = useSocket();

  /** Socket + light polling so metrics update even if one event is missed. */
  const pollMs = connected ? 20_000 : 10_000;

  const {
    data: bundle,
    isLoading,
    isError: bundleError,
    refetch: refetchBundle,
  } = useQuery({
    queryKey: queryKeys.dashboardBundle,
    queryFn: () => reviewsApi.getDashboard().then((r) => r.data.data),
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: pollMs,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    return onReviewUpdate(() => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardBundle });
    });
  }, [onReviewUpdate, queryClient]);

  const stats = bundle?.stats;
  const reviews = bundle?.recentReviews ?? [];
  const deferredChart = useDeferredValue(stats?.issues);

  const chartData = useMemo(() => buildChartData(deferredChart), [deferredChart]);
  const inProgress = (stats?.pending ?? 0) + (stats?.processing ?? 0);
  const reposConnected = stats?.repoCount ?? 0;

  const totalIssues = Object.values(stats?.issues || {}).reduce(
    (a, n) => a + (Number(n) || 0),
    0
  );

  return (
    <div className="mx-auto max-w-7xl px-4 pt-5 pb-5 sm:px-6 sm:pt-6 lg:px-8">
      <PageHeader
        compact
        title="Dashboard"
        description="High-level signals across scans, repos, and review queue health."
        hint={
          user?.username
            ? `Workspace for @${user.username}. Totals include all linked repos.`
            : 'Totals reflect every repo linked from this workspace.'
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        {bundleError ? (
          <div className="card border-red-500/25 bg-red-500/[0.07] p-4 sm:col-span-3" role="alert" aria-live="polite">
            <p className="text-sm text-red-800 dark:text-red-200">Could not load dashboard statistics.</p>
            <button
              type="button"
              className="btn-secondary mt-2 px-3 py-1.5 text-xs"
              onClick={() => refetchBundle()}
            >
              Retry
            </button>
          </div>
        ) : isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <MetricCard
              icon={Target}
              label="Score"
              value={stats?.avgScore != null ? `${stats.avgScore}` : null}
              sub={
                stats?.avgScore != null
                  ? 'Mean quality score across completed analyses (0–100)'
                  : 'Complete a reviewed diff to populate this metric'
              }
              subAccent={clsx(stats?.avgScore != null && 'text-brand-400')}
            />
            <MetricCard
              icon={AlertTriangle}
              label="Issues"
              value={totalIssues}
              sub="Flagged findings across completed and in-progress jobs in your workspace"
              subAccent={
                totalIssues > 0
                  ? 'text-amber-800 dark:text-amber-200/95'
                  : 'text-green-700 dark:text-green-400/90'
              }
            />
            <MetricCard
              icon={FolderGit2}
              label="Files scanned"
              value={stats?.completed ?? 0}
              sub={`${reposConnected} linked repos · per-run file deltas live on each Analysis detail view`}
            />
          </>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {!isLoading && !bundleError && stats ? (
          <>
            <MetricCard icon={Activity} label="Throughput" value={stats.total} sub="Total queued analyses" />
            <MetricCard
              icon={BarChart3}
              label="Completed"
              value={stats.completed}
              sub="Runs with results"
              subAccent="text-green-700 dark:text-green-400/90"
            />
            <MetricCard
              icon={BarChart3}
              label="In flight"
              value={inProgress}
              sub={inProgress ? 'Pending or processing workers' : 'Queue is idle'}
              subAccent={inProgress ? 'text-amber-800 dark:text-amber-300/95' : undefined}
            />
            <MetricCard
              icon={BarChart3}
              label="Repos linked"
              value={reposConnected}
              sub={reposConnected === 1 ? '1 codebase on file' : `${reposConnected} codebases on file`}
            />
          </>
        ) : isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={`s-${i}`} />)
        ) : null}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6 lg:items-stretch">
        <div className="flex min-h-0 flex-col lg:h-full">
          {bundleError ? (
            <div className="card flex min-h-[12rem] flex-1 flex-col p-5 lg:min-h-0">
              <p className="text-xs text-desk-muted">
                Severity mix chart needs stats — use Retry on the banner above when it appears.
              </p>
            </div>
          ) : isLoading ? (
            <div className="card flex min-h-[16rem] flex-1 flex-col space-y-3 p-5 lg:min-h-0">
              <div className="h-4 w-32 animate-pulse rounded bg-desk-elevated/80" aria-hidden="true" />
              <div className="min-h-0 flex-1 animate-pulse rounded-md bg-desk-elevated/60" aria-hidden="true" />
            </div>
          ) : (
            <Suspense
              fallback={
                <div className="card flex min-h-[16rem] flex-1 animate-pulse rounded-md bg-desk-elevated/60 lg:min-h-0" />
              }
            >
              <DashboardFindingsChart chartData={chartData} totalIssues={totalIssues} />
            </Suspense>
          )}
        </div>

        <div className="card flex min-h-0 flex-col overflow-hidden p-0 lg:mb-0 lg:h-full">
          {bundleError ? (
            <div
              className="flex flex-1 flex-col justify-center border-b border-transparent px-4 py-12 text-center sm:px-5"
              role="alert"
              aria-live="polite"
            >
              <p className="text-sm text-red-800 dark:text-red-300">Could not load recent activity.</p>
              <button
                type="button"
                className="btn-secondary mt-3 px-3 py-1.5 text-xs"
                onClick={() => refetchBundle()}
              >
                Retry
              </button>
            </div>
          ) : isLoading ? (
            <div className="grid min-h-[16rem] flex-1 grid-cols-1 gap-px overflow-hidden bg-desk-border p-px sm:min-h-0 sm:grid-cols-2 sm:[grid-template-rows:repeat(2,minmax(0,1fr))]">
              {Array.from({ length: 4 }).map((_, i) => (
                <DashboardActivitySkeleton key={i} />
              ))}
            </div>
          ) : reviews.length === 0 ? (
            <div className="flex flex-1 flex-col justify-center px-4 py-14 text-center sm:px-5">
              <p className="text-sm text-gray-600 dark:text-gray-400">Nothing in the timeline yet.</p>
              <p className="mx-auto mt-1 max-w-md text-xs text-desk-muted">
                Connect a repo and enqueue a scan — activity cards land here automatically.
              </p>
              <Link
                to="/repositories"
                className="mt-4 inline-block text-[12px] font-medium text-brand-700 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
              >
                Go to repos →
              </Link>
            </div>
          ) : (
            <CollapsibleSection
              variant="plain"
              idPrefix="dash-recent-activity"
              className="flex min-h-[16rem] flex-1 flex-col overflow-hidden lg:min-h-0"
              icon={Activity}
              title="Recent activity"
              badge={reviews.length}
              expandable={false}
              summary={
                <>
                  Showing up to {reviews.length} run{reviews.length !== 1 ? 's' : ''} · Latest{' '}
                  {reviews[0]?.created_at ? safeDistanceToNow(reviews[0].created_at) : '—'}
                </>
              }
              controls={
                <Link
                  to="/reviews"
                  className="text-[12px] font-medium text-brand-700 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
                >
                  Reviews →
                </Link>
              }
              panelClassName="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-desk-border"
            >
              <div className="grid min-h-0 flex-1 grid-cols-1 gap-px overflow-y-auto overscroll-contain bg-desk-border p-px sm:grid-cols-2 sm:overflow-hidden sm:[grid-template-rows:repeat(2,minmax(0,1fr))]">
                {reviews.map((review) => (
                  <Link
                    key={review.id}
                    to={`/reviews/${review.id}`}
                    className="group flex min-h-[7.5rem] flex-col bg-desk-panel p-4 transition-colors hover:bg-desk-elevated sm:h-full sm:min-h-0 sm:p-5"
                  >
                    <div className="flex min-h-0 flex-1 items-start gap-4">
                      <ScoreRing score={review.overall_score} size={40} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 font-mono text-[13px] font-medium text-gray-900 dark:text-gray-100">
                            <GitCommit size={13} className="text-desk-muted" aria-hidden="true" />
                            {review.commit_sha?.slice(0, 7) ?? '—'}
                          </span>
                          <StatusBadge status={review.status} compact />
                        </div>
                        <p
                          className="mt-2 truncate font-mono text-[11px] text-desk-muted"
                          title={
                            `${review.repositories?.full_name ?? ''}${review.branch ? ` · ${review.branch}` : ''}` ||
                            undefined
                          }
                        >
                          {review.repositories?.full_name}
                          {review.branch ? ` · ${review.branch}` : ''}
                        </p>
                      </div>
                    </div>
                    <p className="mt-auto shrink-0 pt-4 text-[11px] text-gray-600 dark:text-desk-subtle">
                      {safeDistanceToNow(review.created_at)}
                    </p>
                  </Link>
                ))}
              </div>
            </CollapsibleSection>
          )}
        </div>
      </div>
    </div>
  );
}
