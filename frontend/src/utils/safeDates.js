import { formatDistanceToNow, format } from 'date-fns';

/** Avoid RangeError/runtime noise when APIs return nullable or garbage timestamps */
export function safeDistanceToNow(value, opts) {
  if (value == null || value === '') return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(d.getTime())) return '—';
  try {
    return formatDistanceToNow(d, { addSuffix: true, ...opts });
  } catch {
    return '—';
  }
}

export function safeFormatDateTime(value) {
  if (value == null || value === '') return '';
  const d = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(d.getTime())) return '';
  try {
    return format(d, 'PPpp');
  } catch {
    return '';
  }
}
