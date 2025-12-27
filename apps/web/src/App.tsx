import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SupabaseAuthProvider, useAuth } from './contexts/SupabaseAuthContext';
import { ToastProvider } from './components/ui/Toast';
import { WineLoader } from './components/WineLoader';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { CellarPage } from './pages/CellarPage';
import { RecommendationPage } from './pages/RecommendationPage';
import { HistoryPage } from './pages/HistoryPage';
import { ProfilePage } from './pages/ProfilePage';

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
      <Route path="/" element={<Navigate to="/cellar" replace />} />
      <Route path="*" element={<Navigate to="/cellar" replace />} />
    </Routes>
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

