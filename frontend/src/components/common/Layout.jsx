import { useState, useMemo, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, Link, useLocation } from 'react-router-dom';
import {
  GitBranch,
  ClipboardList,
  LogOut,
  Unplug,
  Menu,
  X,
  FlaskConical,
  Settings,
  ChevronRight,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useUiPreferences } from '../../context/UiPreferencesContext';
import { Avatar } from './UI';
import { BrowserOfflineBar } from './BrowserOfflineBar';

const navPrimary = [
  { to: '/dashboard', icon: FlaskConical, label: 'Analysis', end: true },
  { to: '/repositories', icon: GitBranch, label: 'Repos', end: false },
  { to: '/reviews', icon: ClipboardList, label: 'Reviews', end: true },
];

function useWorkspaceBreadcrumbs() {
  const { pathname } = useLocation();
  return useMemo(() => {
    if (pathname === '/dashboard')
      return [
        { label: 'Workspace', to: '/dashboard' },
        { label: 'Analysis', to: '/dashboard', current: true },
      ];
    if (pathname === '/repositories')
      return [
        { label: 'Workspace', to: '/dashboard' },
        { label: 'Repositories', to: '/repositories', current: true },
      ];
    if (pathname === '/reviews')
      return [
        { label: 'Workspace', to: '/dashboard' },
        { label: 'Reviews', to: '/reviews', current: true },
      ];
    if (/^\/reviews\/[^/]+$/.test(pathname))
      return [
        { label: 'Workspace', to: '/dashboard' },
        { label: 'Reviews', to: '/reviews' },
        { label: 'Run detail', to: pathname, current: true },
      ];
    if (pathname === '/settings')
      return [
        { label: 'Workspace', to: '/dashboard' },
        { label: 'Settings', to: '/settings', current: true },
      ];
    return [{ label: 'Workspace', to: '/dashboard', current: true }];
  }, [pathname]);
}

/** When online but Socket.IO is down: same banner pattern as BrowserOfflineBar (lead + detail), non-blocking status. */
function RealtimeUpdatesBanner() {
  const { user } = useAuth();
  const { connected } = useSocket();
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!user || connected) {
      setVisible(false);
      return undefined;
    }
    timerRef.current = setTimeout(() => setVisible(true), 650);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [user, connected]);

  if (!user || !visible || connected) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex shrink-0 items-start gap-2.5 border-b border-amber-500/30 bg-amber-500/[0.09] px-4 py-2.5 text-amber-950 dark:text-amber-100 sm:px-6"
    >
      <Unplug size={17} className="mt-0.5 shrink-0 text-amber-800 dark:text-amber-400/95" aria-hidden="true" />
      <p className="text-[13px] leading-snug">
        <span className="font-semibold text-amber-950 dark:text-amber-50">Live updates paused.</span>{' '}
        The realtime channel is reconnecting — lists and review detail still load over the API and refresh on an interval
        until the socket is restored.
      </p>
    </div>
  );
}

function WorkspaceChromeBar() {
  const crumbs = useWorkspaceBreadcrumbs();
  const { pathname } = useLocation();
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

function NavContent({ onNavClick }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-black/10 px-3 py-4 dark:border-white/10">
        <div className="flex items-center gap-3 px-2">
          <div
            className="flex h-9 w-9 shrink-0 select-none items-center justify-center rounded-xl border border-desk-border bg-gradient-to-br from-brand-700/85 to-brand-600/40 text-[10px] font-bold tracking-[0.12em] text-white shadow-inner"
            aria-hidden="true"
          >
            AI
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold tracking-tight text-gray-900 dark:text-gray-50">
              Code Review
            </p>
            <p className="truncate text-[10px] uppercase tracking-[0.16em] text-desk-muted">Beta</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4" aria-label="Main navigation">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-desk-muted">Navigate</p>
        {navPrimary.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={`${to}-${label}`}
            to={to}
            end={end}
            onClick={onNavClick}
            className={({ isActive }) =>
              clsx(
                'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-colors duration-150',
                isActive
                  ? 'bg-desk-panel text-gray-900 shadow-lg shadow-black/25 ring-2 ring-brand-500/50 dark:text-gray-50 dark:shadow-black/50'
                  : 'text-desk-muted hover:bg-desk-panel/60 hover:text-gray-900 dark:hover:text-gray-100'
              )
            }
          >
            <Icon size={17} aria-hidden="true" className="shrink-0 opacity-95" />
            <span>{label}</span>
          </NavLink>
        ))}

        <div className="mt-8 border-t border-desk-border pt-4">
          <NavLink
            to="/settings"
            end
            onClick={onNavClick}
            className={({ isActive }) =>
              clsx(
                'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold transition-colors',
                isActive
                  ? 'bg-desk-panel text-gray-900 ring-2 ring-desk-subtle dark:text-gray-50'
                  : 'text-desk-muted hover:bg-desk-panel/60 hover:text-gray-900 dark:hover:text-gray-100'
              )
            }
          >
            <Settings size={17} aria-hidden="true" className="shrink-0" />
            Settings
          </NavLink>
        </div>
      </nav>

      <div className="shrink-0 space-y-2 border-t border-black/10 px-2 py-4 dark:border-white/10">
        {user && (
          <div className="mx-1 flex items-center gap-2.5 rounded-xl border border-desk-border bg-desk-canvas px-2 py-2">
            <Avatar src={user.avatarUrl} alt={user.username} size={30} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold text-gray-900 dark:text-gray-50">{user.username}</p>
              <p className="truncate font-mono text-[10px] text-desk-muted">github.com</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Sign out"
              className="rounded-lg p-1.5 text-desk-muted transition-colors hover:bg-red-500/15 hover:text-red-300"
            >
              <LogOut size={14} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

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
