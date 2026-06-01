import { useNavigate } from 'react-router-dom';
import { LayoutDashboard } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import LoginPage from './LoginPage';
import LandingShell from '../components/common/LandingShell';
import { AuthLoadingLayout } from '../components/common/AuthLoadingLayout';
import { BrowserOfflineBar } from '../components/common/BrowserOfflineBar';

/**
 * Home route: always the first screen (`/`). Shows GitHub connect or resume into the app.
 */
export default function GitHubLanding() {
  const { user, loading, logout, switchGithubAccount } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return <AuthLoadingLayout />;
  }

  if (user) {
    return (
      <LandingShell>
        <div className="card p-6 space-y-4">
          <div className="space-y-2 text-center">
            <p className="text-sm text-gray-700 dark:text-gray-300">GitHub is connected.</p>
            <p className="text-xs text-desk-muted">
              Signed in as{' '}
              <span className="font-mono font-medium text-gray-900 dark:text-gray-200">@{user.username}</span>
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
            onClick={switchGithubAccount}
            className="btn-secondary w-full justify-center py-2 text-sm"
          >
            Use a different GitHub account
          </button>

          <button
            type="button"
            onClick={() => {
              logout();
            }}
            className="w-full justify-center py-2 text-sm text-desk-muted transition-colors hover:text-gray-800 dark:hover:text-gray-200"
          >
            Sign out only
          </button>
        </div>
      </LandingShell>
    );
  }

  return <LoginPage />;
}
