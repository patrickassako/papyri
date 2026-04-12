import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Box, Typography, Button, Divider } from '@mui/material';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import SecurityOutlinedIcon from '@mui/icons-material/SecurityOutlined';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AutoStoriesOutlinedIcon from '@mui/icons-material/AutoStoriesOutlined';
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined';
import SupportAgentOutlinedIcon from '@mui/icons-material/SupportAgentOutlined';
import GppMaybeOutlinedIcon from '@mui/icons-material/GppMaybeOutlined';
import tokens from '../config/tokens';
import papyriLogo from '../assets/papyri-logo-gold.png';
import { useAdminPermissions } from '../hooks/useAdminPermissions';

const P = tokens.colors.primary;

// `permission` : clé requise pour voir l'item. Absent = visible par tous.
const SECTIONS = [
  {
    title: 'Vue générale',
    items: [
      { label: 'Tableau de bord', icon: DashboardOutlinedIcon, route: '/admin/dashboard', permission: 'dashboard.read' },
      { label: 'Utilisateurs',   icon: PeopleOutlinedIcon,    route: '/admin/users',      permission: 'users.read' },
    ],
  },
  {
    title: 'Contenu',
    items: [
      { label: 'Bibliothèque',        icon: MenuBookOutlinedIcon,  route: '/admin/books',              permission: 'content.read' },
      { label: 'Validation contenu',  icon: FactCheckOutlinedIcon, route: '/admin/content-validation', permission: 'content.validate' },
      { label: 'Catégories',          icon: CategoryOutlinedIcon,  route: '/admin/categories',         permission: 'categories.read' },
      { label: 'Tarifs géographiques',icon: PublicOutlinedIcon,    route: '/admin/geo-pricing',        permission: 'geo_pricing.read' },
    ],
  },
  {
    title: 'Éditeurs',
    items: [
      { label: 'Aperçu éditeurs', icon: BarChartOutlinedIcon,        route: '/admin/publisher-dashboard', permission: 'publishers.read' },
      { label: 'Éditeurs',        icon: BusinessOutlinedIcon,         route: '/admin/publishers',          permission: 'publishers.read' },
      { label: 'Versements',      icon: AccountBalanceOutlinedIcon,   route: '/admin/payouts',             permission: 'payouts.read' },
      { label: 'Réclamations',    icon: SupportAgentOutlinedIcon,     route: '/admin/publisher-claims',    permission: 'publishers.read' },
    ],
  },
  {
    title: 'Monétisation',
    items: [
      { label: 'Abonnements', icon: CreditCardOutlinedIcon, route: '/admin/subscriptions',      permission: 'subscriptions.read' },
      { label: 'Codes promo', icon: LocalOfferOutlinedIcon, route: '/admin/promo-codes',        permission: 'promo_codes.read' },
      { label: 'Revenus',     icon: TrendingUpIcon,         route: '/admin/analytics/revenue',  permission: 'analytics.read' },
    ],
  },
  {
    title: 'Pilotage',
    items: [
      { label: 'Lecture',        icon: AutoStoriesOutlinedIcon,    route: '/admin/analytics/reading', permission: 'analytics.read' },
      { label: 'Notifications',  icon: NotificationsOutlinedIcon,  route: '/admin/notifications',     permission: 'notifications.read' },
      { label: 'RGPD',           icon: GppMaybeOutlinedIcon,       route: '/admin/gdpr',              permission: 'gdpr.read' },
    ],
  },
  {
    title: 'Système',
    items: [
      { label: 'Rôles & Permissions', icon: SecurityOutlinedIcon, route: '/admin/roles',    permission: 'roles.read' },
      { label: 'Paramètres',          icon: SettingsOutlinedIcon,  route: '/admin/settings', permission: 'settings.read' },
    ],
  },
];

export default function AdminSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { permissions, isAdmin } = useAdminPermissions();

  function isActive(route) {
    return location.pathname === route || location.pathname.startsWith(route + '/');
  }

  function canSee(item) {
    if (isAdmin) return true;             // admin voit tout
    if (!item.permission) return true;    // pas de contrainte
    return permissions.has(item.permission);
  }

  return (
    <Box
      sx={{
        width: 240,
        minWidth: 240,
        position: 'sticky',
        top: 0,
        height: '100vh',
        bgcolor: '#1A1A2E',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
      }}
    >
      <Box sx={{ px: 3, py: 2, borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'center' }}>
        <Box component="img" src={papyriLogo} alt="Papyri" sx={{ width: 80, objectFit: 'contain', display: 'block' }} />
      </Box>

      <Box sx={{ px: 1.5, pt: 2, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {SECTIONS.map((section, index) => {
          const visibleItems = section.items.filter(canSee);
          if (visibleItems.length === 0) return null;

          return (
          <Box key={section.title}>
            <Typography
              variant="caption"
              sx={{
                color: 'rgba(255,255,255,0.25)',
                fontWeight: 700,
                px: 1,
                textTransform: 'uppercase',
                letterSpacing: '1.2px',
                fontSize: '10px',
                display: 'block',
                mb: 0.5,
                mt: index === 0 ? 0 : 1.5,
              }}
            >
              {section.title}
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
              {visibleItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.route);
                return (
                  <Button
                    key={item.route}
                    onClick={() => navigate(item.route)}
                    startIcon={<Icon sx={{ fontSize: 17 }} />}
                    fullWidth
                    sx={{
                      justifyContent: 'flex-start',
                      borderRadius: '10px',
                      px: 1.5,
                      py: 0.85,
                      textTransform: 'none',
                      fontSize: '0.855rem',
                      fontWeight: active ? 700 : 400,
                      color: active ? '#fff' : 'rgba(255,255,255,0.5)',
                      bgcolor: active ? `${P}28` : 'transparent',
                      boxShadow: active ? `inset 3px 0 0 ${P}` : 'none',
                      '&:hover': {
                        bgcolor: active ? `${P}28` : 'rgba(255,255,255,0.05)',
                        color: '#fff',
                      },
                      gap: 1,
                      transition: 'all 0.15s',
                    }}
                  >
                    {item.label}
                  </Button>
                );
              })}
            </Box>

            {index < SECTIONS.length - 1 && (
              <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)', mt: 1.5 }} />
            )}
          </Box>
          );
        })}
      </Box>

      <Box sx={{ px: 1.5, pb: 2.5, borderTop: '1px solid rgba(255,255,255,0.06)', pt: 1.5 }}>
        <Button
          onClick={() => navigate('/')}
          startIcon={<HomeOutlinedIcon sx={{ fontSize: 17 }} />}
          fullWidth
          sx={{
            justifyContent: 'flex-start',
            borderRadius: '10px',
            px: 1.5,
            py: 0.85,
            textTransform: 'none',
            fontSize: '0.855rem',
            fontWeight: 400,
            color: 'rgba(255,255,255,0.35)',
            bgcolor: 'transparent',
            gap: 1,
            '&:hover': { bgcolor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)' },
          }}
        >
          Retour au site
        </Button>
      </Box>
    </Box>
  );
}
