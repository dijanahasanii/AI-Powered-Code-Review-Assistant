import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AuthLoadingLayout } from './AuthLoadingLayout';

/**
 * Auth gate for all workspace routes — must wrap nested routes via <Outlet /> (not by passing Layout as JSX children).
 * Otherwise unauthenticated URLs can bypass the guard depending on RR version / tree shape.
 */
export function RequireAuthOutlet() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <AuthLoadingLayout />;
  if (!user) {
    return <Navigate to="/" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}
