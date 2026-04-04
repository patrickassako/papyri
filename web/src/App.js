import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import theme from './theme/theme';
import { AudioProvider } from './context/AudioContext';
import MiniPlayer from './components/MiniPlayer';
import Register from './pages/Register';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import LandingPage from './pages/LandingPage';
import CatalogPage from './pages/CatalogPage';
import ContentDetailPage from './pages/ContentDetailPage';
import PricingPage from './pages/PricingPage';
import SubscriptionCallbackPage from './pages/SubscriptionCallbackPage';
import EReaderPage from './pages/EReaderPage';
import PdfReaderPage from './pages/PdfReaderPage';
import AudiobookPlayerPage from './pages/AudiobookPlayerPage';
import SubscriptionPage from './pages/SubscriptionPage';
import DashboardPage from './pages/DashboardPage';
import MyListPage from './pages/MyListPage';
import HistoryPage from './pages/HistoryPage';
import ProfilePage from './pages/ProfilePage';
import DevicesPage from './pages/DevicesPage';
import SecurityPage from './pages/SecurityPage';
import MfaVerifyPage from './pages/MfaVerifyPage';
import PublisherLayout from './components/PublisherLayout';
import PublisherActivatePage from './pages/publisher/PublisherActivatePage';
import PublisherDashboardPage from './pages/publisher/PublisherDashboardPage';
import PublisherBooksPage from './pages/publisher/PublisherBooksPage';
import PublisherBookDetailPage from './pages/publisher/PublisherBookDetailPage';
import PublisherAddBookPage from './pages/publisher/PublisherAddBookPage';
import PublisherRevenuePage from './pages/publisher/PublisherRevenuePage';
import PublisherPromoCodesPage from './pages/publisher/PublisherPromoCodesPage';
import PublisherProfilePage from './pages/publisher/PublisherProfilePage';
import PublisherClaimsPage from './pages/publisher/PublisherClaimsPage';
import PublisherStatsPage from './pages/publisher/PublisherStatsPage';
import AdminPublisherLayout from './components/AdminPublisherLayout';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminPublisherDashboardPage from './pages/admin/AdminPublisherDashboardPage';
import AdminPublishersPage from './pages/admin/AdminPublishersPage';
import AdminPublisherDetailPage from './pages/admin/AdminPublisherDetailPage';
import AdminBookDetailPage from './pages/admin/AdminBookDetailPage';
import AdminContentValidationPage from './pages/admin/AdminContentValidationPage';
import AdminPayoutsPage from './pages/admin/AdminPayoutsPage';
import AdminCreateContentPage from './pages/admin/AdminCreateContentPage';
import AdminBooksModulePage from './pages/admin/AdminBooksModulePage';
import AdminSubscriptionsPage from './pages/admin/AdminSubscriptionsPage';
import AdminPublisherBooksListPage from './pages/admin/AdminPublisherBooksListPage';
import AdminBookContentDetailPage from './pages/admin/AdminBookContentDetailPage';
import AdminCategoriesPage from './pages/admin/AdminCategoriesPage';
import AdminPromoCodesPage from './pages/admin/AdminPromoCodesPage';
import AdminSettingsPage from './pages/admin/AdminSettingsPage';
import AdminGeoPricingPage from './pages/admin/AdminGeoPricingPage';
import AdminNotificationsPage from './pages/admin/AdminNotificationsPage';
import AdminRevenueAnalyticsPage from './pages/admin/AdminRevenueAnalyticsPage';
import AdminGdprPage from './pages/admin/AdminGdprPage';
import AdminReadingStatsPage from './pages/admin/AdminReadingStatsPage';
import AdminPublisherClaimsPage from './pages/admin/AdminPublisherClaimsPage';
import AdminPublisherPromoCodesPage from './pages/admin/AdminPublisherPromoCodesPage';
import AdminRolesPage from './pages/admin/AdminRolesPage';
import * as authService from './services/auth.service';
import CookieConsent from './components/CookieConsent';
import PrivacyPage from './pages/PrivacyPage';
import CGUPage from './pages/legal/CGUPage';
import CGVPage from './pages/legal/CGVPage';
import MentionsLegalesPage from './pages/legal/MentionsLegalesPage';
import CookiesPage from './pages/legal/CookiesPage';
import CopyrightPage from './pages/legal/CopyrightPage';
import OnboardingPage from './pages/OnboardingPage';

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
