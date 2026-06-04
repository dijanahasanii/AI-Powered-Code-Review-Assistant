import clsx from 'clsx';

export const PageHeader = ({ title, description, hint, action, compact = false }) => (
  <div
    className={clsx(
      'flex flex-col sm:flex-row sm:items-start sm:justify-between',
      compact ? 'mb-6 gap-3' : 'mb-10 gap-5'
    )}
  >
    <div className="min-w-0">
      <h1
        className={clsx(
          'font-bold tracking-tight text-gray-900 dark:text-gray-50',
          compact ? 'text-xl leading-snug' : 'text-2xl sm:text-[1.65rem] sm:leading-snug'
        )}
      >
        {title}
      </h1>
      {description && (
        <p
          className={clsx(
            'max-w-2xl text-desk-muted',
            compact ? 'mt-1.5 text-[13px] leading-snug' : 'mt-2 text-[15px] leading-relaxed md:text-[0.9375rem]'
          )}
        >
          {description}
        </p>
      )}
      {hint && (
        <p
          className={clsx(
            'max-w-2xl text-desk-muted',
            compact ? 'mt-1 text-xs leading-snug' : 'mt-2 text-[13px] leading-snug'
          )}
        >
          {hint}
        </p>
      )}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);
