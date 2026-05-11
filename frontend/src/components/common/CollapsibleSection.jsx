import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import clsx from 'clsx';

const LABEL_SHOW = ' — show list';
const LABEL_HIDE = ' — hide list';

/**
 * Expandable summary row + collapsible panel (Dashboard, Review detail, etc.).
 * Set expandable={false} for a static header with the panel always visible.
 */
export default function CollapsibleSection({
  idPrefix = 'collapsible',
  icon: Icon,
  title,
  badge,
  summary,
  /** If true, use "detail" wording instead of "list" */
  wording = 'list',
  defaultExpanded = false,
  /** When false, panel is always shown; no toggle, chevron, or show/hide hint */
  expandable = true,
  panelClassName = '',
  className,
  variant = 'card',
  /** Shown in the header row (e.g. header link) */
  controls = null,
  /** Set false to hide the trailing show/hide hint */
  trailingHint = true,
  children,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const btnId = `${idPrefix}-toggle`;
  const panelId = `${idPrefix}-panel`;
  const showLabel =
    wording === 'detail'
      ? { show: ' — show detail', hide: ' — hide detail' }
      : { show: LABEL_SHOW, hide: LABEL_HIDE };
  const isOpen = expandable ? expanded : true;
  const suffix =
    expandable && trailingHint ? (expanded ? showLabel.hide : showLabel.show) : null;

  /** Shared inset so title, stats, and chevron are not flush to the card edges (still full-width tap target). */
  const headerPad = 'px-4 py-4 sm:px-5 sm:py-4';
  const toggleBtnCls =
    headerPad +
    ' flex w-full flex-wrap items-start gap-x-3 gap-y-2 text-left transition-colors hover:bg-desk-elevated/45 sm:flex-nowrap sm:items-center ' +
    'focus:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-brand-500/55 ' +
    'focus-visible:ring-offset-2 focus-visible:ring-offset-desk-panel dark:focus-visible:ring-offset-desk-sidebar';

  const staticHeaderCls =
    headerPad + ' flex w-full flex-wrap items-start gap-x-3 gap-y-2 text-left sm:flex-nowrap sm:items-center';

  const outer =
    variant === 'plain'
      ? clsx('overflow-hidden', className)
      : clsx('card mb-6 overflow-hidden p-0', className);

  const headerBody = (
    <>
      {Icon ? (
        <Icon size={18} className="shrink-0 text-desk-muted" aria-hidden="true" />
      ) : null}
      <div className="min-w-0 flex-1 basis-[min(100%,14rem)] sm:basis-auto">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-desk-muted">{title}</span>
          {badge != null && badge !== false ? (
            <span className="rounded-full border border-desk-border bg-desk-canvas px-2 py-0.5 font-mono text-[11px] font-medium tabular-nums text-gray-800 dark:text-gray-200">
              {badge}
            </span>
          ) : null}
        </div>
        {summary ? (
          <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[12px] text-desk-muted">
            {summary}
            {suffix ? <span className="text-desk-subtle">{suffix}</span> : null}
          </p>
        ) : (
          expandable &&
          trailingHint && <p className="mt-1.5 text-[12px] text-desk-subtle">{suffix}</p>
        )}
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
        {controls}
        {expandable ? (
          <ChevronDown
            size={18}
            className={clsx('text-desk-muted transition-transform duration-200', expanded && 'rotate-180')}
            aria-hidden="true"
          />
        ) : null}
      </div>
    </>
  );

  return (
    <section className={outer} aria-label={title}>
      {expandable ? (
        <button
          type="button"
          id={btnId}
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => setExpanded((v) => !v)}
          className={toggleBtnCls}
        >
          {headerBody}
        </button>
      ) : (
        <div id={btnId} className={staticHeaderCls}>
          {headerBody}
        </div>
      )}
      {isOpen ? (
        <div
          id={panelId}
          role="region"
          aria-labelledby={btnId}
          className={clsx(variant !== 'plain' && 'border-t border-desk-border', panelClassName)}
        >
          {children}
        </div>
      ) : null}
    </section>
  );
}
