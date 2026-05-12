import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import ErrorBoundary from './components/common/ErrorBoundary';
import Layout from './components/common/Layout';
import { RequireAuthOutlet } from './components/common/RequireAuthOutlet';
import { UiPreferencesProvider } from './context/UiPreferencesContext';
import GitHubLanding from './pages/GitHubLanding';
import CallbackPage from './pages/CallbackPage';
import { AppRouteSkeleton } from './components/common/RouteSkeleton';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const RepositoriesPage = lazy(() => import('./pages/RepositoriesPage'));
const ReviewsPage = lazy(() => import('./pages/ReviewsPage'));
const ReviewDetailPage = lazy(() => import('./pages/ReviewDetailPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

function App() {
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
                        <Suspense fallback={<AppRouteSkeleton />}>
                          <DashboardPage />
                        </Suspense>
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="repositories"
                    element={
                      <ErrorBoundary>
                        <Suspense fallback={<AppRouteSkeleton />}>
                          <RepositoriesPage />
                        </Suspense>
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="reviews"
                    element={
                      <ErrorBoundary>
                        <Suspense fallback={<AppRouteSkeleton />}>
                          <ReviewsPage />
                        </Suspense>
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="reviews/:id"
                    element={
                      <ErrorBoundary>
                        <Suspense fallback={<AppRouteSkeleton />}>
                          <ReviewDetailPage />
                        </Suspense>
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="settings"
                    element={
                      <ErrorBoundary>
                        <Suspense fallback={<AppRouteSkeleton />}>
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

export default App;
