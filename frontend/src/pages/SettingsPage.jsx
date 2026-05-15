import { Link, useNavigate } from 'react-router-dom';
import {
  ExternalLink,
  LogOut,
  User,
  PanelsTopLeft,
  Gauge,
  FlaskConical,
  GitBranch,
  ClipboardList,
  FileText,
  Sun,
  Moon,
  Monitor,
  Wifi,
  WifiOff,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useUiPreferences } from '../context/UiPreferencesContext';
import { Avatar, PageHeader } from '../components/common/UI';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { connected } = useSocket();
  const { density, setDensity, theme, setTheme, resolvedTheme } = useUiPreferences();

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.history.replaceState(null, '', `#${id}`);
  };

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:flex-row lg:gap-12 lg:px-8 lg:py-10">
      <aside className="lg:sticky lg:top-24 lg:z-10 lg:max-h-[calc(100vh-6rem)] lg:w-52 lg:shrink-0 lg:self-start lg:overflow-y-auto lg:pt-1">
        <p className="mb-3 hidden px-1 text-[11px] font-semibold uppercase tracking-wider text-desk-muted lg:block">
          Settings
        </p>
        <nav
          aria-label="Settings sections"
          className="-mx-2 flex gap-1 overflow-x-auto pb-3 lg:mx-0 lg:flex lg:flex-col lg:overflow-visible lg:pb-0"
        >
          {[
            { id: 'account', label: 'Account', icon: User },
            { id: 'appearance', label: 'Appearance', icon: PanelsTopLeft },
            { id: 'workspace', label: 'Workspace', icon: Gauge },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => scrollToSection(id)}
              className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-medium whitespace-nowrap text-desk-muted transition-colors hover:bg-desk-panel hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-desk-canvas dark:hover:text-gray-100 dark:focus-visible:ring-offset-desk-panel"
            >
              <Icon size={15} aria-hidden="true" className="opacity-85" />
              {label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 flex-1 space-y-10">
        <PageHeader
          title="Workspace settings"
          description="Signed in with GitHub. Changes here affect this browser session only—they don’t call the API."
          hint="On large screens the left nav stays pinned while you scroll. These prefs are browser-only — the API does not store them yet."
        />

        <section id="account" className="scroll-mt-28">
          <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-desk-muted">
            GitHub identity
          </h2>
          <div className="card divide-y divide-desk-border overflow-hidden">
            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                {user ? <Avatar src={user.avatarUrl} alt={user.username} size={48} /> : null}
                <div>
                  <p className="font-mono text-base font-semibold text-gray-900 dark:text-gray-50">
                    {user?.username ?? '—'}
                  </p>
                  <p className="mt-1 text-[13px] text-desk-muted">OAuth login via backend — no password stored.</p>
                </div>
              </div>
              <button
                type="button"
                className="btn-secondary border border-desk-border hover:border-red-500/35 hover:bg-red-500/10 hover:text-red-300"
                onClick={handleLogout}
              >
                <LogOut size={16} aria-hidden="true" />
                Sign out
              </button>
            </div>
            <div className="p-5">
              <a
                href="https://github.com/settings/apps/authorizations"
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-2 text-[13px] font-medium text-brand-400 hover:text-brand-300"
              >
                Manage GitHub OAuth on github.com
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>

        <section id="appearance" className="scroll-mt-28">
          <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-desk-muted">Appearance</h2>
          <div className="card space-y-4 p-5">
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-50">Theme</p>
              <p className="mt-1 text-[13px] text-desk-muted">
                Light, dark, or match your system. Current appearance:{' '}
                <span className="font-medium text-gray-800 dark:text-gray-200">{resolvedTheme}</span>.
              </p>
              <div
                className="mt-4 inline-flex rounded-xl border border-desk-border bg-desk-canvas p-1 shadow-inner"
                role="radiogroup"
                aria-label="Color theme"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={theme === 'light'}
                  onClick={() => setTheme('light')}
                  className={clsx(
                    'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-semibold transition-all',
                    theme === 'light'
                      ? 'bg-desk-panel text-gray-900 ring-1 ring-desk-subtle shadow-sm dark:text-gray-50'
                      : 'text-desk-muted hover:text-gray-800 dark:hover:text-gray-200'
                  )}
                >
                  <Sun size={15} aria-hidden="true" />
                  Light
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={theme === 'dark'}
                  onClick={() => setTheme('dark')}
                  className={clsx(
                    'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-semibold transition-all',
                    theme === 'dark'
                      ? 'bg-desk-panel text-gray-900 ring-1 ring-desk-subtle shadow-sm dark:text-gray-50'
                      : 'text-desk-muted hover:text-gray-800 dark:hover:text-gray-200'
                  )}
                >
                  <Moon size={15} aria-hidden="true" />
                  Dark
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={theme === 'system'}
                  onClick={() => setTheme('system')}
                  className={clsx(
                    'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-semibold transition-all',
                    theme === 'system'
                      ? 'bg-desk-panel text-gray-900 ring-1 ring-desk-subtle shadow-sm dark:text-gray-50'
                      : 'text-desk-muted hover:text-gray-800 dark:hover:text-gray-200'
                  )}
                >
                  <Monitor size={15} aria-hidden="true" />
                  System
                </button>
              </div>
            </div>

            <div className="border-t border-desk-border pt-5">
              <p className="font-medium text-gray-900 dark:text-gray-50">Live updates</p>
              <p className="mt-1 text-[13px] text-desk-muted">
                When connected, review and queue changes reach this tab over the socket; otherwise the app polls on an
                interval. The workspace header shows an amber strip when the socket is down, and a sky strip when the
                browser reports offline.
              </p>
              <div
                className={clsx(
                  'mt-3 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-medium',
                  connected
                    ? 'border-emerald-500/35 bg-emerald-500/[0.1] text-emerald-900 dark:text-emerald-300/95'
                    : 'border-desk-border bg-desk-canvas text-desk-muted'
                )}
                role="status"
                aria-live="polite"
              >
                {connected ? (
                  <>
                    <Wifi size={15} className="shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                    Connected — realtime push enabled
                  </>
                ) : (
                  <>
                    <WifiOff size={15} className="shrink-0 opacity-80" aria-hidden="true" />
                    {user ? 'Not connected — periodic refresh only' : 'Sign in to enable live updates'}
                  </>
                )}
              </div>
            </div>

            <div className="border-t border-desk-border pt-5">
              <p className="font-medium text-gray-900 dark:text-gray-50">Density</p>
              <p className="mt-1 text-[13px] text-desk-muted">
                Comfortable mode leaves more whitespace; Compact tightens typography and pacing across the dashboard.
              </p>
              <div
                className="mt-4 inline-flex rounded-xl border border-desk-border bg-desk-canvas p-1 shadow-inner"
                role="radiogroup"
                aria-label="Interface density"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={density === 'comfort'}
                  onClick={() => setDensity('comfort')}
                  className={clsx(
                    'rounded-lg px-4 py-2 text-[13px] font-semibold transition-all',
                    density === 'comfort'
                      ? 'bg-desk-panel text-gray-900 ring-1 ring-desk-subtle shadow-sm dark:text-gray-50'
                      : 'text-desk-muted hover:text-gray-700 dark:hover:text-gray-300'
                  )}
                >
                  Comfortable
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={density === 'compact'}
                  onClick={() => setDensity('compact')}
                  className={clsx(
                    'rounded-lg px-4 py-2 text-[13px] font-semibold transition-all',
                    density === 'compact'
                      ? 'bg-desk-panel text-gray-900 ring-1 ring-desk-subtle shadow-sm dark:text-gray-50'
                      : 'text-desk-muted hover:text-gray-700 dark:hover:text-gray-300'
                  )}
                >
                  Compact
                </button>
              </div>
            </div>
          </div>
        </section>

        <section id="workspace" className="scroll-mt-28">
          <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-desk-muted">Workspace</h2>
          <div className="card divide-y divide-desk-border overflow-hidden">
            <p className="p-5 text-[13px] leading-relaxed text-desk-muted">
              Jump between product areas — same shortcuts as in the sidebar. No extra configuration exists until the
              backend exposes preferences endpoints.
            </p>
            <ul className="divide-y divide-desk-border font-mono text-[13px]">
              <li>
                <Link
                  to="/dashboard"
                  className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-desk-elevated/35"
                >
                  <FlaskConical size={17} className="text-brand-400" aria-hidden="true" />
                  <span className="font-sans text-gray-900 dark:text-gray-100">Analysis overview</span>
                  <span className="text-desk-subtle">/dashboard</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/repositories"
                  className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-desk-elevated/35"
                >
                  <GitBranch size={17} className="text-brand-400" aria-hidden="true" />
                  <span className="font-sans text-gray-900 dark:text-gray-100">Repositories</span>
                  <span className="text-desk-subtle">/repositories</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/reviews"
                  className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-desk-elevated/35"
                >
                  <ClipboardList size={17} className="text-brand-400" aria-hidden="true" />
                  <span className="font-sans text-gray-900 dark:text-gray-100">Reviews</span>
                  <span className="text-desk-subtle">/reviews</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/reports"
                  className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-desk-elevated/35"
                >
                  <FileText size={17} className="text-brand-400" aria-hidden="true" />
                  <span className="font-sans text-gray-900 dark:text-gray-100">AI Reports</span>
                  <span className="text-desk-subtle">/reports</span>
                </Link>
              </li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
