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

export const StatusBadge = ({ status }) => {
  const map = {
    pending: 'bg-gray-500/15 text-gray-400 border-gray-500/20',
    processing: 'bg-blue-500/15 text-blue-400 border-blue-500/20 animate-pulse',
    completed: 'bg-green-500/15 text-green-400 border-green-500/20',
    failed: 'bg-red-500/15 text-red-400 border-red-500/20',
  };
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
        map[status]
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
  <div className="flex flex-col items-center justify-center py-16 text-center px-4">
    {Icon && (
      <div className="w-12 h-12 rounded-2xl bg-gray-800 flex items-center justify-center mb-4">
        <Icon size={22} className="text-gray-500" aria-hidden="true" />
      </div>
    )}
    <h3 className="text-sm font-medium text-gray-300 mb-1">{title}</h3>
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
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1f2937" strokeWidth={4} />
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
export const PageHeader = ({ title, description, action }) => (
  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
    <div className="min-w-0">
      <h1 className="text-xl font-semibold text-white">{title}</h1>
      {description && <p className="text-sm text-gray-400 mt-0.5">{description}</p>}
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
