import { NavLink, useNavigate } from 'react-router-dom';
import { LogOut, Settings } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../../context/AuthContext';
import { Avatar } from '../UI';
import { navPrimary } from './navConfig';

export function NavContent({ onNavClick }) {
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
