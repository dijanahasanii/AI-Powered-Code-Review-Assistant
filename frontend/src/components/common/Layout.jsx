import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import clsx from 'clsx';
import { useUiPreferences } from '../../context/UiPreferencesContext';
import { BrowserOfflineBar } from './BrowserOfflineBar';
import { ReviewSocketCacheSync } from './ReviewSocketCacheSync';
import { NavContent } from './layout/NavContent';
import { WorkspaceChromeBar } from './layout/WorkspaceChromeBar';
import { RealtimeUpdatesBanner } from './layout/RealtimeUpdatesBanner';

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { density } = useUiPreferences();

  return (
    <div className="flex h-screen overflow-hidden bg-desk-canvas">
      <aside className="hidden w-[262px] shrink-0 flex-col border-r border-desk-border bg-desk-sidebar shadow-[4px_0_24px_rgba(0,0,0,0.45)] md:flex">
        <NavContent />
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          aria-modal="true"
          role="dialog"
          aria-label="Navigation menu"
        >
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            role="presentation"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-50 flex h-full w-[min(300px,90vw)] flex-col border-r border-desk-border bg-desk-sidebar shadow-2xl">
            <div className="flex items-center justify-end border-b border-desk-border px-2 py-1.5">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                className="rounded-lg p-2 text-desk-muted hover:bg-desk-panel hover:text-gray-900 dark:hover:text-gray-100"
              >
                <X size={18} />
              </button>
            </div>
            <NavContent onNavClick={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center gap-3 border-b border-desk-border bg-desk-sidebar px-4 py-3 md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            className="rounded-lg p-2 text-desk-muted hover:bg-desk-panel hover:text-gray-900 dark:hover:text-gray-100"
          >
            <Menu size={20} aria-hidden="true" />
          </button>
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-lg bg-gradient-to-br from-brand-600 to-brand-800 text-[9px] font-bold tracking-widest text-white">
              AI
            </div>
            <span className="truncate text-sm font-semibold tracking-tight text-gray-900 dark:text-gray-50">
              Code Review
            </span>
          </div>
        </header>

        <WorkspaceChromeBar />

        <BrowserOfflineBar />

        <RealtimeUpdatesBanner />

        <ReviewSocketCacheSync />

        <main
          data-density={density}
          className={clsx(
            'desk-main min-h-0 flex-1 overflow-y-auto overscroll-contain transition-[font-size] duration-200',
            density === 'compact' ? 'text-[13px]' : 'text-[15px]'
          )}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
