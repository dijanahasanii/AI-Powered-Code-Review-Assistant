import { useRef } from 'react';
import { Github } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import LandingShell from '../components/common/LandingShell';
import { BrowserOfflineBar } from '../components/common/BrowserOfflineBar';
import { githubOAuthStartUrl } from '../config/githubOAuth';

export default function LoginPage() {
  const { state } = useLocation();
  const authError = state?.authError;
  const loginStartedRef = useRef(false);

  const startOAuth = (switchAccount) => {
    if (loginStartedRef.current) return;
    loginStartedRef.current = true;
    // Server-initiated OAuth adds a signed `state` (CSRF mitigation); must match GITHUB_CLIENT_ID in backend/.env
    window.location.href = githubOAuthStartUrl(switchAccount);
  };

  return (
    <LandingShell>
      <BrowserOfflineBar className="mb-3 rounded-lg border border-sky-500/40" />
      <div className="card p-6 space-y-4">
        <div className="space-y-2 text-center">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Sign in with your GitHub account to get started
          </p>
          {authError && (
            <p className="text-xs text-red-400 text-left rounded-lg bg-red-950/40 border border-red-900/60 px-3 py-2">
              {authError}
            </p>
          )}
          {!import.meta.env.VITE_GITHUB_CLIENT_ID && (
            <p className="text-xs text-amber-400 text-center">
              Optional: VITE_GITHUB_CLIENT_ID — login uses the API with server-side OAuth; keep backend{' '}
              <code className="text-amber-900 dark:text-amber-200">GITHUB_CLIENT_*</code> aligned with your GitHub App.
            </p>
          )}
        </div>

        <button type="button" onClick={() => startOAuth(false)} className="btn-primary w-full justify-center py-2.5">
          <Github size={18} />
          Continue with GitHub
        </button>

        <p className="text-center text-xs text-desk-muted">
          We request repo access to install webhooks and fetch diffs.
        </p>
      </div>
    </LandingShell>
  );
}
