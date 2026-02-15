import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import theme from './theme/theme';
import Register from './pages/Register';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Home from './pages/Home';
import LandingPage from './pages/LandingPage';
import CatalogPage from './pages/CatalogPage';
import ContentDetailPage from './pages/ContentDetailPage';
import PricingPage from './pages/PricingPage';
import SubscriptionCallbackPage from './pages/SubscriptionCallbackPage';
import EReaderPage from './pages/EReaderPage';
import AudiobookPlayerPage from './pages/AudiobookPlayerPage';
import SubscriptionPage from './pages/SubscriptionPage';
import * as authService from './services/auth.service';

function ProtectedRoute({ children }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    let active = true;

    const checkAuth = async () => {
      const isAuth = await authService.isAuthenticated();
      if (active) {
        setAuthenticated(isAuth);
        setLoading(false);
      }
    };

    checkAuth();

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <Box sx={{ minHeight: '40vh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!authenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/catalogue" element={<CatalogPage />} />
          <Route path="/catalogue/:id" element={<ContentDetailPage />} />
          <Route path="/read/:id" element={<EReaderPage />} />
          <Route path="/listen/:id" element={<AudiobookPlayerPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/subscription/callback" element={<SubscriptionCallbackPage />} />

          {/* Protected routes */}
          <Route
            path="/home"
            element={
              <ProtectedRoute>
                <Home />
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

          {/* Default redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
