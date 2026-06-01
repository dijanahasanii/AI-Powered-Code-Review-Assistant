import { useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { safeDistanceToNow, safeFormatDateTime } from '../lib/safeDates';
import {
  ChevronLeft,
  GitCommit,
  AlertTriangle,
  XCircle,
  RefreshCw,
  GitBranch,
  Clock,
} from 'lucide-react';
import { reviewsApi } from '../api/client';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../components/common/Toast';
import { describeApiFailure } from '../lib/apiErrors';
import { ScoreRing, SeverityBadge, StatusBadge, Spinner } from '../components/common/UI';
import { ReviewDetailSkeleton } from '../components/common/Skeletons';
import {
  SEVERITY_ORDER,
  bucketCategory,
  bucketCategoryForSeverityJump,
} from '../features/reviews/analysisConstants';
import { AnalysisFindingsPanel } from '../features/reviews/components/AnalysisFindingsPanel';
import { FilesChangedPanel } from '../features/reviews/components/FilesChangedPanel';
import { ReviewAnalysisMetricsStrip } from '../features/reviews/components/ReviewAnalysisMetricsStrip';
import { ReviewVerdictBanner } from '../features/reviews/components/ReviewVerdictBanner';
import { queryKeys } from '../lib/queryKeys';
import { filterActiveReviewIssues } from '../lib/issueLifecycle';

export default function ReviewDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { connected, joinRepo, onReviewUpdate } = useSocket();

  const retryMutation = useMutation({
    mutationFn: () => {
      if (id == null || id === '') return Promise.reject(new Error('Missing review id'));
      return reviewsApi.retryPending(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reviewDetail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.reviewsAll });
      toast.success('Retry queued', 'The worker will pick this analysis up again.');
    },
    onError: (err) => {
      const { title, detail } = describeApiFailure(err, { resourceLabel: 'the retry request' });
      toast.error(title, detail);
    },
  });

  const reviewIdPresent = Boolean(id);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.reviewDetail(id),
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
        queryClient.invalidateQueries({ queryKey: queryKeys.reviewDetail(id) });
      }
      if (update?.status === 'completed' || update?.status === 'failed') {
        queryClient.invalidateQueries({ queryKey: queryKeys.reportsAll });
      }
    });
    return unsub;
  }, [id, onReviewUpdate, queryClient]);

  const issues = useMemo(
    () => filterActiveReviewIssues(data?.review_issues ?? []),
    [data]
  );

  const sortedIssues = useMemo(
    () =>
      [...issues].sort(
        (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
      ),
    [issues]
  );

  const byBucket = useMemo(() => {
    const buckets = { security: [], performance: [], 'code-quality': [] };
    sortedIssues.forEach((issue) => {
      buckets[bucketCategory(issue.category)].push(issue);
    });
    return buckets;
  }, [sortedIssues]);

  const issueCounts = useMemo(
    () =>
      SEVERITY_ORDER.reduce((acc, sev) => {
        acc[sev] = issues.filter((i) => i.severity === sev).length;
        return acc;
      }, {}),
    [issues]
  );

  if (!reviewIdPresent) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col items-center justify-center gap-4 px-4 py-16 text-center">
        <p className="text-sm text-desk-muted">Invalid review link.</p>
        <Link to="/reviews" className="btn-secondary inline-flex gap-2 px-4 py-2 text-sm">
          <ChevronLeft size={14} aria-hidden="true" />
          All reviews
        </Link>
      </div>
    );
  }

  if (isLoading) return <ReviewDetailSkeleton />;

  if (error) {
    const is404 = error.response?.status === 404;
    const described = !is404 ? describeApiFailure(error, { resourceLabel: 'this review' }) : null;
    return (
      <div className="mx-auto flex max-w-4xl flex-col items-center justify-center gap-5 px-4 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/35 bg-red-500/10">
          <XCircle size={26} className="text-[#ff7b72]" aria-hidden="true" />
        </div>
        <div>
          <h1 className="mb-1 text-base font-semibold text-gray-900 dark:text-gray-100">
            {is404 ? 'Review not found' : described?.title ?? 'Could not load review'}
          </h1>
          <p className="max-w-md text-sm text-desk-muted">
            {is404
              ? 'It may have been deleted or belongs to another account.'
              : described?.detail ?? 'We could not load this review. Try again shortly.'}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => navigate('/reviews')} className="btn-secondary inline-flex gap-2">
            <ChevronLeft size={14} aria-hidden="true" />
            All reviews
          </button>
          {!is404 && described?.canRetry !== false && (
            <button
              type="button"
              onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.reviewDetail(id) })}
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
  const fileStats = review.review_file_stats ?? [];
  const failureReason =
    review.error_message ||
    (typeof review.summary === 'string' && review.summary.startsWith('[Review failed]')
      ? review.summary.replace(/^\[Review failed\]\s*/i, '').trim()
      : null);

  const isInFlight = ['pending', 'processing'].includes(review.status);

  const summaryStartsWithFailurePrefix =
    typeof review.summary === 'string' && review.summary.startsWith('[Review failed]');

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <Link
        to="/reviews"
        className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-desk-muted transition-colors hover:text-gray-900 dark:hover:text-gray-100"
      >
        <ChevronLeft size={14} aria-hidden="true" />
        Back to reviews
      </Link>

      <section className="card mb-6 p-5 sm:p-6" aria-label="Review summary">
        <ReviewAnalysisMetricsStrip
          review={review}
          issueCounts={issueCounts}
          totalIssues={issues.length}
          fileStats={fileStats}
        />
        <ReviewVerdictBanner status={review.status} issueCounts={issueCounts} totalIssues={issues.length} />
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <ScoreRing score={review.overall_score} size={60} />
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2 gap-y-2">
              <span className="inline-flex items-center gap-2 font-mono text-sm font-semibold text-gray-900 dark:text-gray-100">
                <GitCommit size={16} className="text-desk-muted" aria-hidden="true" />
                {review.commit_sha?.slice(0, 7)}
              </span>
              <StatusBadge status={review.status} />
              {review.pr_number && (
                <span className="rounded-full border border-brand-700/35 bg-brand-700/15 px-2 py-0.5 text-[11px] font-medium text-brand-700 dark:text-brand-400">
                  PR #{review.pr_number}
                </span>
              )}
            </div>
            <p className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-sm text-desk-muted">
              <span className="text-gray-800 dark:text-gray-200">{review.repositories?.full_name}</span>
              {review.branch && (
                <>
                  <span className="text-desk-subtle">/</span>
                  <span className="inline-flex items-center gap-1 font-mono text-[12px] text-desk-muted">
                    <GitBranch size={12} aria-hidden="true" />
                    {review.branch}
                  </span>
                </>
              )}
              {review.author && (
                <>
                  <span className="text-desk-subtle">·</span>
                  <span className="text-xs text-desk-subtle">{review.author}</span>
                </>
              )}
            </p>
            <p
              className="mt-2 text-xs text-gray-600 dark:text-desk-subtle"
              title={safeFormatDateTime(review.created_at) || undefined}
            >
              Started {safeDistanceToNow(review.created_at)}
              {review.completed_at && (
                <span className="ml-2 text-desk-muted">· completed {safeDistanceToNow(review.completed_at)}</span>
              )}
            </p>
          </div>
        </div>

        {review.summary && !summaryStartsWithFailurePrefix && (
          <div className="mt-6 border-t border-desk-border pt-5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-desk-muted">
              What the scan said
            </p>
            <p className="break-words text-sm leading-relaxed text-gray-800 dark:text-gray-300">{review.summary}</p>
          </div>
        )}

        {review.status === 'completed' && issues.length > 0 ? (
        <div
          className="mt-6 flex flex-nowrap gap-2 overflow-x-auto overscroll-contain pb-1 sm:flex-wrap md:overflow-visible md:pb-0"
          aria-label="Issue breakdown"
        >
          {SEVERITY_ORDER.map((sev) =>
            issueCounts[sev] > 0 ? (
              <a
                key={sev}
                href={`#analysis-${bucketCategoryForSeverityJump(sev, byBucket)}`}
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-desk-border bg-desk-canvas px-2.5 py-1 text-[11px] text-gray-700 hover:border-brand-600/35 hover:bg-brand-600/10 dark:text-gray-300"
              >
                <SeverityBadge severity={sev} plainLanguage />
                <span className="tabular-nums text-desk-muted">{issueCounts[sev]}</span>
              </a>
            ) : null
          )}
        </div>
        ) : null}
      </section>

      {review.status === 'failed' && (
        <div className="card mb-6 border-red-500/30 bg-red-500/[0.06] p-5 sm:p-6">
          <div className="mb-4 flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[#ff7b72]" aria-hidden="true" />
            <div className="min-w-0 space-y-2">
              <p className="text-sm font-semibold text-red-100/95">Analysis pipeline failed</p>
              <p className="text-xs leading-relaxed text-red-100/85">
                The diff was not fully analyzed. Typical causes: GitHub token or repo access, webhook delivery,
                worker timeouts, model/API quota, or database connectivity — not a passing grade on code quality.
              </p>
              {failureReason && (
                <pre className="max-h-52 overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-red-900/40 bg-[#010409] p-3 font-mono text-[12px] text-gray-200">
                  {failureReason}
                </pre>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => retryMutation.mutate()}
            disabled={retryMutation.isPending}
            className="btn-secondary border-red-800/55 px-4 py-2 text-xs hover:border-red-500/40"
          >
            {retryMutation.isPending ? 'Restarting…' : 'Retry analysis'}
          </button>
        </div>
      )}

      {isInFlight && (
        <div className="card mb-6 flex items-start gap-4 p-5 sm:p-6" role="status" aria-live="polite">
          {review.status === 'pending' ? (
            <Clock size={22} className="mt-0.5 shrink-0 text-desk-muted" aria-hidden="true" />
          ) : (
            <Spinner />
          )}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {review.status === 'pending' ? 'Review queued…' : 'Analysis in progress…'}
            </p>
            {review.status === 'pending' ? (
              <>
                <p className="max-w-2xl text-xs leading-relaxed text-desk-muted">
                  If nothing happens for several minutes the worker probably never picked it up. Check backend logs
                  first, then use re-queue sparingly—it issues another job with the same diff context.
                </p>
                <button
                  type="button"
                  onClick={() => retryMutation.mutate()}
                  disabled={retryMutation.isPending}
                  className="btn-secondary mt-2 inline-flex gap-2 px-3 py-2 text-xs"
                >
                  {retryMutation.isPending ? 'Working…' : 'Re-queue analysis'}
                </button>
              </>
            ) : (
              <p className="max-w-2xl text-xs leading-relaxed text-desk-muted">
                Fetching unified diffs and running pattern analysis can take longer on large merges. Websocket pushes
                auto-refresh this screen when the job resolves.
              </p>
            )}
          </div>
        </div>
      )}

      <FilesChangedPanel
        fileStats={fileStats}
        emptyHint={
          (fileStats?.length ?? 0) === 0 && review.status === 'completed'
            ? 'Per-file additions and deletions were not stored for this run. The summary and findings above still describe the change.'
            : (fileStats?.length ?? 0) === 0 && review.status === 'failed'
              ? 'No file stats were saved because the run did not finish successfully.'
              : undefined
        }
      />

      <AnalysisFindingsPanel
        sortedIssues={sortedIssues}
        byBucket={byBucket}
        reviewStatus={review.status}
      />
    </div>
  );
}
