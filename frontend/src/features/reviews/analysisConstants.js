import {
  AlertTriangle,
  Lightbulb,
  Info,
  XCircle,
  Shield,
  Gauge,
  Braces,
} from 'lucide-react';

/** @type {Record<string, { icon: import('lucide-react').LucideIcon; color: string; wrap: string }>} */
export const SEVERITY_META = {
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

export const SEVERITY_ORDER = ['critical', 'warning', 'info', 'suggestion'];

export const CATEGORY_DISPLAY = {
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

export const ANALYSIS_BUCKETS = [
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

export const SEVERITY_ROLLUP_LABEL = {
  critical: 'serious',
  warning: 'warnings',
  info: 'FYI',
  suggestion: 'suggestions',
};

export function bucketCategory(raw) {
  const c = (raw || '').toLowerCase().trim();
  if (['security', 'bad-practice', 'error-handling'].includes(c)) return 'security';
  if (['performance', 'async'].includes(c)) return 'performance';
  return 'code-quality';
}

/** Severity strip links scroll to first bucket that contains that severity. */
export function bucketCategoryForSeverityJump(severity, bucketMap) {
  for (const bucket of ANALYSIS_BUCKETS) {
    const bucketIssues = bucketMap[bucket.id] ?? [];
    if (bucketIssues.some((i) => i.severity === severity)) return bucket.id;
  }
  return ANALYSIS_BUCKETS[0].id;
}
