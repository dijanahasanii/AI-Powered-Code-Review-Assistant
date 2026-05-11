import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const DENSITY_KEY = 'acr-ui-density';
const THEME_KEY = 'acr-ui-theme';

const UiPreferencesContext = createContext(null);

function readStoredTheme() {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* ignore */
  }
  return 'system';
}

export function resolveTheme(theme) {
  if (theme === 'dark') return 'dark';
  if (theme === 'light') return 'light';
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'dark';
}

/** Syncs `<html class="dark">` for Tailwind `darkMode: 'class'` */
function applyThemeToDocument(themePref) {
  const resolved = resolveTheme(themePref);
  document.documentElement.classList.toggle('dark', resolved === 'dark');
}

export function UiPreferencesProvider({ children }) {
  const [density, setDensityState] = useState(() => {
    try {
      return localStorage.getItem(DENSITY_KEY) === 'compact' ? 'compact' : 'comfort';
    } catch {
      return 'comfort';
    }
  });

  const [theme, setThemeState] = useState(() =>
    typeof window !== 'undefined' ? readStoredTheme() : 'system'
  );

  /** Bumps when OS color scheme changes while preference is `system`, so `resolvedTheme` consumers re-render. */
  const [systemMediaVersion, setSystemMediaVersion] = useState(0);

  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  useEffect(() => {
    if (theme !== 'system') return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      applyThemeToDocument('system');
      setSystemMediaVersion((v) => v + 1);
    };
    mq.addEventListener('change', onChange);
    applyThemeToDocument('system');
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  const setDensity = useCallback((next) => {
    const v = next === 'compact' ? 'compact' : 'comfort';
    try {
      localStorage.setItem(DENSITY_KEY, v);
    } catch {
      /* ignore */
    }
    setDensityState(v);
  }, []);

  const setTheme = useCallback((next) => {
    const v = next === 'light' || next === 'dark' || next === 'system' ? next : 'system';
    try {
      localStorage.setItem(THEME_KEY, v);
    } catch {
      /* ignore */
    }
    setThemeState(v);
    applyThemeToDocument(v);
  }, []);

  const resolvedTheme = useMemo(() => {
    void systemMediaVersion;
    if (typeof window === 'undefined') return 'light';
    return resolveTheme(theme);
  }, [theme, systemMediaVersion]);

  const value = useMemo(
    () => ({ density, setDensity, theme, setTheme, resolvedTheme }),
    [density, setDensity, theme, setTheme, resolvedTheme]
  );

  return <UiPreferencesContext.Provider value={value}>{children}</UiPreferencesContext.Provider>;
}

export function useUiPreferences() {
  const ctx = useContext(UiPreferencesContext);
  if (!ctx) {
    throw new Error('useUiPreferences must be used within UiPreferencesProvider');
  }
  return ctx;
}
