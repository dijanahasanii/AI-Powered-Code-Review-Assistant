import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Spinner } from './UI';

function FullPageSpinner() {
  return (
    <div
      className="flex h-screen items-center justify-center bg-desk-canvas"
      role="status"
      aria-label="Loading"
    >
      <div className="flex flex-col items-center gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    </div>
  );
}

/**
 * Auth gate for all workspace routes — must wrap nested routes via <Outlet /> (not by passing Layout as JSX children).
 * Otherwise unauthenticated URLs can bypass the guard depending on RR version / tree shape.
 */
export function RequireAuthOutlet() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageSpinner />;
  if (!user) {
    return <Navigate to="/" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}
