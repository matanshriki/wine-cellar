import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Component, type ReactNode, type ErrorInfo } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAnalyticsUser } from './hooks/useAnalyticsUser';
import { SupabaseAuthProvider, useAuth } from './contexts/SupabaseAuthContext';
import { FeatureFlagsProvider, useFeatureFlag, useFeatureFlags } from './contexts/FeatureFlagsContext'; // Feature flags
import { AddBottleProvider } from './contexts/AddBottleContext'; // Global Add Bottle flow
import { ThemeProvider } from './contexts/ThemeContext'; // Dark mode V2
import { WinePourProvider } from './components/WinePourTransition';
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
import TermsPage from './pages/TermsPage'; // Terms & Conditions (required for subscription model)
import { AboutPage } from './pages/AboutPage';
import { GuestEveningPage } from './pages/GuestEveningPage'; // Public guest evening view
import { UpgradePage } from './pages/UpgradePage'; // Sommelier Credits — flagged users only
import { OpenRitualProvider } from './contexts/OpenRitualContext'; // Global open ritual + timers
import { useMonetizationAccess } from './hooks/useMonetizationAccess';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

/**
 * Global Error Boundary
 * Catches any unhandled rendering error and shows a friendly recovery UI
 * instead of a blank white page. Without this, any thrown error in any
 * component silently unmounts the entire React tree.
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    // Navigate to cellar as a safe landing page
    window.location.href = '/cellar';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            textAlign: 'center',
            background: 'var(--bg-surface, #fff)',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🍷</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary, #111)' }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary, #555)', marginBottom: '1.5rem', maxWidth: '360px' }}>
            An unexpected error occurred. Your cellar data is safe — tap below to reload.
          </p>
          {this.state.error && (
            <details style={{ fontSize: '0.75rem', color: '#999', marginBottom: '1.5rem', maxWidth: '480px', textAlign: 'left' }}>
              <summary style={{ cursor: 'pointer' }}>Error details</summary>
              <pre style={{ marginTop: '0.5rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {this.state.error.message}
              </pre>
            </details>
          )}
          <button
            onClick={this.handleReset}
            style={{
              padding: '0.75rem 2rem',
              borderRadius: '9999px',
              background: 'linear-gradient(135deg, #a44c68, #7d3450)',
              color: '#fff',
              fontWeight: 600,
              fontSize: '1rem',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

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

/**
 * MonetizationRoute: Protects routes that require monetization_enabled = true.
 * Redirects to /cellar for all non-flagged users (default for every user).
 * Dark launch guard — no pricing pages are publicly routable.
 */
function MonetizationRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { monetizationEnabled, creditsLoading } = useMonetizationAccess();

  if (authLoading || creditsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen luxury-background">
        <WineLoader variant="default" size="lg" message="Loading..." />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!monetizationEnabled) return <Navigate to="/cellar" replace />;

  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  // Sync Supabase auth state → GA4 user_id (pseudonymous UUID, no PII)
  useAnalyticsUser();

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
        path="/terms"
        element={<TermsPage />}
      />
      <Route
        path="/about"
        element={
          <PrivateRoute>
            <Layout>
              <AboutPage />
            </Layout>
          </PrivateRoute>
        }
      />
      {/* Public guest view for shared evening lineups — no auth required */}
      <Route
        path="/share/evening/:shortCode"
        element={<GuestEveningPage />}
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
      {/* Sommelier Credits / upgrade page — dark launch, monetization-flagged users only */}
      <Route
        path="/upgrade"
        element={
          <MonetizationRoute>
            <Layout>
              <UpgradePage />
            </Layout>
          </MonetizationRoute>
        }
      />
      {/* Cellar Agent — full-screen, no Layout chrome */}
      <Route
        path="/agent"
        element={
          <PrivateRoute>
            <AgentPageWorking />
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
    <HelmetProvider>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ToastProvider>
            <ThemeProvider>
            <WinePourProvider>
              <SupabaseAuthProvider>
                <FeatureFlagsProvider>
                  <AddBottleProvider>
                    <OpenRitualProvider>
                      <AppRoutes />
                    </OpenRitualProvider>
                  </AddBottleProvider>
                </FeatureFlagsProvider>
              </SupabaseAuthProvider>
            </WinePourProvider>
            </ThemeProvider>
          </ToastProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
    </HelmetProvider>
  );
}

