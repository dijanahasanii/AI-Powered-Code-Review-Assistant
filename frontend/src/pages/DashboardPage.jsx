import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { safeDistanceToNow } from '../utils/safeDates';
import { BarChart3, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import clsx from 'clsx';
import { reviewsApi } from '../api/client';
import { useSocket } from '../context/SocketContext';
import { ScoreRing, StatusBadge, PageHeader } from '../components/common/UI';
import { StatCardSkeleton, ReviewRowSkeleton } from '../components/common/Skeletons';

const StatCard = ({ icon: Icon, label, value, sub, color = 'text-white' }) => (
  <div className="card p-4 sm:p-5">
    <div className="flex items-start justify-between mb-3">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center shrink-0">
        <Icon size={14} className="text-gray-400" aria-hidden="true" />
      </div>
    </div>
    <p className={clsx('text-2xl font-bold tabular-nums', color)}>{value ?? '—'}</p>
    {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
  </div>
);

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="card px-3 py-2 text-xs shadow-xl border-gray-700">
      <p className="text-gray-400">{label}</p>
      <p className="font-semibold text-white mt-0.5 tabular-nums">{payload[0].value} issues</p>
    </div>
  );
};

const buildChartData = (issues = {}) => [
  { name: 'Critical', value: issues.critical || 0, color: '#f87171' },
  { name: 'Warning', value: issues.warning || 0, color: '#facc15' },
  { name: 'Info', value: issues.info || 0, color: '#60a5fa' },
  { name: 'Suggest', value: issues.suggestion || 0, color: '#a78bfa' },
];

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const { connected, onReviewUpdate } = useSocket();

  const pollMs = connected ? false : 5000;

  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['stats'],
    queryFn: () => reviewsApi.getStats().then((r) => r.data.data),
    refetchInterval: pollMs,
  });

  const {
    data: reviewsData,
    isLoading: reviewsLoading,
    isError: reviewsError,
    refetch: refetchReviews,
  } = useQuery({
    queryKey: ['reviews', { page: 1, limit: 8 }],
    queryFn: () => reviewsApi.list({ page: 1, limit: 8 }).then((r) => r.data),
    refetchInterval: pollMs,
  });

  useEffect(() => {
    const unsub = onReviewUpdate(() => {
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
    });
    return unsub;
  }, [onReviewUpdate, queryClient]);

  useEffect(() => {
    if (!connected) return undefined;
    queryClient.invalidateQueries({ queryKey: ['stats'] });
    queryClient.invalidateQueries({ queryKey: ['reviews'] });
    return undefined;
  }, [connected, queryClient]);

  const reviews = reviewsData?.data ?? [];
  const chartData = buildChartData(stats?.issues);
  const inProgress = (stats?.pending ?? 0) + (stats?.processing ?? 0);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader title="Dashboard" description="Overview of all AI code review activity" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {statsError ? (
          <div className="col-span-full card p-4 border border-red-500/25 bg-red-500/5">
            <p className="text-sm text-red-200">Could not load dashboard statistics.</p>
            <button type="button" className="btn-secondary text-xs mt-2 py-1.5 px-3" onClick={() => refetchStats()}>
              Retry
            </button>
          </div>
        ) : statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard icon={BarChart3} label="Total reviews" value={stats?.total} sub="all time" />
            <StatCard
              icon={CheckCircle2}
              label="Completed"
              value={stats?.completed}
              color="text-green-400"
            />
            <StatCard
              icon={Clock}
              label="In progress"
              value={inProgress}
              color="text-yellow-400"
            />
            <StatCard
              icon={AlertTriangle}
              label="Avg score"
              value={stats?.avgScore != null ? `${stats.avgScore}/100` : null}
              sub={stats?.avgScore != null ? 'weighted across completed reviews' : undefined}
              color="text-brand-400"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Issues by severity</h2>
          {statsError ? (
            <p className="text-xs text-gray-500">Chart unavailable until stats load.</p>
          ) : statsLoading ? (
            <div className="h-40 bg-gray-800 rounded-lg animate-pulse" aria-hidden="true" />
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData} barSize={24} margin={{ top: 0, right: 0, bottom: 0, left: -10 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#6b7280', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#6b7280', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  width={24}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="lg:col-span-2 card overflow-hidden">
          <div className="px-4 sm:px-5 py-4 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-300">Recent reviews</h2>
            <Link
              to="/reviews"
              className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
            >
              View all →
            </Link>
          </div>

          {reviewsError ? (
            <div className="py-10 text-center px-4">
              <p className="text-sm text-red-300">Could not load recent reviews.</p>
              <button
                type="button"
                className="btn-secondary text-xs mt-3 py-1.5 px-3"
                onClick={() => refetchReviews()}
              >
                Retry
              </button>
            </div>
          ) : reviewsLoading ? (
            <div className="divide-y divide-gray-800">
              {Array.from({ length: 5 }).map((_, i) => (
                <ReviewRowSkeleton key={i} />
              ))}
            </div>
          ) : reviews.length === 0 ? (
            <div className="py-12 text-center px-4">
              <p className="text-sm text-gray-500">No reviews yet.</p>
              <p className="text-xs text-gray-600 mt-1">
                Connect a repository and queue a review to populate this feed.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {reviews.map((review) => (
                <Link
                  key={review.id}
                  to={`/reviews/${review.id}`}
                  className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3 hover:bg-gray-800/50 transition-colors"
                >
                  <ScoreRing score={review.overall_score} size={38} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono font-medium text-gray-200 truncate">
                      {review.commit_sha?.slice(0, 7)}
                    </p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {review.repositories?.full_name}
                      {review.branch ? ` · ${review.branch}` : ''}
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
          )}
        </div>
      </div>
    </div>
  );
}
