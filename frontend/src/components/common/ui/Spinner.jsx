import clsx from 'clsx';

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
