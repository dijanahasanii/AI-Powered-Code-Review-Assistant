import { useRef } from 'react';
import { Github } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import LandingShell from '../components/common/LandingShell';

export default function LoginPage() {
  const { state } = useLocation();
  const authError = state?.authError;
  const loginStartedRef = useRef(false);

  const handleLogin = () => {
    const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
    if (!clientId) return;
    if (loginStartedRef.current) return;
    loginStartedRef.current = true;
    const redirectUri = `${window.location.origin}/auth/callback`;
    const scope = 'user:email read:user repo admin:repo_hook';
    const q = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope,
    });
    window.location.href = `https://github.com/login/oauth/authorize?${q.toString()}`;
  };

  return (
    <LandingShell>
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
              Missing VITE_GITHUB_CLIENT_ID — set it in frontend{' '}
              <code className="text-amber-900 dark:text-amber-200">.env</code>
            </p>
          )}
        </div>

        <button
          type="button"
          disabled={!import.meta.env.VITE_GITHUB_CLIENT_ID}
          onClick={handleLogin}
          className="btn-primary w-full justify-center py-2.5 disabled:opacity-50"
        >
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
