import { AlertTriangle, AlertCircle, Info, Lightbulb, Layers, GitBranch, Hash } from 'lucide-react';
import clsx from 'clsx';

function MetricTile({ icon: Icon, label, value, sub, accent }) {
  return (
    <div
      className={clsx(
        'flex flex-col gap-1 rounded-xl border border-desk-border bg-desk-canvas/80 px-3 py-2.5 sm:px-4 sm:py-3',
        accent
      )}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-desk-muted">
        <Icon size={12} className="shrink-0 opacity-90" aria-hidden="true" />
        {label}
      </div>
      <p className="text-xl font-semibold tabular-nums tracking-tight text-gray-900 dark:text-gray-50">{value}</p>
      {sub && <p className="text-[11px] leading-snug text-desk-muted">{sub}</p>}
    </div>
  );
}

export function ReportMetricsStrip({ issueCount, severitySummary, overallScore }) {
  const s = severitySummary || {};

  return (
    <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 lg:gap-3" aria-label="Report metrics">
      <MetricTile
        icon={Layers}
        label="Total issues"
        value={issueCount ?? 0}
        sub="In this report"
        accent={(issueCount ?? 0) > 0 ? 'ring-1 ring-amber-500/15' : undefined}
      />
      <MetricTile
        icon={AlertTriangle}
        label="Critical"
        value={s.critical ?? 0}
        sub="Highest priority"
        accent={(s.critical ?? 0) > 0 ? 'ring-1 ring-red-500/20' : undefined}
      />
      <MetricTile icon={AlertCircle} label="Warnings" value={s.warning ?? 0} sub="Should review" />
      <MetricTile icon={Info} label="Info" value={s.info ?? 0} sub="Advisory" />
      <MetricTile icon={Lightbulb} label="Suggestions" value={s.suggestion ?? 0} sub="Optional polish" />
      {overallScore != null ? (
        <MetricTile icon={Hash} label="Quality score" value={overallScore} sub="Out of 100" />
      ) : (
        <MetricTile icon={GitBranch} label="Score" value="N/A" sub="Not scored" />
      )}
    </div>
  );
}
