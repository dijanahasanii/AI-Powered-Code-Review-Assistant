import { useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { safeDistanceToNow, safeFormatDateTime } from '../utils/safeDates';
import {
  ChevronLeft,
  GitCommit,
  FileCode,
  AlertTriangle,
  Lightbulb,
  Info,
  XCircle,
  Clock,
  RefreshCw,
  GitBranch,
  CheckCircle2,
} from 'lucide-react';
import { reviewsApi } from '../api/client';
import { useSocket } from '../context/SocketContext';
import { ScoreRing, SeverityBadge, StatusBadge, Spinner } from '../components/common/UI';
import { ReviewDetailSkeleton } from '../components/common/Skeletons';

const SEVERITY_META = {
  critical: {
    icon: XCircle,
    color: 'text-red-400',
    wrap: 'bg-red-500/8 border-red-500/15',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-yellow-400',
    wrap: 'bg-yellow-500/8 border-yellow-500/15',
  },
  info: { icon: Info, color: 'text-blue-400', wrap: 'bg-blue-500/8 border-blue-500/15' },
  suggestion: {
    icon: Lightbulb,
    color: 'text-purple-400',
    wrap: 'bg-purple-500/8 border-purple-500/15',
  },
};

const SEVERITY_ORDER = ['critical', 'warning', 'info', 'suggestion'];

const CATEGORY_DISPLAY = {
  security: 'Security',
  bug: 'Bug risk',
  maintainability: 'Cleanup / upkeep',
  performance: 'Speed / load',
  style: 'Style',
  'bad-practice': 'Habits to avoid',
  'error-handling': 'Errors & recovery',
  'code-quality': 'Code clarity',
  react: 'React UI',
  vue: 'Vue UI',
  express: 'Server (Node)',
  async: 'Promises & async code',
};

function IssueCard({ issue }) {
  const meta = SEVERITY_META[issue.severity] ?? SEVERITY_META.info;
  const Icon = meta.icon;
  const typeLabel = issue.category
    ? CATEGORY_DISPLAY[issue.category] ||
      `${issue.category.charAt(0).toUpperCase()}${issue.category.slice(1)}`
    : null;
  const hasSnippet =
    typeof issue.code_snippet === 'string' && issue.code_snippet.trim().length > 0;

  return (
    <article className={`card border p-4 ${meta.wrap}`}>
      <div className="flex items-start gap-3">
        <Icon size={15} className={`${meta.color} mt-0.5 shrink-0`} aria-hidden="true" />
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-start gap-2 flex-wrap">
            <SeverityBadge severity={issue.severity} plainLanguage />
            {typeLabel && (
              <span className="text-xs text-gray-400 bg-gray-900/70 px-1.5 py-0.5 rounded border border-gray-700/60">
                Topic:{' '}
                <span className="text-gray-200 font-medium">{typeLabel}</span>
              </span>
            )}
            <span className="text-sm font-semibold text-gray-100 leading-snug flex-1 min-w-[12rem]">
              {issue.title}
            </span>
          </div>

          <div className="text-xs font-mono text-gray-400 space-y-0.5">
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 min-w-0">
              <span className="text-gray-600 shrink-0">File:</span>
              <span className="text-gray-300 truncate flex-1 min-w-0" title={issue.file_path ?? ''}>
                <FileCode size={11} className="inline mr-1 text-gray-500 align-middle" aria-hidden="true" />
                {issue.file_path ?? '—'}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Line:</span>{' '}
              <span className="text-brand-400 tabular-nums">
                {issue.line_number != null && issue.line_number !== '' ? issue.line_number : '—'}
              </span>
            </div>
          </div>

          {hasSnippet && (
            <div>
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Matched line</p>
              <pre className="text-xs text-emerald-200/95 bg-black/45 border border-gray-800 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all font-mono leading-relaxed max-h-48 overflow-y-auto">
                {issue.code_snippet.trim()}
              </pre>
            </div>
          )}

          <div>
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Why you&apos;re seeing this</p>
            {issue.matched_rule ? (
              <p className="text-xs text-amber-100/90 leading-relaxed mb-2">
                <span className="text-gray-500">What we checked: </span>
                {issue.matched_rule}
              </p>
            ) : null}
            <p className="text-sm text-gray-300 leading-relaxed">{issue.description}</p>
          </div>

          {issue.suggestion && (
            <div className="p-3 bg-gray-950/70 rounded-lg border border-gray-800">
              <p className="text-xs font-semibold text-brand-400 mb-1.5 flex items-center gap-1.5">
                <Lightbulb size={11} aria-hidden="true" />
                What to try
              </p>
              <p className="text-xs text-gray-300 leading-relaxed">{issue.suggestion}</p>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function FilesChanged({ fileStats }) {
  if (!fileStats?.length) return null;
  return (
    <section className="card p-4 mb-5" aria-label="Files changed">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Files changed ({fileStats.length})
      </h2>
      <div className="space-y-1.5">
        {fileStats.map((f, idx) => (
          <div key={f.file_path || `changed-${idx}`} className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs min-w-0">
            <FileCode size={12} className="text-gray-600 shrink-0" aria-hidden="true" />
            <span className="flex-1 font-mono text-gray-300 truncate min-w-0" title={f.file_path}>
              {f.file_path}
            </span>
            <span className="text-green-400 tabular-nums shrink-0">+{f.additions}</span>
            <span className="text-red-400 tabular-nums shrink-0">-{f.deletions}</span>
            {f.issues_count > 0 && (
              <span className="text-yellow-400 shrink-0 font-medium">
                {f.issues_count} {f.issues_count === 1 ? 'issue' : 'issues'}
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function ReviewDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { connected, joinRepo, onReviewUpdate } = useSocket();

  const retryMutation = useMutation({
    mutationFn: () => {
      if (id == null || id === '') return Promise.reject(new Error('Missing review id'));
      return reviewsApi.retryPending(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review', id] });
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
    },
  });

  const reviewIdPresent = Boolean(id);

  const { data, isLoading, error } = useQuery({
    queryKey: ['review', id],
    queryFn: () => reviewsApi.getOne(id).then((r) => r.data.data),
    enabled: reviewIdPresent,
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      if (!['pending', 'processing'].includes(s)) return false;
      if (connected) return false;
      return 4500;
    },
  });

  useEffect(() => {
    const repoId = data?.repository_id;
    if (!repoId) return undefined;
    joinRepo(repoId);
    return undefined;
  }, [connected, data?.repository_id, joinRepo]);

  useEffect(() => {
    const unsub = onReviewUpdate((update) => {
      const rid = update?.reviewId ?? update?.review_id;
      if (rid != null && String(rid) === String(id)) {
        queryClient.invalidateQueries({ queryKey: ['review', id] });
      }
    });
    return unsub;
  }, [id, onReviewUpdate, queryClient]);

  if (!reviewIdPresent) {
    return (
      <div className="p-6 max-w-4xl mx-auto flex flex-col items-center justify-center text-center gap-4 py-16">
        <p className="text-sm text-gray-500">Invalid review link.</p>
        <Link to="/reviews" className="btn-secondary inline-flex gap-2 text-sm py-2 px-4">
          <ChevronLeft size={14} aria-hidden="true" />
          All reviews
        </Link>
      </div>
    );
  }

  if (isLoading) return <ReviewDetailSkeleton />;

  if (error) {
    const is404 = error.response?.status === 404;
    return (
      <div className="p-6 max-w-4xl mx-auto flex flex-col items-center justify-center text-center gap-5 py-16">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <XCircle size={26} className="text-red-400" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-gray-200 mb-1">
            {is404 ? 'Review not found' : 'Something went wrong'}
          </h1>
          <p className="text-sm text-gray-500 max-w-md">
            {is404
              ? 'It may have been deleted or belongs to another account.'
              : 'We could not load this review. Try again shortly.'}
          </p>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={() => navigate('/reviews')} className="btn-secondary inline-flex gap-2">
            <ChevronLeft size={14} aria-hidden="true" />
            All reviews
          </button>
          {!is404 && (
            <button
              type="button"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['review', id] })}
              className="btn-primary inline-flex gap-2"
            >
              <RefreshCw size={14} aria-hidden="true" />
              Retry fetch
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const review = data;
  const issues = review.review_issues ?? [];
  const fileStats = review.review_file_stats ?? [];
  const failureReason =
    review.error_message ||
    (typeof review.summary === 'string' && review.summary.startsWith('[Review failed]')
      ? review.summary.replace(/^\[Review failed\]\s*/i, '').trim()
      : null);

  const sortedIssues = [...issues].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
  );

  const issueCounts = SEVERITY_ORDER.reduce((acc, sev) => {
    acc[sev] = issues.filter((i) => i.severity === sev).length;
    return acc;
  }, {});

  const isInFlight = ['pending', 'processing'].includes(review.status);

  const summaryStartsWithFailurePrefix =
    typeof review.summary === 'string' && review.summary.startsWith('[Review failed]');

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link
        to="/reviews"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 mb-5 transition-colors"
      >
        <ChevronLeft size={14} aria-hidden="true" />
        Back to reviews
      </Link>

      <section className="card p-5 mb-5" aria-label="Review summary">
        <div className="flex items-start gap-4">
          <ScoreRing score={review.overall_score} size={56} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <div className="flex items-center gap-1.5 font-mono text-gray-100 font-semibold text-sm">
                <GitCommit size={15} className="text-gray-500 shrink-0" aria-hidden="true" />
                {review.commit_sha?.slice(0, 7)}
              </div>
              <StatusBadge status={review.status} />
              {review.pr_number && (
                <span className="text-xs text-brand-400 bg-brand-600/10 border border-brand-600/20 px-2 py-0.5 rounded-full">
                  PR #{review.pr_number}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-400 flex flex-wrap items-center gap-1">
              <span>{review.repositories?.full_name}</span>
              {review.branch && (
                <>
                  <span className="text-gray-700">·</span>
                  <span className="inline-flex items-center gap-1 text-xs font-mono text-gray-500">
                    <GitBranch size={11} aria-hidden="true" />
                    {review.branch}
                  </span>
                </>
              )}
              {review.author && (
                <>
                  <span className="text-gray-700">·</span>
                  <span className="text-xs text-gray-500">{review.author}</span>
                </>
              )}
            </p>
            <p className="text-xs text-gray-600 mt-1" title={safeFormatDateTime(review.created_at) || undefined}>
              Started {safeDistanceToNow(review.created_at)}
              {review.completed_at && (
                <span className="ml-2 text-gray-500">· completed {safeDistanceToNow(review.completed_at)}</span>
              )}
            </p>
          </div>
        </div>

        {review.summary && !summaryStartsWithFailurePrefix && (
          <div className="mt-5 pt-4 border-t border-gray-800">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Summary</p>
            <p className="text-sm text-gray-300 leading-relaxed">{review.summary}</p>
          </div>
        )}

        <div className="mt-5 flex gap-3 flex-wrap" aria-label="Issue breakdown">
          {review.status === 'completed' && issues.length === 0 && (
            <span className="flex items-center gap-2 text-xs text-green-400">
              <CheckCircle2 size={14} aria-hidden="true" />
              No flagged issues detected
            </span>
          )}
          {SEVERITY_ORDER.map((sev) =>
            issueCounts[sev] > 0 ? (
              <a key={sev} href={`#issues-${sev}`} className="flex items-center gap-2 text-xs text-gray-300">
                <SeverityBadge severity={sev} plainLanguage />
                <span className="text-gray-500">{issueCounts[sev]}</span>
              </a>
            ) : null
          )}
        </div>
      </section>

      {review.status === 'failed' && (
        <div className="card p-5 mb-5 border border-red-500/30 bg-red-500/5">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="min-w-0 space-y-2">
              <p className="text-sm font-semibold text-red-200">Analysis pipeline failed</p>
              <p className="text-xs text-red-200/85">
                This usually points to credential, GitHub access, quota, queue, or database issues—not a clean bill of health for the diff itself.
              </p>
              {failureReason && (
                <pre className="text-xs text-gray-200 whitespace-pre-wrap break-words rounded-lg bg-gray-950/80 border border-gray-900 p-3 font-mono max-h-48 overflow-y-auto">
                  {failureReason}
                </pre>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => retryMutation.mutate()}
            disabled={retryMutation.isPending}
            className="btn-secondary text-xs py-2 px-4 border-red-500/30 hover:border-red-500/50"
          >
            {retryMutation.isPending ? 'Restarting…' : 'Retry analysis'}
          </button>
        </div>
      )}

      {isInFlight && (
        <div className="card p-6 flex items-start gap-4 mb-5" role="status" aria-live="polite">
          {review.status === 'pending' ? (
            <Clock size={20} className="text-gray-500 shrink-0 mt-0.5" aria-hidden="true" />
          ) : (
            <Spinner />
          )}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-300">
              {review.status === 'pending' ? 'Review queued…' : 'Analysis in progress…'}
            </p>
            {review.status === 'pending' ? (
              <>
                <p className="text-xs text-gray-500 max-w-xl">
                  If nothing happens for several minutes the worker probably never picked it up. Check backend logs first,
                  then use re-queue sparingly—it issues another job with the same diff context.
                </p>
                <button
                  type="button"
                  onClick={() => retryMutation.mutate()}
                  disabled={retryMutation.isPending}
                  className="btn-secondary text-xs py-2 px-3 inline-flex gap-2"
                >
                  {retryMutation.isPending ? 'Working…' : 'Re-queue analysis'}
                </button>
              </>
            ) : (
              <p className="text-xs text-gray-500 max-w-xl">
                Fetching unified diffs and running pattern analysis can take longer on large merges. Websocket pushes
                auto-refresh this screen when the job resolves.
              </p>
            )}
          </div>
        </div>
      )}

      <FilesChanged fileStats={fileStats} />

      {sortedIssues.length > 0 && (
        <section aria-label={`${sortedIssues.length} issues`}>
          <h2 className="text-sm font-semibold text-gray-300 mb-3">
            Issues <span className="text-gray-600 font-normal">({sortedIssues.length})</span>
          </h2>
          <div className="space-y-3">
            {SEVERITY_ORDER.map((sev) => {
              const grouped = sortedIssues.filter((issue) => issue.severity === sev);
              if (!grouped.length) return null;
              return (
                <div key={sev} id={`issues-${sev}`} className="space-y-2">
                  {grouped.map((issue, i) => (
                    <IssueCard key={issue.id ?? `${sev}-${i}-${issue.line_number ?? 'x'}`} issue={issue} />
                  ))}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
