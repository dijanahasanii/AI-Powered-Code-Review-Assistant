import { Link } from 'react-router-dom';
import clsx from 'clsx';

export function ReviewHintBanner({ hint }) {
  if (!hint) return null;
  return (
    <div
      className={clsx(
        'mb-4 rounded-md border px-4 py-3 text-sm',
        hint.tone === 'error'
          ? 'border-red-500/30 bg-red-500/10 text-red-200'
          : hint.tone === 'info'
            ? 'border-amber-500/30 bg-amber-500/10 text-amber-100'
            : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
      )}
    >
      <p>{hint.text}</p>
      <Link to="/reviews" className="mt-2 inline-block text-xs font-medium underline">
        Jump to Reviews
      </Link>
    </div>
  );
}
