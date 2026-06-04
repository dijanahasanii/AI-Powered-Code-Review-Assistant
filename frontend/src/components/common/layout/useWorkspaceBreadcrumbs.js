import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

export function useWorkspaceBreadcrumbs() {
  const { pathname } = useLocation();
  return useMemo(() => {
    if (pathname === '/dashboard')
      return [
        { label: 'Workspace', to: '/dashboard' },
        { label: 'Analysis', to: '/dashboard', current: true },
      ];
    if (pathname === '/repositories')
      return [
        { label: 'Workspace', to: '/dashboard' },
        { label: 'Repositories', to: '/repositories', current: true },
      ];
    if (pathname === '/reviews')
      return [
        { label: 'Workspace', to: '/dashboard' },
        { label: 'Reviews', to: '/reviews', current: true },
      ];
    if (pathname === '/reports')
      return [
        { label: 'Workspace', to: '/dashboard' },
        { label: 'AI Reports', to: '/reports', current: true },
      ];
    if (/^\/reports\/[^/]+$/.test(pathname))
      return [
        { label: 'Workspace', to: '/dashboard' },
        { label: 'AI Reports', to: '/reports' },
        { label: 'Report', to: pathname, current: true },
      ];
    if (/^\/reviews\/[^/]+$/.test(pathname))
      return [
        { label: 'Workspace', to: '/dashboard' },
        { label: 'Reviews', to: '/reviews' },
        { label: 'Run detail', to: pathname, current: true },
      ];
    if (pathname === '/settings')
      return [
        { label: 'Workspace', to: '/dashboard' },
        { label: 'Settings', to: '/settings', current: true },
      ];
    return [{ label: 'Workspace', to: '/dashboard', current: true }];
  }, [pathname]);
}
