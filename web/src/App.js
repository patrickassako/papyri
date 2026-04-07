import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import theme from './theme/theme';
import { AudioProvider } from './context/AudioContext';
import MiniPlayer from './components/MiniPlayer';
import * as authService from './services/auth.service';
import CookieConsent from './components/CookieConsent';

const Register = lazy(() => import('./pages/Register'));
const Login = lazy(() => import('./pages/Login'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const CatalogPage = lazy(() => import('./pages/CatalogPage'));
const ContentDetailPage = lazy(() => import('./pages/ContentDetailPage'));
const PricingPage = lazy(() => import('./pages/PricingPage'));
const SubscriptionCallbackPage = lazy(() => import('./pages/SubscriptionCallbackPage'));
const EReaderPage = lazy(() => import('./pages/EReaderPage'));
const PdfReaderPage = lazy(() => import('./pages/PdfReaderPage'));
const AudiobookPlayerPage = lazy(() => import('./pages/AudiobookPlayerPage'));
const SubscriptionPage = lazy(() => import('./pages/SubscriptionPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const MyListPage = lazy(() => import('./pages/MyListPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const DevicesPage = lazy(() => import('./pages/DevicesPage'));
const SecurityPage = lazy(() => import('./pages/SecurityPage'));
const MfaVerifyPage = lazy(() => import('./pages/MfaVerifyPage'));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'));
const PublisherLayout = lazy(() => import('./components/PublisherLayout'));
const PublisherActivatePage = lazy(() => import('./pages/publisher/PublisherActivatePage'));
const PublisherDashboardPage = lazy(() => import('./pages/publisher/PublisherDashboardPage'));
const PublisherBooksPage = lazy(() => import('./pages/publisher/PublisherBooksPage'));
const PublisherBookDetailPage = lazy(() => import('./pages/publisher/PublisherBookDetailPage'));
const PublisherAddBookPage = lazy(() => import('./pages/publisher/PublisherAddBookPage'));
const PublisherRevenuePage = lazy(() => import('./pages/publisher/PublisherRevenuePage'));
const PublisherPromoCodesPage = lazy(() => import('./pages/publisher/PublisherPromoCodesPage'));
const PublisherProfilePage = lazy(() => import('./pages/publisher/PublisherProfilePage'));
const PublisherClaimsPage = lazy(() => import('./pages/publisher/PublisherClaimsPage'));
const PublisherStatsPage = lazy(() => import('./pages/publisher/PublisherStatsPage'));
const AdminPublisherLayout = lazy(() => import('./components/AdminPublisherLayout'));
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'));
const AdminPublisherDashboardPage = lazy(() => import('./pages/admin/AdminPublisherDashboardPage'));
const AdminPublishersPage = lazy(() => import('./pages/admin/AdminPublishersPage'));
const AdminPublisherDetailPage = lazy(() => import('./pages/admin/AdminPublisherDetailPage'));
const AdminBookDetailPage = lazy(() => import('./pages/admin/AdminBookDetailPage'));
const AdminContentValidationPage = lazy(() => import('./pages/admin/AdminContentValidationPage'));
const AdminPayoutsPage = lazy(() => import('./pages/admin/AdminPayoutsPage'));
const AdminCreateContentPage = lazy(() => import('./pages/admin/AdminCreateContentPage'));
const AdminBooksModulePage = lazy(() => import('./pages/admin/AdminBooksModulePage'));
const AdminSubscriptionsPage = lazy(() => import('./pages/admin/AdminSubscriptionsPage'));
const AdminPublisherBooksListPage = lazy(() => import('./pages/admin/AdminPublisherBooksListPage'));
const AdminBookContentDetailPage = lazy(() => import('./pages/admin/AdminBookContentDetailPage'));
const AdminCategoriesPage = lazy(() => import('./pages/admin/AdminCategoriesPage'));
const AdminPromoCodesPage = lazy(() => import('./pages/admin/AdminPromoCodesPage'));
const AdminSettingsPage = lazy(() => import('./pages/admin/AdminSettingsPage'));
const AdminGeoPricingPage = lazy(() => import('./pages/admin/AdminGeoPricingPage'));
const AdminNotificationsPage = lazy(() => import('./pages/admin/AdminNotificationsPage'));
const AdminRevenueAnalyticsPage = lazy(() => import('./pages/admin/AdminRevenueAnalyticsPage'));
const AdminGdprPage = lazy(() => import('./pages/admin/AdminGdprPage'));
const AdminReadingStatsPage = lazy(() => import('./pages/admin/AdminReadingStatsPage'));
const AdminPublisherClaimsPage = lazy(() => import('./pages/admin/AdminPublisherClaimsPage'));
const AdminRolesPage = lazy(() => import('./pages/admin/AdminRolesPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const CGUPage = lazy(() => import('./pages/legal/CGUPage'));
const CGVPage = lazy(() => import('./pages/legal/CGVPage'));
const MentionsLegalesPage = lazy(() => import('./pages/legal/MentionsLegalesPage'));
const CookiesPage = lazy(() => import('./pages/legal/CookiesPage'));
const CopyrightPage = lazy(() => import('./pages/legal/CopyrightPage'));

function RouteLoader() {
  return (
    <Box sx={{ minHeight: '40vh', display: 'grid', placeItems: 'center' }}>
      <CircularProgress />
    </Box>
  );
}

function ScrollToTop() {
  const location = useLocation();

  useEffect(() => {
    if (typeof window === 'undefined' || !window.history) return;
    window.history.scrollRestoration = 'manual';
  }, []);

  useEffect(() => {
    const path = location.pathname || '';
    const preserveScroll = path.startsWith('/read/')
      || path.startsWith('/pdf/')
      || path.startsWith('/listen/');

    if (preserveScroll) return;

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [location.pathname, location.search]);

  return null;
}

function useAuth() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    let active = true;
    authService.getUser()
      .then(u => { if (active) { setUser(u); setLoading(false); } })
      .catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return { loading, user };
}

function ProtectedRoute({ children }) {
  const { loading, user } = useAuth();

  if (loading) {
    return (
      <Box sx={{ minHeight: '40vh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function ProtectedPublisherRoute({ children }) {
  const { loading, user } = useAuth();

  if (loading) {
    return (
      <Box sx={{ minHeight: '40vh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const role = user?.role;
  if (role !== 'publisher' && role !== 'admin') return <Navigate to="/dashboard" replace />;

  return children;
}

function ProtectedAdminRoute({ children }) {
  const { loading, user } = useAuth();

  if (loading) {
    return (
      <Box sx={{ minHeight: '40vh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const role = user?.role;
  if (role !== 'admin') return <Navigate to="/dashboard" replace />;

  return children;
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AudioProvider>
          <ScrollToTop />
          <Suspense fallback={<RouteLoader />}>
            <Routes>
            {/* Public routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<Login />} />
            <Route path="/mfa-verify" element={<MfaVerifyPage />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Catalogue & content */}
            <Route path="/catalogue" element={<CatalogPage />} />
            <Route path="/catalogue/:id" element={<ContentDetailPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/subscription/callback" element={<SubscriptionCallbackPage />} />

            {/* Onboarding post-inscription */}
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <OnboardingPage />
                </ProtectedRoute>
              }
            />

            {/* Protected routes */}
            <Route
              path="/home"
              element={<Navigate to="/dashboard" replace />}
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-list"
              element={
                <ProtectedRoute>
                  <MyListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/history"
              element={
                <ProtectedRoute>
                  <HistoryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/subscription"
              element={
                <ProtectedRoute>
                  <SubscriptionPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/devices"
              element={
                <ProtectedRoute>
                  <DevicesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/security"
              element={
                <ProtectedRoute>
                  <SecurityPage />
                </ProtectedRoute>
              }
            />

            {/* Publisher — activation (public) */}
            <Route path="/publisher/activate" element={<PublisherActivatePage />} />

            {/* Publisher — panel (rôle publisher requis) */}
            <Route
              path="/publisher/dashboard"
              element={
                <ProtectedPublisherRoute>
                  <PublisherLayout><PublisherDashboardPage /></PublisherLayout>
                </ProtectedPublisherRoute>
              }
            />
            <Route
              path="/publisher/books/new"
              element={
                <ProtectedPublisherRoute>
                  <PublisherLayout><PublisherAddBookPage /></PublisherLayout>
                </ProtectedPublisherRoute>
              }
            />
            <Route
              path="/publisher/books/edit/:draftId"
              element={
                <ProtectedPublisherRoute>
                  <PublisherLayout><PublisherAddBookPage /></PublisherLayout>
                </ProtectedPublisherRoute>
              }
            />
            <Route
              path="/publisher/books/:contentId"
              element={
                <ProtectedPublisherRoute>
                  <PublisherLayout><PublisherBookDetailPage /></PublisherLayout>
                </ProtectedPublisherRoute>
              }
            />
            <Route
              path="/publisher/books"
              element={
                <ProtectedPublisherRoute>
                  <PublisherLayout><PublisherBooksPage /></PublisherLayout>
                </ProtectedPublisherRoute>
              }
            />
            <Route
              path="/publisher/revenue"
              element={
                <ProtectedPublisherRoute>
                  <PublisherLayout><PublisherRevenuePage /></PublisherLayout>
                </ProtectedPublisherRoute>
              }
            />
            <Route
              path="/publisher/promo-codes"
              element={
                <ProtectedPublisherRoute>
                  <PublisherLayout><PublisherPromoCodesPage /></PublisherLayout>
                </ProtectedPublisherRoute>
              }
            />
            <Route
              path="/publisher/profile"
              element={
                <ProtectedPublisherRoute>
                  <PublisherLayout><PublisherProfilePage /></PublisherLayout>
                </ProtectedPublisherRoute>
              }
            />
            <Route
              path="/publisher/stats"
              element={
                <ProtectedPublisherRoute>
                  <PublisherLayout><PublisherStatsPage /></PublisherLayout>
                </ProtectedPublisherRoute>
              }
            />
            <Route
              path="/publisher/claims"
              element={
                <ProtectedPublisherRoute>
                  <PublisherLayout><PublisherClaimsPage /></PublisherLayout>
                </ProtectedPublisherRoute>
              }
            />
            <Route path="/publisher" element={<Navigate to="/publisher/dashboard" replace />} />

            {/* Admin — panel principal */}
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedAdminRoute>
                  <AdminPublisherLayout><AdminDashboardPage /></AdminPublisherLayout>
                </ProtectedAdminRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedAdminRoute>
                  <AdminPublisherLayout><AdminUsersPage /></AdminPublisherLayout>
                </ProtectedAdminRoute>
              }
            />

            {/* Admin — module éditeurs */}
            <Route
              path="/admin/publisher-dashboard"
              element={
                <ProtectedAdminRoute>
                  <AdminPublisherLayout><AdminPublisherDashboardPage /></AdminPublisherLayout>
                </ProtectedAdminRoute>
              }
            />
            <Route
              path="/admin/publishers"
              element={
                <ProtectedAdminRoute>
                  <AdminPublisherLayout><AdminPublishersPage /></AdminPublisherLayout>
                </ProtectedAdminRoute>
              }
            />
            <Route
              path="/admin/publishers/:publisherId/books/:bookId"
              element={
                <ProtectedAdminRoute>
                  <AdminPublisherLayout><AdminBookDetailPage /></AdminPublisherLayout>
                </ProtectedAdminRoute>
              }
            />
            <Route
              path="/admin/publishers/:publisherId/create-content"
              element={
                <ProtectedAdminRoute>
                  <AdminPublisherLayout><AdminCreateContentPage /></AdminPublisherLayout>
                </ProtectedAdminRoute>
              }
            />
            <Route
              path="/admin/publishers/:id"
              element={
                <ProtectedAdminRoute>
                  <AdminPublisherLayout><AdminPublisherDetailPage /></AdminPublisherLayout>
                </ProtectedAdminRoute>
              }
            />
            <Route
              path="/admin/content-validation"
              element={
                <ProtectedAdminRoute>
                  <AdminPublisherLayout><AdminContentValidationPage /></AdminPublisherLayout>
                </ProtectedAdminRoute>
              }
            />
            <Route
              path="/admin/payouts"
              element={
                <ProtectedAdminRoute>
                  <AdminPublisherLayout><AdminPayoutsPage /></AdminPublisherLayout>
                </ProtectedAdminRoute>
              }
            />
            {/* Admin — module livres */}
            <Route
              path="/admin/books"
              element={
                <ProtectedAdminRoute>
                  <AdminPublisherLayout><AdminBooksModulePage /></AdminPublisherLayout>
                </ProtectedAdminRoute>
              }
            />
            <Route
              path="/admin/books/publisher/:publisherId"
              element={
                <ProtectedAdminRoute>
                  <AdminPublisherLayout><AdminPublisherBooksListPage /></AdminPublisherLayout>
                </ProtectedAdminRoute>
              }
            />
            <Route
              path="/admin/books/content/:contentId"
              element={
                <ProtectedAdminRoute>
                  <AdminPublisherLayout><AdminBookContentDetailPage /></AdminPublisherLayout>
                </ProtectedAdminRoute>
              }
            />

            <Route
              path="/admin/subscriptions"
              element={
                <ProtectedAdminRoute>
                  <AdminPublisherLayout><AdminSubscriptionsPage /></AdminPublisherLayout>
                </ProtectedAdminRoute>
              }
            />

            <Route
              path="/admin/categories"
              element={
                <ProtectedAdminRoute>
                  <AdminPublisherLayout><AdminCategoriesPage /></AdminPublisherLayout>
                </ProtectedAdminRoute>
              }
            />

            <Route
              path="/admin/promo-codes"
              element={
                <ProtectedAdminRoute>
                  <AdminPublisherLayout><AdminPromoCodesPage /></AdminPublisherLayout>
                </ProtectedAdminRoute>
              }
            />

            <Route
              path="/admin/roles"
              element={
                <ProtectedAdminRoute>
                  <AdminPublisherLayout><AdminRolesPage /></AdminPublisherLayout>
                </ProtectedAdminRoute>
              }
            />

            <Route
              path="/admin/settings"
              element={
                <ProtectedAdminRoute>
                  <AdminPublisherLayout><AdminSettingsPage /></AdminPublisherLayout>
                </ProtectedAdminRoute>
              }
            />

            <Route
              path="/admin/geo-pricing"
              element={
                <ProtectedAdminRoute>
                  <AdminPublisherLayout><AdminGeoPricingPage /></AdminPublisherLayout>
                </ProtectedAdminRoute>
              }
            />

            <Route path="/admin/notifications" element={<ProtectedAdminRoute><AdminPublisherLayout><AdminNotificationsPage /></AdminPublisherLayout></ProtectedAdminRoute>} />
            <Route path="/admin/analytics/revenue" element={<ProtectedAdminRoute><AdminPublisherLayout><AdminRevenueAnalyticsPage /></AdminPublisherLayout></ProtectedAdminRoute>} />
            <Route path="/admin/analytics/reading" element={<ProtectedAdminRoute><AdminPublisherLayout><AdminReadingStatsPage /></AdminPublisherLayout></ProtectedAdminRoute>} />
            <Route path="/admin/publisher-claims" element={<ProtectedAdminRoute><AdminPublisherLayout><AdminPublisherClaimsPage /></AdminPublisherLayout></ProtectedAdminRoute>} />
            <Route path="/admin/publisher-promo-codes" element={<Navigate to="/admin/promo-codes" replace />} />
            <Route path="/admin/gdpr" element={<ProtectedAdminRoute><AdminPublisherLayout><AdminGdprPage /></AdminPublisherLayout></ProtectedAdminRoute>} />

            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

            {/* Pages légales */}
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/cgu" element={<CGUPage />} />
            <Route path="/cgv" element={<CGVPage />} />
            <Route path="/mentions-legales" element={<MentionsLegalesPage />} />
            <Route path="/cookies" element={<CookiesPage />} />
            <Route path="/copyright" element={<CopyrightPage />} />

            {/* Full-screen players */}
            <Route
              path="/listen/:id"
              element={
                <ProtectedRoute>
                  <AudiobookPlayerPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/read/:id"
              element={
                <ProtectedRoute>
                  <EReaderPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pdf/:id"
              element={
                <ProtectedRoute>
                  <PdfReaderPage />
                </ProtectedRoute>
              }
            />

            {/* Default redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>

          {/* Mini-player global — visible on ALL pages when audio is loaded */}
          <MiniPlayer />
          {/* Bannière consentement cookies RGPD */}
          <CookieConsent />
        </AudioProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
