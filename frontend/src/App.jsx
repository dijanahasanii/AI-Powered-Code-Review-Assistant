import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import ErrorBoundary from './components/common/ErrorBoundary';
import Layout from './components/common/Layout';
import { UiPreferencesProvider } from './context/UiPreferencesContext';
import GitHubLanding from './pages/GitHubLanding';
import CallbackPage from './pages/CallbackPage';
import { Spinner } from './components/common/UI';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const RepositoriesPage = lazy(() => import('./pages/RepositoriesPage'));
const ReviewsPage = lazy(() => import('./pages/ReviewsPage'));
const ReviewDetailPage = lazy(() => import('./pages/ReviewDetailPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
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
function RequireAuthOutlet() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageSpinner />;
  if (!user) {
    return <Navigate to="/" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}

/** Keeps suspense fallback aligned with routed content area height inside `Layout`. */
function RouteSkeleton() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-label="Loading page">
      <Spinner size="lg" />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <UiPreferencesProvider>
        <SocketProvider>
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<GitHubLanding />} />
              <Route path="/login" element={<GitHubLanding />} />
              <Route path="/auth/callback" element={<CallbackPage />} />

              <Route element={<RequireAuthOutlet />}>
                <Route element={<Layout />}>
                  <Route
                    path="dashboard"
                    element={
                      <ErrorBoundary>
                        <Suspense fallback={<RouteSkeleton />}>
                          <DashboardPage />
                        </Suspense>
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="repositories"
                    element={
                      <ErrorBoundary>
                        <Suspense fallback={<RouteSkeleton />}>
                          <RepositoriesPage />
                        </Suspense>
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="reviews"
                    element={
                      <ErrorBoundary>
                        <Suspense fallback={<RouteSkeleton />}>
                          <ReviewsPage />
                        </Suspense>
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="reviews/:id"
                    element={
                      <ErrorBoundary>
                        <Suspense fallback={<RouteSkeleton />}>
                          <ReviewDetailPage />
                        </Suspense>
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="settings"
                    element={
                      <ErrorBoundary>
                        <Suspense fallback={<RouteSkeleton />}>
                          <SettingsPage />
                        </Suspense>
                      </ErrorBoundary>
                    }
                  />
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ErrorBoundary>
        </SocketProvider>
      </UiPreferencesProvider>
    </AuthProvider>
  );
}
