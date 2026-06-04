import clsx from 'clsx';

export const RemediationStatusBadge = ({ status, compact }) => {
  const map = {
    pending: 'bg-desk-elevated text-desk-muted border-desk-border',
    not_needed: 'bg-green-500/10 text-green-400/95 border-green-500/28',
    confirmed: 'bg-amber-500/10 text-amber-300 border-amber-500/28',
    running: 'bg-blue-500/12 text-[#79c0ff] border-blue-500/25 animate-pulse',
    validating: 'bg-violet-500/12 text-violet-300 border-violet-500/25 animate-pulse',
    pushed: 'bg-green-500/10 text-green-400/95 border-green-500/28',
    failed: 'bg-red-500/10 text-[#ff7b72] border-red-500/28',
  };
  const labelMap = {
    pushed: 'fixes pushed',
    not_needed: 'no fixes needed',
  };
  const label = labelMap[status] ?? status;
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border font-medium capitalize',
        compact ? 'px-1.5 py-0 text-[10px]' : 'px-2 py-0.5 text-xs',
        map[status] ?? map.pending
      )}
    >
      {label}
    </span>
  );
};
