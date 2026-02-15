import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SupabaseAuthProvider, useAuth } from './contexts/SupabaseAuthContext';
import { FeatureFlagsProvider, useFeatureFlag, useFeatureFlags } from './contexts/FeatureFlagsContext'; // Feature flags
import { AddBottleProvider } from './contexts/AddBottleContext'; // Global Add Bottle flow
import { ThemeProvider } from './contexts/ThemeContext'; // Theme switching
import { ToastProvider } from './components/ui/Toast';
import { toast } from './lib/toast'; // Correct import location
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
import { WishlistPage } from './pages/WishlistPage'; // Wishlist feature (feature-flagged)
import { AgentPage } from './pages/AgentPage'; // Cellar Agent (localhost only)
import { AgentPageSimple } from './pages/AgentPageSimple'; // Test version
import { AgentPageWorking } from './pages/AgentPageWorking'; // Working version
import PrivacyPage from './pages/PrivacyPage'; // Privacy Policy (required for Google OAuth)
import { ThemeQA } from './components/ThemeQA'; // DEV-ONLY: Theme regression checker

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  // Simply redirect to login if not authenticated
  // No loading state needed - auth is handled at app level
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

/**
 * FeatureFlagRoute: Protects routes that require a specific feature flag
 * Redirects to /cellar with a toast message if feature is not enabled
 */
function FeatureFlagRoute({ 
  children, 
  feature, 
  featureName 
}: { 
  children: React.ReactNode;
  feature: 'wishlistEnabled';
  featureName: string;
}) {
  const isEnabled = useFeatureFlag(feature);
  const { user, loading: authLoading } = useAuth();
  const { loading: flagsLoading } = useFeatureFlags(); // FIX: Check if flags are loading

  // Wait for auth AND feature flags to load
  if (authLoading || flagsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen luxury-background">
        <WineLoader variant="default" size="lg" message="Loading..." />
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Redirect to cellar if feature is not enabled
  if (!isEnabled) {
    // Show toast notification
    setTimeout(() => {
      toast.warning(`${featureName} is not enabled for your account.`);
    }, 100);
    
    return <Navigate to="/cellar" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  // Show loading only on initial app load (once)
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen luxury-background">
        <WineLoader variant="default" size="lg" message="Loading..." />
      </div>
    );
  }

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
        path="/privacy"
        element={<PrivacyPage />}
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
      {/* Wishlist feature (dev only) - DEV-ONLY route for testing wishlist functionality */}
      {/* Wishlist feature (feature-flagged) */}
      <Route
        path="/wishlist"
        element={
          <FeatureFlagRoute feature="wishlistEnabled" featureName="Wishlist">
            <Layout>
              <WishlistPage />
            </Layout>
          </FeatureFlagRoute>
        }
      />
      {/* Cellar Agent (localhost only) - Dev-only AI chat assistant */}
      <Route
        path="/agent"
        element={
          <PrivateRoute>
            <AgentPageWorking />
          </PrivateRoute>
        }
      />
      {/* DEV-ONLY: Theme QA - Visual regression checker for theme system */}
      <Route
        path="/theme-qa"
        element={<ThemeQA />}
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
          <ThemeProvider>
            <SupabaseAuthProvider>
              <FeatureFlagsProvider>
                <AddBottleProvider>
                  <AppRoutes />
                </AddBottleProvider>
              </FeatureFlagsProvider>
            </SupabaseAuthProvider>
          </ThemeProvider>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

