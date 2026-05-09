import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { authApi } from '../api/client';

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
    const token = localStorage.getItem('token');

    if (!token) {
      setLoading(false);
      return undefined;
    }

    authApi
      .getMe()
      .then((res) => {
        if (cancelled) return;
        const next = res?.data?.user;
        if (isUsableSessionUser(next)) setUser(next);
        else {
          try {
            localStorage.removeItem('token');
          } catch {
            /* ignore */
          }
          setUser(null);
        }
      })
      .catch(() => {
        if (cancelled) return;
        try {
          localStorage.removeItem('token');
        } catch {
          /* ignore */
        }
        setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback((token, userData) => {
    localStorage.setItem('token', token);
    setUser(isUsableSessionUser(userData) ? userData : null);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
    }),
    [user, loading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
