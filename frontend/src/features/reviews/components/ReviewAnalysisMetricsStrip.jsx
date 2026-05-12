import { AlertTriangle, AlertCircle, Info, Clock, FileStack, Layers } from 'lucide-react';
import clsx from 'clsx';

function formatReviewDuration(startIso, endIso) {
  if (!startIso || !endIso) return null;
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const sec = ms / 1000;
  if (sec < 120) return `${sec < 10 ? sec.toFixed(1) : Math.round(sec)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${s}s`;
}

function MetricTile({ icon: Icon, label, value, sub, accent }) {
  return (
    <div
      className={clsx(
        'flex min-w-[7.5rem] flex-1 flex-col gap-1 rounded-xl border border-desk-border bg-desk-canvas/80 px-3 py-2.5 sm:min-w-0 sm:px-4 sm:py-3',
        accent
      )}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-desk-muted">
        <Icon size={12} className="shrink-0 opacity-90" aria-hidden="true" />
        {label}
      </div>
      <p className="text-lg font-semibold tabular-nums tracking-tight text-gray-900 dark:text-gray-50">{value}</p>
      {sub && <p className="text-[11px] leading-snug text-desk-muted">{sub}</p>}
    </div>
  );
}

/**
 * Compact analysis headline — issues, severity tiers, files, and wall-clock duration.
 */
export function ReviewAnalysisMetricsStrip({ review, issueCounts, totalIssues, fileStats }) {
  const files = Array.isArray(fileStats) ? fileStats.length : 0;
  const high = issueCounts?.critical ?? 0;
  const medium = issueCounts?.warning ?? 0;
  const low = (issueCounts?.info ?? 0) + (issueCounts?.suggestion ?? 0);
  const duration =
    review?.status === 'completed'
      ? formatReviewDuration(review.created_at, review.completed_at)
      : null;

  const status = review?.status;
  if (!status) return null;

  const showDuration = Boolean(duration);
  const showSeverityRow = status === 'completed' || status === 'failed';
  const showIssues = status === 'completed' || status === 'failed' || status === 'processing';

  if (!showIssues && status === 'pending') {
    return (
      <div
        className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-desk-border bg-desk-elevated/30 px-4 py-3 text-sm text-desk-muted"
        role="status"
        aria-live="polite"
      >
        <Clock size={16} className="shrink-0 text-desk-subtle" aria-hidden="true" />
        <span>Queued — metrics will appear when the run finishes.</span>
      </div>
    );
  }

  return (
    <div
      className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 lg:gap-3"
      aria-label="Analysis summary"
    >
      {showIssues && (
        <MetricTile
          icon={Layers}
          label="Issues found"
          value={totalIssues}
          sub={status === 'processing' ? 'Still scanning' : status === 'failed' ? 'Before failure' : 'In this run'}
          accent={totalIssues > 0 ? 'ring-1 ring-amber-500/15' : undefined}
        />
      )}
      {showSeverityRow && (
        <>
          <MetricTile
            icon={AlertTriangle}
            label="High severity"
            value={high}
            sub="Critical findings"
            accent={high > 0 ? 'ring-1 ring-red-500/20' : undefined}
          />
          <MetricTile icon={AlertCircle} label="Medium" value={medium} sub="Warnings" />
          <MetricTile icon={Info} label="Low / tips" value={low} sub="Info & suggestions" />
        </>
      )}
      <MetricTile
        icon={FileStack}
        label="Files analyzed"
        value={files}
        sub={files === 1 ? '1 path in diff' : `${files} paths in diff`}
      />
      {showDuration ? (
        <MetricTile icon={Clock} label="Duration" value={duration} sub="Start → completion" />
      ) : status === 'processing' ? (
        <MetricTile icon={Clock} label="Duration" value="—" sub="In progress" />
      ) : status === 'failed' ? (
        <MetricTile icon={Clock} label="Duration" value="—" sub="Run did not complete" />
      ) : null}
    </div>
  );
}
