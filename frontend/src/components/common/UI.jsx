import { useState } from 'react';
import clsx from 'clsx';

// ── Badge ─────────────────────────────────────────────────────────────────────
const SEVERITY_SIMPLE_LABEL = {
  critical: 'Serious',
  warning: 'Needs attention',
  info: 'FYI',
  suggestion: 'Suggestion',
};

export const SeverityBadge = ({ severity, plainLanguage }) => {
  const map = {
    critical: 'badge-critical',
    warning: 'badge-warning',
    info: 'badge-info',
    suggestion: 'badge-suggestion',
  };
  const label =
    plainLanguage && SEVERITY_SIMPLE_LABEL[severity]
      ? SEVERITY_SIMPLE_LABEL[severity]
      : severity;
  return <span className={map[severity] || 'badge-info'}>{label}</span>;
};

export const StatusBadge = ({ status, compact }) => {
  const map = {
    pending:
      'bg-desk-elevated text-desk-muted border-desk-border',
    processing: 'bg-blue-500/12 text-[#79c0ff] border-blue-500/25 animate-pulse',
    completed: 'bg-green-500/10 text-green-400/95 border-green-500/28',
    failed: 'bg-red-500/10 text-[#ff7b72] border-red-500/28',
  };
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border font-medium capitalize',
        compact ? 'px-1.5 py-0 text-[10px]' : 'px-2 py-0.5 text-xs',
        map[status] ?? map.pending
      )}
    >
      {status}
    </span>
  );
};

// ── Spinner ───────────────────────────────────────────────────────────────────
export const Spinner = ({ size = 'md', className = '' }) => {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' };
  return (
    <div
      role="status"
      aria-label="Loading"
      className={clsx(
        'animate-spin rounded-full border-2 border-gray-700 border-t-brand-500',
        sizes[size],
        className
      )}
    />
  );
};

// ── Empty state ───────────────────────────────────────────────────────────────
export const EmptyState = ({ icon: Icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
    {Icon && (
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-desk-border bg-desk-elevated/60 dark:bg-gray-800">
        <Icon size={22} className="text-desk-muted dark:text-gray-400" aria-hidden="true" />
      </div>
    )}
    <h3 className="mb-1 text-sm font-medium text-gray-800 dark:text-gray-300">{title}</h3>
    {description && <p className="text-sm text-gray-500 max-w-xs mb-4">{description}</p>}
    {action}
  </div>
);

// ── Score ring (SVG circle progress) ─────────────────────────────────────────
export const ScoreRing = ({ score, size = 64 }) => {
  if (score == null) {
    return (
      <div
        className="text-gray-600 text-xs flex items-center justify-center rounded-full border-2 border-gray-800 shrink-0"
        style={{ width: size, height: size }}
        aria-label="No score available"
      >
        —
      </div>
    );
  }

  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = circumference - (score / 100) * circumference;

  const color =
    score >= 80 ? '#4ade80' : score >= 60 ? '#facc15' : score >= 40 ? '#fb923c' : '#f87171';

  return (
    <div
      className="relative flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
      aria-label={`Quality score ${score} out of 100`}
    >
      <svg
        width={size}
        height={size}
        className="-rotate-90 text-gray-200 dark:text-gray-700"
        aria-hidden="true"
      >
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={4} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeDasharray={circumference}
          strokeDashoffset={progress}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <span className="absolute text-xs font-semibold tabular-nums" style={{ color }}>
        {score}
      </span>
    </div>
  );
};

// ── Page header ───────────────────────────────────────────────────────────────
export const PageHeader = ({ title, description, hint, action }) => (
  <div className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
    <div className="min-w-0">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50 sm:text-[1.65rem] sm:leading-snug">
        {title}
      </h1>
      {description && (
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-desk-muted md:text-[0.9375rem]">{description}</p>
      )}
      {hint && (
        <p className="mt-2 max-w-2xl text-[13px] leading-snug text-desk-muted">{hint}</p>
      )}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

// ── Avatar ───────────────────────────────────────────────────────────────────
export const Avatar = ({ src, alt, size = 28 }) => {
  const safeAlt = typeof alt === 'string' && alt.trim() ? alt.trim() : 'Account';
  const initials = safeAlt ? safeAlt.slice(0, 2).toUpperCase() : '?';
  const [imgFailed, setImgFailed] = useState(false);
  const showInitials = !src || imgFailed;

  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-800"
      style={{ width: size, height: size }}
      title={safeAlt}
    >
      {!showInitials && (
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setImgFailed(true)}
        />
      )}
      {showInitials && (
        <span
          className="flex h-full w-full items-center justify-center rounded-full bg-brand-600 font-medium leading-none text-white"
          style={{ fontSize: size * 0.38 }}
          aria-hidden="true"
        >
          {initials}
        </span>
      )}
      <span className="sr-only">{safeAlt}</span>
    </span>
  );
};
