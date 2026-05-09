import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import ErrorBoundary from './components/common/ErrorBoundary';
import Layout from './components/common/Layout';
import GitHubLanding from './pages/GitHubLanding';
import CallbackPage from './pages/CallbackPage';
import { Spinner } from './components/common/UI';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const RepositoriesPage = lazy(() => import('./pages/RepositoriesPage'));
const ReviewsPage = lazy(() => import('./pages/ReviewsPage'));
const ReviewDetailPage = lazy(() => import('./pages/ReviewDetailPage'));
function FullPageSpinner() {
  return (
    <div
      className="flex h-screen items-center justify-center bg-gray-950"
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

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/" replace />;
  return children;
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
      <SocketProvider>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<GitHubLanding />} />
            <Route path="/login" element={<GitHubLanding />} />
            <Route path="/auth/callback" element={<CallbackPage />} />

            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
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
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
      </SocketProvider>
    </AuthProvider>
  );
}
