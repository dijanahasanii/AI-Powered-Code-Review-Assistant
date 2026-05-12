import { useEffect } from 'react';
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
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import clsx from 'clsx';
import { reviewsApi, reposApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import CollapsibleSection from '../components/common/CollapsibleSection';
import { ScoreRing, StatusBadge, PageHeader } from '../components/common/UI';
import { StatCardSkeleton, DashboardActivitySkeleton } from '../components/common/Skeletons';
import { queryKeys } from '../lib/queryKeys';

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

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="card border-desk-subtle px-3 py-2 text-xs shadow-xl">
      <p className="text-desk-muted">{label}</p>
      <p className="mt-0.5 font-semibold tabular-nums text-gray-900 dark:text-gray-50">
        {payload[0].value} findings
      </p>
    </div>
  );
};

const buildChartData = (issues = {}) => [
  { name: 'Critical', value: issues.critical || 0, color: '#f85149' },
  { name: 'Warning', value: issues.warning || 0, color: '#d29922' },
  { name: 'Info', value: issues.info || 0, color: '#58a6ff' },
  { name: 'Suggest', value: issues.suggestion || 0, color: '#a371f7' },
];

function findingsMixSummary(chartRows) {
  const rows = chartRows ?? [];
  const total = rows.reduce((s, r) => s + Number(r.value || 0), 0);
  if (!total) return <>No findings in aggregated stats yet.</>;
  const parts = rows.filter((r) => Number(r.value) > 0).map((r) => `${r.name} ${Number(r.value).toLocaleString()}`);
  return (
    <>
      {total.toLocaleString()} total
      {parts.length ? (
        <>
          <span aria-hidden="true"> · </span>
          <span>{parts.join(' · ')}</span>
        </>
      ) : null}
    </>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { connected, onReviewUpdate } = useSocket();

  const pollMs = connected ? false : 5000;

  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats } = useQuery(
    {
      queryKey: queryKeys.stats,
      queryFn: () => reviewsApi.getStats().then((r) => r.data.data),
      refetchInterval: pollMs,
    }
  );

  const { data: reposData, isLoading: reposLoading } = useQuery({
    queryKey: queryKeys.repos,
    queryFn: () => reposApi.list().then((r) => r.data.data ?? []),
    refetchInterval: pollMs,
    staleTime: 45_000,
  });

  const {
    data: reviewsData,
    isLoading: reviewsLoading,
    isError: reviewsError,
    refetch: refetchReviews,
  } = useQuery({
    queryKey: queryKeys.reviewsList({ page: 1, limit: 8 }),
    queryFn: () => reviewsApi.list({ page: 1, limit: 8 }).then((r) => r.data),
    refetchInterval: pollMs,
  });

  useEffect(() => {
    const unsub = onReviewUpdate(() => {
      queryClient.invalidateQueries({ queryKey: queryKeys.stats });
      queryClient.invalidateQueries({ queryKey: queryKeys.reviewsAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.repos });
    });
    return unsub;
  }, [onReviewUpdate, queryClient]);

  useEffect(() => {
    if (!connected) return undefined;
    queryClient.invalidateQueries({ queryKey: queryKeys.stats });
    queryClient.invalidateQueries({ queryKey: queryKeys.reviewsAll });
    queryClient.invalidateQueries({ queryKey: queryKeys.repos });
    return undefined;
  }, [connected, queryClient]);

  const reviews = reviewsData?.data ?? [];
  const chartData = buildChartData(stats?.issues);
  const inProgress = (stats?.pending ?? 0) + (stats?.processing ?? 0);
  const reposConnected = Array.isArray(reposData) ? reposData.length : 0;

  const totalIssues = Object.values(stats?.issues || {}).reduce(
    (a, n) => a + (Number(n) || 0),
    0
  );

  const metricsPending = statsLoading || reposLoading;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader
        title="Dashboard"
        description="High-level signals across scans, repos, and review queue health."
        hint={
          user?.username
            ? `Workspace for @${user.username}. Totals include all linked repos.`
            : 'Totals reflect every repo linked from this workspace.'
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        {statsError ? (
          <div className="card border-red-500/25 bg-red-500/[0.07] p-4 sm:col-span-3">
            <p className="text-sm text-red-800 dark:text-red-200">Could not load dashboard statistics.</p>
            <button
              type="button"
              className="btn-secondary mt-2 px-3 py-1.5 text-xs"
              onClick={() => refetchStats()}
            >
              Retry
            </button>
          </div>
        ) : metricsPending ? (
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
        {!statsLoading && !statsError && stats ? (
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
        ) : statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={`s-${i}`} />)
        ) : null}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6 lg:items-stretch">
        <div className="flex min-h-0 flex-col lg:h-full">
          {statsError ? (
            <div className="card flex min-h-[12rem] flex-1 flex-col p-5 lg:min-h-0">
              <p className="text-xs text-desk-muted">
                Severity mix chart needs stats — use Retry on the banner above when it appears.
              </p>
            </div>
          ) : statsLoading ? (
            <div className="card flex min-h-[16rem] flex-1 flex-col space-y-3 p-5 lg:min-h-0">
              <div className="h-4 w-32 animate-pulse rounded bg-desk-elevated/80" aria-hidden="true" />
              <div className="min-h-0 flex-1 animate-pulse rounded-md bg-desk-elevated/60" aria-hidden="true" />
            </div>
          ) : (
            <CollapsibleSection
              idPrefix="dash-findings-mix"
              className="!mb-0 flex min-h-[16rem] flex-1 flex-col lg:min-h-0"
              icon={BarChart3}
              title="Findings mix"
              badge={totalIssues}
              expandable={false}
              summary={findingsMixSummary(chartData)}
              panelClassName="flex min-h-0 flex-1 flex-col p-4 sm:p-5"
            >
              <p className="mb-4 shrink-0 text-[11px] text-desk-muted">
                Issue counts by severity across your workspace (aggregated stats).
              </p>
              <div className="min-h-[176px] w-full min-w-0 flex-1 lg:min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barSize={22} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#57606a', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#57606a', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                      width={28}
                    />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(87, 96, 106, 0.12)' }} />
                    <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                      {chartData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CollapsibleSection>
          )}
        </div>

        <div className="card flex min-h-0 flex-col overflow-hidden p-0 lg:mb-0 lg:h-full">
          {reviewsError ? (
            <div className="flex flex-1 flex-col justify-center border-b border-transparent px-4 py-12 text-center sm:px-5">
              <p className="text-sm text-red-800 dark:text-red-300">Could not load recent activity.</p>
              <button
                type="button"
                className="btn-secondary mt-3 px-3 py-1.5 text-xs"
                onClick={() => refetchReviews()}
              >
                Retry
              </button>
            </div>
          ) : reviewsLoading ? (
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
                  {reviews[0]?.created_at
                    ? safeDistanceToNow(reviews[0].created_at)
                    : '—'}
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
