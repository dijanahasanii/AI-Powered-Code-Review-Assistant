import { useNavigate } from 'react-router-dom';
import { LayoutDashboard } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import LoginPage from './LoginPage';
import LandingShell from '../components/common/LandingShell';
import { Spinner } from '../components/common/UI';

/**
 * Home route: always the first screen (`/`). Shows GitHub connect or resume into the app.
 */
export default function GitHubLanding() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div
        className="flex h-screen items-center justify-center bg-gray-950"
        role="status"
        aria-label="Loading"
      >
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-gray-500">Loading…</p>
        </div>
      </div>
    );
  }

  if (user) {
    return (
      <LandingShell>
        <div className="card p-6 space-y-4">
          <div className="space-y-2 text-center">
            <p className="text-sm text-gray-300">GitHub is connected.</p>
            <p className="text-xs text-gray-500">
              Signed in as{' '}
              <span className="text-gray-200 font-medium font-mono">@{user.username}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="btn-primary w-full justify-center py-2.5 inline-flex items-center gap-2"
          >
            <LayoutDashboard size={18} aria-hidden="true" />
            Continue to dashboard
          </button>

          <button
            type="button"
            onClick={() => {
              logout();
            }}
            className="btn-secondary w-full justify-center py-2.5 text-sm"
          >
            Sign out
          </button>
        </div>
      </LandingShell>
    );
  }

  return <LoginPage />;
}
