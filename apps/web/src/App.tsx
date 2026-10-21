import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Component, lazy, Suspense, type ReactNode, type ErrorInfo } from 'react';
import * as Sentry from '@sentry/react';
import { captureAppError } from './lib/monitoring';
import { HelmetProvider } from 'react-helmet-async';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAnalyticsUser } from './hooks/useAnalyticsUser';
import { SupabaseAuthProvider, useAuth } from './contexts/SupabaseAuthContext';
import { FeatureFlagsProvider, useFeatureFlag, useFeatureFlags } from './contexts/FeatureFlagsContext';
import { AddBottleProvider } from './contexts/AddBottleContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { WinePourProvider } from './components/WinePourTransition';
import { ToastProvider } from './components/ui/Toast';
import { toast } from './lib/toast';
import { WineLoader } from './components/WineLoader';
import { Layout } from './components/Layout';
import { PublicMarketingLayout } from './components/PublicMarketingLayout';
import { ScrollToTop } from './components/ScrollToTop';
import { CookieConsent } from './components/CookieConsent';
import { OpenRitualProvider } from './contexts/OpenRitualContext';
import { useMonetizationAccess } from './hooks/useMonetizationAccess';
import { MonetizationProvider } from './contexts/MonetizationContext';
import i18n from './i18n/config';

// ── Lazy-loaded page chunks ────────────────────────────────────────────────────
// Each page is code-split into its own chunk. The browser downloads only what the
// user actually navigates to, cutting first-paint JS parse time significantly.
const LoginPage        = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const CellarPage       = lazy(() => import('./pages/CellarPage').then(m => ({ default: m.CellarPage })));
const RecommendationPage = lazy(() => import('./pages/RecommendationPage').then(m => ({ default: m.RecommendationPage })));
const HistoryPage      = lazy(() => import('./pages/HistoryPage').then(m => ({ default: m.HistoryPage })));
const ProfilePage      = lazy(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const AdminEnrichPage      = lazy(() => import('./pages/AdminEnrichPage').then(m => ({ default: m.AdminEnrichPage })));
const AdminDashboardPage   = lazy(() => import('./pages/AdminDashboardPage').then(m => ({ default: m.AdminDashboardPage })));
const SharedCellarPage = lazy(() => import('./pages/SharedCellarPage').then(m => ({ default: m.SharedCellarPage })));
const CommunityPage    = lazy(() => import('./pages/CommunityPage').then(m => ({ default: m.CommunityPage })));
const WishlistPage     = lazy(() => import('./pages/WishlistPage').then(m => ({ default: m.WishlistPage })));
const AgentPageWorking = lazy(() => import('./pages/AgentPageWorking').then(m => ({ default: m.AgentPageWorking })));
const PrivacyPage      = lazy(() => import('./pages/PrivacyPage'));
const TermsPage        = lazy(() => import('./pages/TermsPage'));
const AboutPage        = lazy(() => import('./pages/AboutPage').then(m => ({ default: m.AboutPage })));
const GuestEveningPage = lazy(() => import('./pages/GuestEveningPage').then(m => ({ default: m.GuestEveningPage })));
const UpgradePage      = lazy(() => import('./pages/UpgradePage').then(m => ({ default: m.UpgradePage })));
const LandingPage      = lazy(() => import('./pages/LandingPage').then(m => ({ default: m.LandingPage })));

/** Full-screen page loading fallback — matches the app's luxury background */
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen luxury-background">
      <WineLoader variant="default" size="lg" message={i18n.t('loading.app')} />
    </div>
  );
}

// Wrap Routes for Sentry React Router v6 navigation breadcrumbs
const SentryRoutes = Sentry.withSentryReactRouterV6Routing(Routes);

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

/** Key used in sessionStorage to prevent an infinite reload loop. */
const CHUNK_RELOAD_KEY = 'sommi_chunk_error_reload_at';

/**
 * Returns true when the error is a stale-chunk / SW-update module loading failure.
 * These strings cover Chrome, Firefox, and Safari phrasing.
 */
function isChunkLoadError(error: Error): boolean {
  const msg = (error?.message ?? '') + (error?.stack ?? '');
  return (
    msg.includes('Importing a module script failed') ||
    msg.includes('dynamically imported module') ||
    msg.includes('Failed to fetch dynamically') ||
    msg.includes('error loading dynamically imported module')
  );
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Stale-chunk / SW-update: the browser can't load a JS module (old hash, network
    // failure, or newly activated service worker serving different bundles).
    // Auto-reload once per session — if the reload itself fails we fall through and
    // show the normal error screen so the user can retry manually.
    if (isChunkLoadError(error)) {
      const lastReload = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) ?? 0);
      const now = Date.now();
      if (now - lastReload > 15_000) {
        sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now));
        console.warn('[ErrorBoundary] Chunk load failure — auto-reloading once:', error.message);
        window.location.reload();
        // Return no-error state while the reload is in flight so React doesn't
        // render the error screen in the brief moment before the page refreshes.
        return { hasError: false, error: null };
      }
      console.warn('[ErrorBoundary] Chunk load failure — already reloaded recently, showing error');
    }
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
    // Chunk load errors are expected after deploys and self-heal via auto-reload.
    // Don't flood Sentry with known-handled noise.
    if (!isChunkLoadError(error)) {
      captureAppError(error, {
        componentStack: info.componentStack?.slice(0, 1000) ?? undefined,
        boundary: 'AppErrorBoundary',
      });
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    // Navigate to cellar as a safe landing page
    window.location.href = '/cellar';
  };

  render() {
    if (this.state.hasError) {
      return (
        <main className="min-h-screen-ios flex items-center justify-center px-5 py-10" style={{ background: 'var(--bg)' }}>
          <div className="app-empty w-full max-w-lg px-6 py-8 sm:px-10 sm:py-10">
            <img
              src="/assets/landing/pain-too-late.jpg"
              alt=""
              aria-hidden
              className="app-empty-art mb-6"
              decoding="async"
            />
            <h1 className="app-display text-2xl sm:text-3xl leading-tight mb-3">{i18n.t('errors.boundaryTitle')}</h1>
            <p className="mx-auto max-w-sm mb-7 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {i18n.t('errors.boundaryBody')}
            </p>
            <button type="button" onClick={this.handleReset} className="btn-luxury-primary">
              {i18n.t('errors.boundaryReload')}
            </button>
            {this.state.error && (
              <details className="mt-6 text-xs text-start" style={{ color: 'var(--text-tertiary)' }}>
                <summary className="cursor-pointer text-center">{i18n.t('errors.boundaryDetails')}</summary>
                <pre className="mt-2 whitespace-pre-wrap break-words ltr-content">
                  {this.state.error.message}
                  {this.state.error.stack ? `\n\n${this.state.error.stack}` : ''}
                </pre>
              </details>
            )}
          </div>
        </main>
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
        <WineLoader variant="default" size="lg" message={i18n.t('loading.app')} />
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
        <WineLoader variant="default" size="lg" message={i18n.t('loading.app')} />
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
        <WineLoader variant="default" size="lg" message={i18n.t('loading.app')} />
      </div>
    );
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <ScrollToTop />
      <CookieConsent />
      <SentryRoutes>
      <Route
        path="/login"
        element={user ? <Navigate to="/cellar" replace /> : <LoginPage />}
      />
      <Route
        path="/privacy"
        element={
          <PublicMarketingLayout>
            <PrivacyPage />
          </PublicMarketingLayout>
        }
      />
      <Route
        path="/terms"
        element={
          <PublicMarketingLayout>
            <TermsPage />
          </PublicMarketingLayout>
        }
      />
      <Route
        path="/about"
        element={
          user ? (
            <Layout>
              <AboutPage appShell />
            </Layout>
          ) : (
            <PublicMarketingLayout>
              <AboutPage />
            </PublicMarketingLayout>
          )
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
        path="/admin"
        element={
          <PrivateRoute>
            <Layout>
              <AdminDashboardPage />
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
      {/* Sommi credits / upgrade page — dark launch, monetization-flagged users only */}
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
      <Route
        path="/"
        element={
          user ? (
            <Navigate to="/cellar" replace />
          ) : (
            <PublicMarketingLayout>
              <LandingPage />
            </PublicMarketingLayout>
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
      </SentryRoutes>
    </Suspense>
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
                  <MonetizationProvider>
                    <AddBottleProvider>
                      <OpenRitualProvider>
                        <AppRoutes />
                      </OpenRitualProvider>
                    </AddBottleProvider>
                  </MonetizationProvider>
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

