export const EmptyState = ({ icon: Icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
    {Icon && (
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-desk-border bg-desk-elevated/60 dark:bg-gray-800">
        <Icon size={22} className="text-desk-muted dark:text-gray-400" aria-hidden="true" />
      </div>
    )}
    <h3 className="mb-1 text-sm font-medium text-gray-800 dark:text-gray-300">{title}</h3>
    {description && (
      <p className="mb-4 max-w-md text-sm leading-relaxed text-gray-500 break-words dark:text-gray-400">{description}</p>
    )}
    {action}
  </div>
);
