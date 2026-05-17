import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/client';
import { Spinner } from '../components/common/UI';

/** Reuse identical in-flight Axios promise across Strict Mode remount + duplicate registrations. */
const githubExchangeByCode = new Map();
/** Prevents two `.then()` chains on the fulfilled promise both calling `login` + `navigate`. */
const oauthSuccessGuard = new Set();

export default function CallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    let cancelled = false;

    const errorParam = searchParams.get('error');
    if (errorParam) {
      const msg =
        errorParam === 'access_denied'
          ? 'GitHub authorization was canceled. Grant access next time so we can connect repositories.'
          : `GitHub returned “${errorParam}”. Retry after confirming OAuth settings.`;
      navigate('/', { replace: true, state: { authError: msg } });
      return undefined;
    }

    const code = searchParams.get('code');
    const oauthState = searchParams.get('state');
    if (!code) {
      navigate('/', {
        replace: true,
        state: {
          authError: 'No authorization code was returned — please start the GitHub login flow again.',
        },
      });
      return undefined;
    }

    let pending = githubExchangeByCode.get(code);
    if (!pending) {
      pending = authApi.githubCallback(code, oauthState);
      pending.finally(() => {
        githubExchangeByCode.delete(code);
        oauthSuccessGuard.delete(code);
      });
      githubExchangeByCode.set(code, pending);
    }

    pending
      .then((res) => {
        if (cancelled) return;
        if (oauthSuccessGuard.has(code)) return;
        oauthSuccessGuard.add(code);
        const { user } = res.data ?? {};
        if (!user) throw new Error('Invalid auth response payload');
        login(user);
        navigate('/', { replace: true });
      })
      .catch((err) => {
        if (cancelled) return;
        const msg =
          err.response?.data?.error ||
          err.response?.data?.message ||
          err.message ||
          'Sign-in failed. Confirm backend OAuth env vars match your GitHub app.';
        navigate('/', { replace: true, state: { authError: String(msg) } });
      });

    return () => {
      cancelled = true;
    };
  }, [searchParams, navigate, login]);

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4 text-gray-400 px-6 text-center">
      <Spinner size="lg" />
      <div className="space-y-1">
        <p className="text-sm font-medium text-gray-300">Signing you in…</p>
        <p className="text-xs text-gray-600">Validating OAuth with GitHub</p>
      </div>
    </div>
  );
}
