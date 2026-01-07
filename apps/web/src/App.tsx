import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SupabaseAuthProvider, useAuth } from './contexts/SupabaseAuthContext';
import { ToastProvider } from './components/ui/Toast';
import { WineLoader } from './components/WineLoader';
import { Layout } from './components/Layout';
import { ScrollToTop } from './components/ScrollToTop';
import { CookieConsent } from './components/CookieConsent';
import { LoginPage } from './pages/LoginPage';
import { CellarPage } from './pages/CellarPage';
import { RecommendationPage } from './pages/RecommendationPage';
import { HistoryPage } from './pages/HistoryPage';
import { ProfilePage } from './pages/ProfilePage';
import { AdminEnrichPage } from './pages/AdminEnrichPage';
import { SharedCellarPage } from './pages/SharedCellarPage'; // Feedback iteration (dev only)
import { CommunityPage } from './pages/CommunityPage'; // Feedback iteration (dev only)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen luxury-background">
        <WineLoader variant="default" size="lg" message="Loading..." />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <>
      <ScrollToTop />
      <CookieConsent />
      <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/cellar" replace /> : <LoginPage />}
      />
      <Route
        path="/cellar"
        element={
          <PrivateRoute>
            <Layout>
              <CellarPage />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/recommendation"
        element={
          <PrivateRoute>
            <Layout>
              <RecommendationPage />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/history"
        element={
          <PrivateRoute>
            <Layout>
              <HistoryPage />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <PrivateRoute>
            <Layout>
              <ProfilePage />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/admin/enrich"
        element={
          <PrivateRoute>
            <Layout>
              <AdminEnrichPage />
            </Layout>
          </PrivateRoute>
        }
      />
      {/* Feedback iteration (dev only) - Share and Community routes */}
      {/* New format: /share/:shareId (database-backed short links) */}
      <Route
        path="/share/:shareId"
        element={<SharedCellarPage />}
      />
      {/* Old format: /share?data=... (backwards compatibility) */}
      <Route
        path="/share"
        element={<SharedCellarPage />}
      />
      <Route
        path="/community"
        element={
          <PrivateRoute>
            <Layout>
              <CommunityPage />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route path="/" element={<Navigate to="/cellar" replace />} />
      <Route path="*" element={<Navigate to="/cellar" replace />} />
      </Routes>
    </>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          <SupabaseAuthProvider>
            <AppRoutes />
          </SupabaseAuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

