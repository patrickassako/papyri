import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  Typography,
  Avatar,
  Divider,
  Stack,
  IconButton,
  Button,
} from '@mui/material';
import { useTranslation } from 'react-i18next';

import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import AutoStoriesOutlinedIcon from '@mui/icons-material/AutoStoriesOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import PaymentOutlinedIcon from '@mui/icons-material/PaymentOutlined';
import DevicesOutlinedIcon from '@mui/icons-material/DevicesOutlined';
import SecurityOutlinedIcon from '@mui/icons-material/Security';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import LoyaltyOutlinedIcon from '@mui/icons-material/LoyaltyOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined';
import LogoutIcon from '@mui/icons-material/Logout';
import CloseIcon from '@mui/icons-material/Close';

import LanguageToggle from './LanguageToggle';
import * as authService from '../services/auth.service';
import papyriWordmark from '../assets/papyri-wordmark-150x50.png';
import { isOwnerContext, getActiveProfile } from '../config/profileStorage';

const primary = '#f4a825';
const primaryDark = '#e29d22';

/**
 * Drawer global de l'application — utilisé sur mobile (xs/sm) via un bouton
 * hamburger placé dans les headers (PublicHeader / TopNavBar). Sur desktop,
 * l'utilisateur garde la sidebar habituelle (UserSpaceSidebar) + le top nav.
 *
 * Contenu :
 * - Connecté : navigation principale + lien profil + bouton déconnexion
 *   (avec restrictions non-owner pour l'abonnement)
 * - Déconnecté : menu landing (catalogue, nouveautés, tarifs) + bouton se connecter
 *
 * Props:
 * - open : bool
 * - onClose : () => void
 * - isAuthenticated : bool
 * - user : { full_name, email, avatar_url } | null
 */
export default function AppDrawer({ open, onClose, isAuthenticated, user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [activeProfile, setActiveProfile] = useState(() => getActiveProfile());
  const [isOwner, setIsOwner] = useState(() => isOwnerContext());

  useEffect(() => {
    const handleProfileChange = () => {
      setActiveProfile(getActiveProfile());
      setIsOwner(isOwnerContext());
    };
    window.addEventListener('papyri:profile-changed', handleProfileChange);
    return () => window.removeEventListener('papyri:profile-changed', handleProfileChange);
  }, []);

  const go = (path) => {
    onClose();
    navigate(path);
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch (_) {}
    onClose();
    navigate('/');
  };

  const userName = user?.full_name || (activeProfile?.name) || (isAuthenticated ? t('common.profile') : '');
  const userEmail = user?.email || '';
  const userInitial = (userName?.[0] || 'U').toUpperCase();

  // ─── Items navigation ───────────────────────────────────────────────────
  // Connecté : dépend du profil actif (kid / non-owner / owner)
  const authedNavItems = (() => {
    const base = [
      { label: t('sidebar.overview', { defaultValue: 'Tableau de bord' }), path: '/dashboard', icon: DashboardOutlinedIcon, key: 'dashboard' },
      { label: t('sidebar.myLibrary', { defaultValue: 'Ma bibliothèque' }), path: '/my-list', icon: AutoStoriesOutlinedIcon, key: 'library' },
      { label: t('nav.library', { defaultValue: 'Catalogue' }), path: '/catalogue', icon: SearchOutlinedIcon, key: 'catalogue' },
      { label: t('sidebar.stats', { defaultValue: 'Historique' }), path: '/history', icon: HistoryOutlinedIcon, key: 'history' },
      { label: t('sidebar.preferences', { defaultValue: 'Préférences' }), path: '/profile', icon: PersonOutlinedIcon, key: 'profile' },
      { label: t('sidebar.subscription', { defaultValue: 'Abonnement' }), path: '/subscription', icon: PaymentOutlinedIcon, key: 'subscription' },
      { label: t('sidebar.devices', { defaultValue: 'Appareils' }), path: '/devices', icon: DevicesOutlinedIcon, key: 'devices' },
      { label: t('sidebar.security', { defaultValue: 'Sécurité' }), path: '/security', icon: SecurityOutlinedIcon, key: 'security' },
    ];
    return base.filter((item) => {
      // Kid profiles
      if (activeProfile?.is_kid) {
        return ['dashboard', 'library', 'catalogue', 'history'].includes(item.key);
      }
      // Non-owner family profiles : pas d'abonnement
      if (activeProfile && activeProfile.is_owner_profile === false) {
        return item.key !== 'subscription';
      }
      return true;
    });
  })();

  // Non connecté : menu landing
  const guestNavItems = [
    { label: t('publicNav.home', { defaultValue: 'Accueil' }), path: '/', icon: HomeOutlinedIcon },
    { label: t('publicNav.library', { defaultValue: 'Catalogue' }), path: '/catalogue', icon: AutoStoriesOutlinedIcon },
    { label: t('publicNav.newReleases', { defaultValue: 'Nouveautés' }), path: '/catalogue?sort=newest', icon: SearchOutlinedIcon },
    { label: t('publicNav.pricing', { defaultValue: 'Tarifs' }), path: '/pricing', icon: LoyaltyOutlinedIcon },
  ];

  const items = isAuthenticated ? authedNavItems : guestNavItems;

  // Active path matching
  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    if (path.includes('?')) return location.pathname + location.search === path;
    return location.pathname === path;
  };

  return (
    <Drawer
      anchor="left"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: 300,
          maxWidth: '86vw',
          bgcolor: '#fcfaf8',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      {/* Header */}
      <Box sx={{ px: 2.2, py: 2, borderBottom: '1px solid #f0e8dc', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box
          component="img"
          src={papyriWordmark}
          alt="Papyri"
          onClick={() => go(isAuthenticated ? '/dashboard' : '/')}
          sx={{ width: 132, height: 40, objectFit: 'contain', objectPosition: 'left center', cursor: 'pointer' }}
        />
        <IconButton size="small" onClick={onClose} aria-label="close">
          <CloseIcon />
        </IconButton>
      </Box>

      {/* User card (connecté) ou call-to-login (déconnecté) */}
      {isAuthenticated ? (
        <Box sx={{ px: 2.2, py: 1.6, borderBottom: '1px solid #f0e8dc', display: 'flex', alignItems: 'center', gap: 1.4 }}>
          <Avatar
            src={user?.avatar_url || undefined}
            sx={{ width: 44, height: 44, bgcolor: 'rgba(244,168,37,0.18)', color: primary, fontWeight: 800 }}
          >
            {userInitial}
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.92rem', color: '#1c160d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {userName || t('sidebar.defaultUser', { defaultValue: 'Utilisateur' })}
            </Typography>
            {userEmail && (
              <Typography sx={{ fontSize: '0.72rem', color: '#9c7e49', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {userEmail}
              </Typography>
            )}
            {activeProfile?.name && !isOwner && (
              <Typography sx={{ fontSize: '0.7rem', color: primary, fontWeight: 700, mt: 0.2 }}>
                {t('drawer.activeProfile', { name: activeProfile.name, defaultValue: `Profil : ${activeProfile.name}` })}
              </Typography>
            )}
          </Box>
        </Box>
      ) : (
        <Box sx={{ px: 2.2, py: 2, borderBottom: '1px solid #f0e8dc' }}>
          <Typography sx={{ fontSize: '0.85rem', color: '#5f513d', mb: 1.5, lineHeight: 1.45 }}>
            {t('drawer.guestHint', { defaultValue: 'Connectez-vous pour accéder à votre bibliothèque, à vos lectures en cours et à votre abonnement.' })}
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<LoginOutlinedIcon />}
              onClick={() => go('/login')}
              sx={{
                bgcolor: primary,
                color: '#111',
                fontWeight: 800,
                textTransform: 'none',
                borderRadius: '9px',
                '&:hover': { bgcolor: primaryDark },
              }}
            >
              {t('publicNav.login', { defaultValue: 'Se connecter' })}
            </Button>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => go('/register')}
              sx={{
                borderColor: primary,
                color: primary,
                fontWeight: 700,
                textTransform: 'none',
                borderRadius: '9px',
                '&:hover': { borderColor: primaryDark, bgcolor: 'rgba(244,168,37,0.08)' },
              }}
            >
              {t('publicNav.register', { defaultValue: 'S\'inscrire' })}
            </Button>
          </Stack>
        </Box>
      )}

      {/* Navigation */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 1.2, py: 1.2 }}>
        <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#9c7e49', textTransform: 'uppercase', letterSpacing: '0.06em', px: 1.4, py: 0.6 }}>
          {t('nav.navigation', { defaultValue: 'Navigation' })}
        </Typography>
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Box
              key={item.path + item.label}
              onClick={() => go(item.path)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                px: 1.4,
                py: 1.15,
                borderRadius: '12px',
                cursor: 'pointer',
                color: active ? primary : '#3d2c1e',
                bgcolor: active ? 'rgba(242,158,13,0.12)' : 'transparent',
                '&:hover': { bgcolor: active ? 'rgba(242,158,13,0.16)' : '#f6efe4' },
                mb: 0.2,
              }}
            >
              <Icon sx={{ fontSize: 20 }} />
              <Typography sx={{ fontSize: '0.92rem', fontWeight: active ? 700 : 600 }}>
                {item.label}
              </Typography>
            </Box>
          );
        })}
      </Box>

      <Divider sx={{ borderColor: '#f0e8dc' }} />

      {/* Langue */}
      <Box sx={{ px: 2.2, py: 1.4 }}>
        <LanguageToggle variant="icon" sx={{ width: '100%', justifyContent: 'flex-start' }} />
      </Box>

      <Divider sx={{ borderColor: '#f0e8dc' }} />

      {/* Bouton déconnexion (connecté uniquement) */}
      {isAuthenticated && (
        <Box sx={{ px: 1.2, py: 1.2 }}>
          <Box
            onClick={handleLogout}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              px: 1.4,
              py: 1.15,
              borderRadius: '12px',
              cursor: 'pointer',
              color: '#c0392b',
              '&:hover': { bgcolor: 'rgba(192,57,43,0.08)' },
            }}
          >
            <LogoutIcon sx={{ fontSize: 20 }} />
            <Typography sx={{ fontSize: '0.92rem', fontWeight: 700 }}>
              {t('common.logout', { defaultValue: 'Se déconnecter' })}
            </Typography>
          </Box>
        </Box>
      )}
    </Drawer>
  );
}
