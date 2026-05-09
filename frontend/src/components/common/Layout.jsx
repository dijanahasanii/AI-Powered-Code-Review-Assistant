import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  GitBranch,
  ClipboardList,
  LogOut,
  Wifi,
  WifiOff,
  Menu,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { Avatar } from './UI';
const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/repositories', icon: GitBranch, label: 'Repositories' },
  { to: '/reviews', icon: ClipboardList, label: 'Reviews' },
];

function NavContent({ onNavClick }) {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-4 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center text-white text-xs font-bold select-none">
            AI
          </div>
          <span className="font-semibold text-sm text-white tracking-tight">Code Review</span>
        </div>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto" aria-label="Main navigation">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/reviews'}
            onClick={onNavClick}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150',
                isActive
                  ? 'bg-brand-600/15 text-brand-400'
                  : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800'
              )
            }
          >
            <Icon size={16} aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-2 py-3 border-t border-gray-800 space-y-1 shrink-0">
        <div
          className={clsx(
            'flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg select-none',
            connected ? 'text-green-400 bg-green-500/8' : 'text-gray-500 bg-gray-800/50'
          )}
          aria-live="polite"
          aria-label={connected ? 'Live updates enabled' : 'Disconnected from live updates'}
        >
          {connected ? (
            <Wifi size={12} aria-hidden="true" />
          ) : (
            <WifiOff size={12} aria-hidden="true" />
          )}
          {connected ? 'Live updates on' : 'Offline'}
        </div>

        {user && (
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg">
            <Avatar src={user.avatarUrl} alt={user.username} size={26} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-300 truncate">{user.username}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Sign out"
              className="text-gray-600 hover:text-gray-300 transition-colors p-1 rounded"
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

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      <aside className="hidden md:flex w-56 flex-col bg-gray-900 border-r border-gray-800 shrink-0">
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
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            role="presentation"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-50 w-56 h-full bg-gray-900 border-r border-gray-800 flex flex-col shadow-2xl">
            <div className="flex items-center justify-end px-3 py-2 border-b border-gray-800">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                className="text-gray-400 hover:text-gray-200 p-2"
              >
                <X size={18} />
              </button>
            </div>
            <NavContent onNavClick={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            className="text-gray-400 hover:text-gray-200 transition-colors"
          >
            <Menu size={20} aria-hidden="true" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-brand-600 flex items-center justify-center text-white text-[9px] font-bold select-none">
              AI
            </div>
            <span className="text-sm font-semibold text-white">Code Review</span>
          </div>
        </div>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
