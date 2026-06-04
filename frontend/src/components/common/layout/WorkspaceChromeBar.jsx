import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useWorkspaceBreadcrumbs } from './useWorkspaceBreadcrumbs';

export function WorkspaceChromeBar() {
  const crumbs = useWorkspaceBreadcrumbs();
  const { pathname } = useLocation();

  // Dashboard title lives in-page; skip duplicate breadcrumb strip to save vertical space.
  if (pathname === '/dashboard') return null;

  const suffix = pathname.startsWith('/reviews/')
    ? pathname.split('/').pop()?.slice(0, 8) ?? ''
    : '';

  return (
    <header
      role="presentation"
      className="hidden max-h-[52px] shrink-0 border-b border-desk-border bg-desk-panel/90 px-6 py-3 backdrop-blur-md md:flex md:items-center md:justify-between"
    >
      <nav aria-label="Breadcrumbs" className="flex flex-wrap items-center gap-1 text-[13px]">
        {crumbs.map((c, i) => (
          <span key={`${c.to}-${i}`} className="flex items-center gap-1 font-medium">
            {i > 0 && (
              <ChevronRight size={13} strokeWidth={2} className="text-desk-subtle" aria-hidden="true" />
            )}
            {c.current ? (
              <span className="text-gray-900 dark:text-gray-50">{c.label}</span>
            ) : (
              <Link className="text-desk-muted transition-colors hover:text-brand-400" to={c.to}>
                {c.label}
              </Link>
            )}
          </span>
        ))}
      </nav>
      {suffix ? (
        <span className="ml-6 hidden max-w-xs truncate rounded-md border border-desk-border bg-desk-canvas px-3 py-1 font-mono text-[11px] text-desk-muted lg:inline-block">
          {`id ${suffix}`}
        </span>
      ) : null}
    </header>
  );
}
