import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { authApi } from '../api/client';
import { githubOAuthStartUrl } from '../config/githubOAuth';

const AuthContext = createContext(null);

/** Minimal sanity check — backend must return UUID `id` for Socket + API wiring */
function isUsableSessionUser(candidate) {
  return Boolean(candidate && typeof candidate === 'object' && candidate.id != null && candidate.id !== '');
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    authApi
      .getMe()
      .then((res) => {
        if (cancelled) return;
        const next = res?.data?.user;
        if (isUsableSessionUser(next)) setUser(next);
        else setUser(null);
      })
      .catch(() => {
        if (cancelled) return;
        setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback((userData) => {
    setUser(isUsableSessionUser(userData) ? userData : null);
  }, []);

  const logout = useCallback(() => {
    authApi.logout().catch(() => {
      /* cookie clear is best-effort if API is down */
    });
    setUser(null);
  }, []);

  const switchGithubAccount = useCallback(() => {
    authApi.logout().catch(() => {
      /* cookie clear is best-effort if API is down */
    });
    setUser(null);
    window.location.href = githubOAuthStartUrl(true);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      switchGithubAccount,
    }),
    [user, loading, login, logout, switchGithubAccount]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
