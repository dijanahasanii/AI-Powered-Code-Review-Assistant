import { Link } from 'react-router-dom';
import clsx from 'clsx';

export function ReviewHintBanner({ hint }) {
  if (!hint) return null;
  return (
    <div
      className={clsx(
        'mb-4 rounded-md border px-4 py-3 text-sm',
        hint.tone === 'error'
          ? 'border-red-600/30 bg-red-500/10 text-red-950 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200'
          : hint.tone === 'info'
            ? 'border-amber-600/30 bg-amber-500/[0.12] text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100'
            : 'border-emerald-600/30 bg-emerald-500/[0.14] text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100'
      )}
    >
      <p>{hint.text}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <Link to="/reviews" className="text-xs font-medium underline underline-offset-2">
          Jump to Reviews
        </Link>
        <Link to="/reports" className="text-xs font-medium underline underline-offset-2">
          Jump to AI Reports
        </Link>
      </div>
    </div>
  );
}
