import { useEffect, useMemo, useState } from 'react';
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
  Shield,
  Gauge,
  Braces,
  ChevronDown,
  ClipboardList,
} from 'lucide-react';
import clsx from 'clsx';
import { reviewsApi } from '../api/client';
import { useSocket } from '../context/SocketContext';
import { ScoreRing, SeverityBadge, StatusBadge, Spinner } from '../components/common/UI';
import { ReviewDetailSkeleton } from '../components/common/Skeletons';

const SEVERITY_META = {
  critical: {
    icon: XCircle,
    color: 'text-[#ff7b72]',
    wrap: 'border-red-500/25 bg-red-500/[0.06]',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-[#d29922]',
    wrap: 'border-amber-500/22 bg-amber-500/[0.06]',
  },
  info: { icon: Info, color: 'text-[#58a6ff]', wrap: 'border-blue-500/22 bg-blue-500/[0.06]' },
  suggestion: {
    icon: Lightbulb,
    color: 'text-[#a371f7]',
    wrap: 'border-violet-500/22 bg-violet-500/[0.06]',
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

const ANALYSIS_BUCKETS = [
  {
    id: 'security',
    title: 'Security',
    description: 'Trust boundaries, credentials, injections, fragile error paths',
    icon: Shield,
  },
  {
    id: 'performance',
    title: 'Performance',
    description: 'Latency hotspots, concurrency, scalability tradeoffs',
    icon: Gauge,
  },
  {
    id: 'code-quality',
    title: 'Code Quality',
    description: 'Readability, structure, correctness, frameworks, housekeeping',
    icon: Braces,
  },
];

function bucketCategory(raw) {
  const c = (raw || '').toLowerCase().trim();
  if (['security', 'bad-practice', 'error-handling'].includes(c)) return 'security';
  if (['performance', 'async'].includes(c)) return 'performance';
  return 'code-quality';
}

/** Severity strip links scroll to first bucket that contains that severity. */
function bucketCategoryForSeverityJump(severity, bucketMap) {
  for (const bucket of ANALYSIS_BUCKETS) {
    const bucketIssues = bucketMap[bucket.id] ?? [];
    if (bucketIssues.some((i) => i.severity === severity)) return bucket.id;
  }
  return ANALYSIS_BUCKETS[0].id;
}

function IssueAccordionRow({ issue, defaultOpen }) {
  const meta = SEVERITY_META[issue.severity] ?? SEVERITY_META.info;
  const Icon = meta.icon;
  const typeLabel = issue.category
    ? CATEGORY_DISPLAY[issue.category] ||
      `${issue.category.charAt(0).toUpperCase()}${issue.category.slice(1)}`
    : null;
  const hasSnippet =
    typeof issue.code_snippet === 'string' && issue.code_snippet.trim().length > 0;
  const [open, setOpen] = useState(Boolean(defaultOpen));

  return (
    <div className={clsx('overflow-hidden rounded-md border bg-desk-canvas', meta.wrap)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 px-3 py-3 text-left sm:gap-4 sm:px-4"
        aria-expanded={open}
      >
        <Icon size={16} className={clsx('mt-0.5 shrink-0', meta.color)} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start gap-x-2 gap-y-1.5">
            <SeverityBadge severity={issue.severity} plainLanguage />
            {typeLabel && (
              <span className="inline-flex rounded border border-desk-border bg-desk-panel px-1.5 py-0 text-[11px] text-desk-muted">
                <span className="text-desk-muted">Topic:</span>
                <span className="ml-1 font-medium text-gray-800 dark:text-gray-200">{typeLabel}</span>
              </span>
            )}
            <span className="w-full basis-full text-[13px] font-semibold leading-snug text-gray-900 dark:text-gray-100">
              {issue.title}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[11px] text-desk-muted">
            <span className="inline-flex max-w-[min(100%,28rem)] min-w-0 items-center truncate" title={issue.file_path}>
              <FileCode size={12} className="mr-1 shrink-0 text-desk-subtle" aria-hidden="true" />
              {issue.file_path ?? '—'}
            </span>
            <span className="text-desk-muted">:</span>
            <span className="tabular-nums text-brand-700 dark:text-brand-400">
              {issue.line_number != null && issue.line_number !== '' ? issue.line_number : '—'}
            </span>
          </div>
        </div>
        <ChevronDown
          size={18}
          className={clsx(
            'mt-1 shrink-0 text-desk-muted transition-transform duration-200',
            open && 'rotate-180'
          )}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="space-y-3 border-t border-desk-border px-3 pb-4 pt-3 sm:px-4">
          {hasSnippet && (
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-desk-muted">
                Matched line
              </p>
              <pre className="max-h-52 overflow-x-auto overflow-y-auto whitespace-pre-wrap break-all rounded-md border border-desk-border bg-[#010409] p-3 font-mono text-[12px] leading-relaxed text-[#79c0ff]">
                {issue.code_snippet.trim()}
              </pre>
            </div>
          )}

          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-desk-muted">
              Why you&apos;re seeing this
            </p>
            {issue.matched_rule ? (
              <p className="mb-2 text-[12px] leading-relaxed text-amber-950 dark:text-amber-200/90">
                <span className="text-desk-muted">What we checked: </span>
                {issue.matched_rule}
              </p>
            ) : null}
            <p className="text-sm leading-relaxed text-gray-800 dark:text-gray-300">{issue.description}</p>
          </div>

          {issue.suggestion && (
            <div className="rounded-md border border-brand-700/35 bg-brand-900/25 p-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-brand-700 dark:text-brand-400">
                <Lightbulb size={12} aria-hidden="true" />
                What to try
              </p>
              <p className="text-[12px] leading-relaxed text-gray-800 dark:text-gray-300">{issue.suggestion}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CategoryAccordion({ bucket, issues, initiallyOpen }) {
  const BucketIcon = bucket.icon;
  const [open, setOpen] = useState(initiallyOpen);
  const sevHints = useMemo(() => {
    const c = {};
    issues.forEach((i) => {
      if (i.severity) c[i.severity] = (c[i.severity] || 0) + 1;
    });
    return c;
  }, [issues]);

  return (
    <section
      className="card overflow-hidden"
      aria-label={`${bucket.title}: ${issues.length} issues`}
      id={`analysis-${bucket.id}`}
    >
      <button
        type="button"
        className="flex w-full flex-col gap-1 border-b border-desk-border px-4 py-3.5 text-left transition-colors hover:bg-desk-elevated/40 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-desk-border bg-desk-canvas">
            <BucketIcon size={17} className="text-gray-600 dark:text-gray-300" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[13px] font-semibold tracking-tight text-gray-900 dark:text-gray-50">
                {bucket.title}
              </h3>
              <span className="rounded-full border border-desk-border bg-desk-elevated px-2 py-0.5 text-[11px] font-medium tabular-nums text-desk-muted">
                {issues.length} issue{issues.length !== 1 ? 's' : ''}
              </span>
            </div>
            <p className="mt-0.5 text-[12px] text-desk-muted">{bucket.description}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 pl-12 sm:pl-0">
          <div className="flex flex-wrap gap-1.5">
            {SEVERITY_ORDER.filter((s) => sevHints[s] > 0).map((sev) => (
              <span key={sev} className="tabular-nums">
                <SeverityBadge severity={sev} />
                <span className="ml-0.5 align-middle text-[11px] text-desk-muted">{sevHints[sev]}</span>
              </span>
            ))}
          </div>
          <ChevronDown
            size={18}
            className={clsx('text-desk-muted transition-transform duration-200', open && 'rotate-180')}
            aria-hidden="true"
          />
        </div>
      </button>
      {open && (
        <div className="max-h-72 overflow-y-auto overscroll-contain border-t border-desk-border p-3 sm:max-h-80 sm:p-4">
          <div className="space-y-2">
            {issues.map((issue, i) => (
              <IssueAccordionRow
                key={issue.id ?? `${bucket.id}-${i}-${issue.line_number ?? 'x'}`}
                issue={issue}
                defaultOpen={i === 0 && issues.length <= 2}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

const SEVERITY_ROLLUP_LABEL = {
  critical: 'serious',
  warning: 'warnings',
  info: 'FYI',
  suggestion: 'suggestions',
};

function AnalysisFindingsPanel({ sortedIssues, byBucket, firstNonEmptyBucketId }) {
  const [expanded, setExpanded] = useState(false);

  const rollups = useMemo(() => {
    if (!sortedIssues.length) return null;
    const bySev = { critical: 0, warning: 0, info: 0, suggestion: 0 };
    for (const issue of sortedIssues) {
      if (bySev[issue.severity] != null) bySev[issue.severity]++;
    }
    const severityLine = SEVERITY_ORDER.filter((s) => bySev[s] > 0)
      .map((s) => `${bySev[s]} ${SEVERITY_ROLLUP_LABEL[s]}`)
      .join(' · ');
    const themeGroups = ANALYSIS_BUCKETS.reduce((n, b) => n + ((byBucket[b.id] ?? []).length > 0 ? 1 : 0), 0);
    return { severityLine, themeGroups };
  }, [sortedIssues, byBucket]);

  if (!sortedIssues.length || !rollups) return null;

  return (
    <section className="card mb-6 overflow-hidden p-0" aria-label="Analysis findings">
      <button
        type="button"
        id="analysis-findings-toggle"
        aria-expanded={expanded}
        aria-controls="analysis-findings-panel"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-desk-elevated/45 sm:px-5"
      >
        <ClipboardList size={18} className="shrink-0 text-desk-muted" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-desk-muted">
              Analysis findings
            </span>
            <span className="rounded-full border border-desk-border bg-desk-canvas px-2 py-0.5 font-mono text-[11px] font-medium tabular-nums text-gray-800 dark:text-gray-200">
              {sortedIssues.length}
            </span>
          </div>
          <p className="mt-1 text-[12px] text-desk-muted">
            {rollups.themeGroups} theme group{rollups.themeGroups !== 1 ? 's' : ''}
            {rollups.severityLine ? (
              <>
                <span aria-hidden="true"> · </span>
                <span>{rollups.severityLine}</span>
              </>
            ) : null}
            <span className="text-desk-subtle">{expanded ? ' — hide detail' : ' — show detail'}</span>
          </p>
        </div>
        <ChevronDown
          size={18}
          className={clsx('shrink-0 text-desk-muted transition-transform duration-200', expanded && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {expanded ? (
        <div
          id="analysis-findings-panel"
          role="region"
          aria-labelledby="analysis-findings-toggle"
          className="max-h-[min(28rem,calc(100vh-12rem))] overflow-y-auto overscroll-contain border-t border-desk-border px-2 pb-3 pt-3 sm:px-4 sm:pb-4"
        >
          <p className="mb-3 px-2 text-[11px] text-desk-muted sm:px-0">
            Themes below open individually. Long themes scroll inside their card — this panel scrolls for many themes.
          </p>
          <div className="flex flex-col gap-4">
            {ANALYSIS_BUCKETS.map((bucket) =>
              byBucket[bucket.id]?.length ? (
                <CategoryAccordion
                  key={bucket.id}
                  bucket={bucket}
                  issues={byBucket[bucket.id]}
                  initiallyOpen={bucket.id === firstNonEmptyBucketId}
                />
              ) : null
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function FilesChanged({ fileStats }) {
  const [expanded, setExpanded] = useState(false);

  const rollups = useMemo(() => {
    if (!fileStats?.length) return null;
    const totalAdd = fileStats.reduce((s, f) => s + (Number(f.additions) || 0), 0);
    const totalDel = fileStats.reduce((s, f) => s + (Number(f.deletions) || 0), 0);
    const withFindings = fileStats.filter((f) => Number(f.issues_count) > 0).length;
    return { totalAdd, totalDel, withFindings };
  }, [fileStats]);

  if (!fileStats?.length || !rollups) return null;

  return (
    <section className="card mb-6 overflow-hidden p-0" aria-label="Files changed in this commit">
      <button
        type="button"
        id="files-changed-toggle"
        aria-expanded={expanded}
        aria-controls="files-changed-panel"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-desk-elevated/45 sm:px-5"
      >
        <FileCode size={18} className="shrink-0 text-desk-muted" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-desk-muted">
              Files in this commit
            </span>
            <span className="rounded-full border border-desk-border bg-desk-canvas px-2 py-0.5 font-mono text-[11px] font-medium tabular-nums text-gray-800 dark:text-gray-200">
              {fileStats.length}
            </span>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[12px] text-desk-muted">
            <span className="tabular-nums text-emerald-700 dark:text-emerald-400">+{rollups.totalAdd}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums text-red-600 dark:text-[#ff7b72]">−{rollups.totalDel}</span>
            {rollups.withFindings > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums text-amber-900 dark:text-amber-300">
                  {rollups.withFindings} with findings
                </span>
              </>
            )}
            <span className="text-desk-subtle">{expanded ? ' — hide list' : ' — show list'}</span>
          </p>
        </div>
        <ChevronDown
          size={18}
          className={clsx('shrink-0 text-desk-muted transition-transform duration-200', expanded && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {expanded ? (
        <div
          id="files-changed-panel"
          role="region"
          aria-labelledby="files-changed-toggle"
          className="max-h-72 overflow-y-auto overscroll-contain border-t border-desk-border px-2 pb-3 pt-2 sm:max-h-80 sm:px-4"
        >
          <p className="mb-2 px-2 text-[11px] text-desk-muted sm:px-0">
            Per-file lines added/removed in the GitHub diff — scroll if the commit is large.
          </p>
          <div className="grid grid-cols-1 gap-px rounded-lg border border-desk-border bg-desk-border sm:grid-cols-2">
            {fileStats.map((f, idx) => (
              <div
                key={f.file_path || `changed-${idx}`}
                className="flex min-w-0 flex-col gap-1 bg-desk-panel p-3 sm:flex-row sm:items-center sm:gap-3"
              >
                <FileCode size={13} className="shrink-0 text-desk-subtle sm:mt-0" aria-hidden="true" />
                <span
                  className="min-w-0 flex-1 truncate font-mono text-[12px] text-gray-800 dark:text-gray-200"
                  title={f.file_path}
                >
                  {f.file_path}
                </span>
                <div className="flex shrink-0 flex-wrap items-center gap-x-2 font-mono text-[11px]">
                  <span className="tabular-nums text-emerald-700 dark:text-emerald-400">+{f.additions}</span>
                  <span className="tabular-nums text-red-600 dark:text-[#ff7b72]">−{f.deletions}</span>
                  {f.issues_count > 0 ? (
                    <span className="font-medium text-amber-900 tabular-nums dark:text-amber-300">
                      {f.issues_count} finding{f.issues_count === 1 ? '' : 's'}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
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

  const issues = useMemo(() => data?.review_issues ?? [], [data]);

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

  const firstNonEmptyBucketId = useMemo(
    () => ANALYSIS_BUCKETS.find((b) => byBucket[b.id]?.length > 0)?.id,
    [byBucket]
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
    return (
      <div className="mx-auto flex max-w-4xl flex-col items-center justify-center gap-5 px-4 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/35 bg-red-500/10">
          <XCircle size={26} className="text-[#ff7b72]" aria-hidden="true" />
        </div>
        <div>
          <h1 className="mb-1 text-base font-semibold text-gray-900 dark:text-gray-100">
            {is404 ? 'Review not found' : 'Something went wrong'}
          </h1>
          <p className="max-w-md text-sm text-desk-muted">
            {is404
              ? 'It may have been deleted or belongs to another account.'
              : 'We could not load this review. Try again shortly.'}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
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
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-desk-muted">Summary</p>
            <p className="text-sm leading-relaxed text-gray-800 dark:text-gray-300">{review.summary}</p>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-2" aria-label="Issue breakdown">
          {review.status === 'completed' && issues.length === 0 && (
            <span className="flex items-center gap-2 text-[12px] text-green-700 dark:text-green-400/95">
              <CheckCircle2 size={14} aria-hidden="true" />
              No flagged issues detected
            </span>
          )}
          {SEVERITY_ORDER.map((sev) =>
            issueCounts[sev] > 0 ? (
              <a
                key={sev}
                href={`#analysis-${bucketCategoryForSeverityJump(sev, byBucket)}`}
                className="inline-flex items-center gap-2 rounded-full border border-desk-border bg-desk-canvas px-2.5 py-1 text-[11px] text-gray-700 hover:border-brand-600/35 hover:bg-brand-600/10 dark:text-gray-300"
              >
                <SeverityBadge severity={sev} plainLanguage />
                <span className="tabular-nums text-desk-muted">{issueCounts[sev]}</span>
              </a>
            ) : null
          )}
        </div>
      </section>

      {review.status === 'failed' && (
        <div className="card mb-6 border-red-500/30 bg-red-500/[0.06] p-5">
          <div className="mb-4 flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[#ff7b72]" aria-hidden="true" />
            <div className="min-w-0 space-y-2">
              <p className="text-sm font-semibold text-red-100/95">Analysis pipeline failed</p>
              <p className="text-xs leading-relaxed text-red-100/85">
                This usually points to credential, GitHub access, quota, queue, or database issues—not a clean bill of
                health for the diff itself.
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

      <FilesChanged fileStats={fileStats} />

      <AnalysisFindingsPanel
        sortedIssues={sortedIssues}
        byBucket={byBucket}
        firstNonEmptyBucketId={firstNonEmptyBucketId}
      />
    </div>
  );
}
