import { useLocation } from 'react-router-dom';
import {
  DashboardPageSkeleton,
  RepositoriesPageSkeleton,
  ReviewsPageSkeleton,
  ReviewDetailSkeleton,
  SettingsPageSkeleton,
} from './Skeletons';

/**
 * Lazy-route fallback: route-shaped skeletons instead of a lone spinner.
 */
export function AppRouteSkeleton() {
  const { pathname } = useLocation();

  if (/^\/reviews\/[^/]+$/.test(pathname)) {
    return <ReviewDetailSkeleton />;
  }
  if (pathname.startsWith('/reviews')) {
    return <ReviewsPageSkeleton />;
  }
  if (pathname.startsWith('/repositories')) {
    return <RepositoriesPageSkeleton />;
  }
  if (pathname.startsWith('/dashboard')) {
    return <DashboardPageSkeleton />;
  }
  if (pathname.startsWith('/settings')) {
    return <SettingsPageSkeleton />;
  }

  return <DashboardPageSkeleton />;
}
