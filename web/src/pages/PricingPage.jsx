import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Container,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RemoveIcon from '@mui/icons-material/Remove';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import GroupIcon from '@mui/icons-material/Group';
import { useNavigate } from 'react-router-dom';
import { subscriptionsService } from '../services/subscriptions.service';
import * as authService from '../services/auth.service';
import PublicHeader from '../components/PublicHeader';
import CurrencyFloatingSelector from '../components/CurrencyFloatingSelector';
import papyriLogo from '../assets/papyri-wordmark-150x50.png';
import { useCurrency } from '../hooks/useCurrency';
import { formatMinorUnits } from '../services/currency.service';

const primary = '#f4a825';
const background = '#f8f7f5';

function planBadge(slug, t) {
  const key = getPlanFamilyKey({ slug });
  if (key === 'family') return t('pricing.group');
  if (key === 'personal') return t('pricing.individual');
  return t('pricing.basic');
}

function planCta(slug, t) {
  const key = getPlanFamilyKey({ slug });
  if (key === 'family') return t('pricing.chooseFamily');
  if (key === 'personal') return t('pricing.choosePremium');
  return t('pricing.chooseBasic');
}

function planFeatures(plan, formatMoney, t) {
  const features = [
    t('pricing.textBooksQuota', { n: plan.textQuotaPerUser || 0 }),
    t('pricing.audioBooksQuota', { n: plan.audioQuotaPerUser || 0 }),
    t('pricing.discountPaid', { n: plan.discountPercentPaidBooks || 0 }),
    t('pricing.validity', { n: plan.durationDays || 30 }),
  ];

  if ((plan.includedUsers || 1) > 1) {
    features.unshift(t('pricing.includedUsers', { n: plan.includedUsers }));
    features.push(t('pricing.extraUser', {
      price: formatMoney(
        plan.localizedExtraUserPriceCents ?? plan.extraUserPriceCents ?? 0,
        plan.localizedCurrency ?? plan.currency,
      ),
    }));
  }

  if (plan.bonusQuantityPerUser > 0) {
    const trigger = plan.bonusTrigger === 'immediate' ? t('pricing.bonusImmediate') : t('pricing.bonusOnQuota');
    features.push(`${plan.bonusQuantityPerUser} bonus (${plan.bonusType}) - ${trigger}`);
  }

  return features;
}

function detectBillingCycle(plan) {
  const slug = String(plan.slug || '').toLowerCase();
  const metaCycle = String(plan.metadata?.billing_cycle || '').toLowerCase();

  if (metaCycle === 'annual' || metaCycle === 'yearly') return 'annual';
  if (metaCycle === 'monthly') return 'monthly';
  if (slug.includes('annual') || slug.includes('yearly') || slug.endsWith('-an')) return 'annual';
  return 'monthly';
}

function getPlanFamilyKey(plan) {
  const slug = String(plan.slug || '').toLowerCase();
  return slug
    .replace(/-annual$|-yearly$|-monthly$/g, '')
    .replace(/-an$|-mensuel$|-annuel$/g, '');
}

const MAX_FAMILY_MEMBERS = 10;

function MemberSelector({ count, min, max, onChange }) {
  const { t } = useTranslation();
  return (
    <Box
      sx={{
        mt: 2.4,
        mb: 0.5,
        p: 2,
        borderRadius: '12px',
        bgcolor: 'rgba(244,168,37,0.07)',
        border: '1px solid rgba(244,168,37,0.25)',
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.2 }}>
        <GroupIcon sx={{ fontSize: 18, color: primary }} />
        <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: '#5a5047', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {t('pricing.nbrMembers')}
        </Typography>
      </Stack>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <IconButton
          size="small"
          onClick={() => onChange(Math.max(min, count - 1))}
          disabled={count <= min}
          sx={{ color: count <= min ? '#ccc' : primary, p: 0.5 }}
        >
          <RemoveCircleOutlineIcon sx={{ fontSize: 28 }} />
        </IconButton>

        <Box sx={{ textAlign: 'center' }}>
          <Typography sx={{ fontSize: '2rem', fontWeight: 900, lineHeight: 1, color: '#1c160d' }}>
            {count}
          </Typography>
          <Typography sx={{ fontSize: '0.72rem', color: '#8a8279', mt: 0.2 }}>
            {count === min ? t('pricing.minimumIncluded', { min }) : t(count - min > 1 ? 'pricing.extraMembers_plural' : 'pricing.extraMembers', { n: count - min })}
          </Typography>
        </Box>

        <IconButton
          size="small"
          onClick={() => onChange(Math.min(max, count + 1))}
          disabled={count >= max}
          sx={{ color: count >= max ? '#ccc' : primary, p: 0.5 }}
        >
          <AddCircleOutlineIcon sx={{ fontSize: 28 }} />
        </IconButton>
      </Stack>
    </Box>
  );
}

function PlanCard({ plan, loadingCheckout, onCheckout, actionLabel, actionDisabled = false, membersCount, onMembersCountChange, localCurrency, convertFromEUR, formatLocalFromEUR }) {
  const { t } = useTranslation();
  const isPremium = getPlanFamilyKey(plan) === 'personal';
  const isFamily = getPlanFamilyKey(plan) === 'family';

  const minMembers = Number(plan.includedUsers || 1);

  // Priorité: localisé par le backend → localisé par le frontend → EUR par défaut
  const backendLocalized = Boolean(plan.localizedCurrency && plan.localizedCurrency !== (plan.currency || 'EUR'));
  const frontendLocalized = Boolean(localCurrency && localCurrency !== 'EUR' && !backendLocalized);
  const isLocalized = backendLocalized || frontendLocalized;

  const displayCurrency = backendLocalized
    ? plan.localizedCurrency
    : (frontendLocalized ? localCurrency : (plan.currency || 'EUR'));

  const basePriceCentsEUR = Number(plan.basePriceCents || 0);
  const extraUserPriceCentsEUR = Number(plan.extraUserPriceCents || 0);

  const basePriceCents = backendLocalized
    ? Number(plan.localizedPriceCents || 0)
    : (frontendLocalized && convertFromEUR ? convertFromEUR(basePriceCentsEUR) : basePriceCentsEUR);

  const extraUserPriceCents = backendLocalized
    ? Number(plan.localizedExtraUserPriceCents || 0)
    : (frontendLocalized && convertFromEUR ? convertFromEUR(extraUserPriceCentsEUR) : extraUserPriceCentsEUR);

  const extraMembers = isFamily && membersCount !== undefined ? Math.max(0, membersCount - minMembers) : 0;
  const computedPriceCents = basePriceCents + extraMembers * extraUserPriceCents;
  const formatDisplayMoney = React.useCallback(
    (cents) => formatMinorUnits(cents, displayCurrency),
    [displayCurrency],
  );

  return (
    <Box
      sx={{
        position: 'relative',
        border: isPremium ? `2px solid ${primary}` : '1px solid #e8e3dc',
        borderRadius: '14px',
        bgcolor: '#fff',
        p: 3.5,
        boxShadow: isPremium ? '0 14px 24px rgba(0,0,0,0.12)' : '0 2px 8px rgba(0,0,0,0.05)',
        transform: { md: isPremium ? 'scale(1.05)' : 'none' },
        zIndex: isPremium ? 2 : 1,
      }}
    >
      {isPremium && (
        <Chip
          label={t('pricing.recommended')}
          sx={{
            position: 'absolute',
            top: -14,
            left: '50%',
            transform: 'translateX(-50%)',
            bgcolor: primary,
            color: '#111',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontWeight: 800,
            fontSize: '0.65rem',
          }}
        />
      )}

      <Typography sx={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: isPremium ? primary : '#7a746d', fontWeight: 800 }}>
        {planBadge(plan.slug, t)}
      </Typography>
      <Typography sx={{ mt: 0.5, fontSize: '1.6rem', fontWeight: 800 }}>{plan.name}</Typography>

      {/* Member selector for family plans */}
      {isFamily && membersCount !== undefined && (
        <MemberSelector
          count={membersCount}
          min={minMembers}
          max={MAX_FAMILY_MEMBERS}
          onChange={onMembersCountChange}
        />
      )}

      <Box sx={{ mt: isFamily ? 1.6 : 2.1, display: 'flex', alignItems: 'baseline', gap: 0.5, flexWrap: 'wrap' }}>
        <Typography sx={{ fontSize: { xs: '2rem', sm: '2.4rem' }, lineHeight: 1, fontWeight: 900, overflowWrap: 'anywhere' }}>
          {formatDisplayMoney(computedPriceCents)}
        </Typography>
        <Typography sx={{ fontSize: '1rem', fontWeight: 700 }}>{t('pricing.perDays', { n: plan.durationDays })}</Typography>
      </Box>

      {isLocalized && (
        <Typography sx={{ mt: 0.4, fontSize: '0.78rem', color: '#9a8c7f', overflowWrap: 'anywhere' }}>
          ≈ {formatMinorUnits(Number(plan.basePriceCents || 0) + extraMembers * Number(plan.extraUserPriceCents || 0), plan.currency || 'EUR')}
        </Typography>
      )}

      {isFamily && extraMembers > 0 && (
        <Typography sx={{ mt: 0.6, fontSize: '0.8rem', color: '#6d665d', overflowWrap: 'anywhere' }}>
          {formatDisplayMoney(basePriceCents)} base · +{formatDisplayMoney(extraUserPriceCents)} × {extraMembers}
        </Typography>
      )}

      {plan.monthlyEquivalentCents && !isFamily ? (
        <Typography sx={{ mt: 0.8, fontSize: '0.82rem', color: '#6d665d', overflowWrap: 'anywhere' }}>
          {t('pricing.soit', { price: isLocalized
            ? formatDisplayMoney(Math.round(plan.monthlyEquivalentCents * (basePriceCents / Math.max(1, Number(plan.basePriceCents || 1)))))
            : formatLocalFromEUR(plan.monthlyEquivalentCents) })}
        </Typography>
      ) : null}

      <Button
        fullWidth
        disabled={loadingCheckout || actionDisabled}
        onClick={() => onCheckout(plan, isFamily ? membersCount : undefined)}
        sx={{
          mt: 3,
          height: 46,
          bgcolor: isPremium ? primary : isFamily ? '#1c160d' : '#f2f2f2',
          color: isPremium || isFamily ? '#fff' : '#1c160d',
          borderRadius: '10px',
          fontWeight: 800,
          '&:hover': {
            bgcolor: isPremium ? '#e49e22' : isFamily ? '#2e2519' : '#e8e8e8',
          },
        }}
      >
        {loadingCheckout ? t('common.loading') : actionLabel}
      </Button>

      <Stack spacing={1.7} sx={{ mt: 2.2 }}>
        {planFeatures(plan, (cents) => formatDisplayMoney(cents), t).map((feature) => (
          <Box key={feature} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.2 }}>
            <CheckCircleOutlineIcon sx={{ color: isPremium ? primary : isFamily ? '#2563eb' : '#30a46c', fontSize: 20 }} />
            <Typography sx={{ fontSize: '0.9rem', color: '#1c160d' }}>{feature}</Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

export default function PricingPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isMobile = useMediaQuery('(max-width:900px)');
  const { currency: localCurrency, country: localCountry, isLocalized: isFrontendLocalized, convertFromEUR, formatPrice: formatLocalPrice } = useCurrency();

  const [plans, setPlans] = useState([]);
  const [geoInfo, setGeoInfo] = useState(null);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [loadingCheckoutSlug, setLoadingCheckoutSlug] = useState('');
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [expandedFaq, setExpandedFaq] = useState(() => ({ 'faq-0': true }));
  const [error, setError] = useState('');
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'info' });
  const showSnack = (message, severity = 'info') => setSnack({ open: true, message, severity });
  // Payment method dialog state
  const [paymentDialog, setPaymentDialog] = useState({ open: false, plan: null, membersCount: null, providerBusy: '' });
  const closePaymentDialog = () => {
    if (paymentDialog.providerBusy) return; // prevent close while loading
    setPaymentDialog({ open: false, plan: null, membersCount: null, providerBusy: '' });
    setPromoCode('');
    setPromoResult(null);
    setPromoError('');
  };

  // Promo code state
  const [promoCode, setPromoCode] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoResult, setPromoResult] = useState(null);
  const [promoError, setPromoError] = useState('');

  const handleValidatePromo = useCallback(async () => {
    const trimmed = promoCode.trim().toUpperCase();
    if (!trimmed) return;
    setPromoLoading(true);
    setPromoError('');
    setPromoResult(null);
    try {
      const result = await subscriptionsService.validatePromoCode({
        code: trimmed,
        planId: paymentDialog.plan?.id,
        usersLimit: paymentDialog.membersCount,
      });
      setPromoResult(result);
    } catch (err) {
      setPromoError(err.message || t('pricing.promoInvalid'));
    } finally {
      setPromoLoading(false);
    }
  }, [promoCode, paymentDialog.plan, paymentDialog.membersCount]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [familyMembersCount, setFamilyMembersCount] = useState(3);

  useEffect(() => {
    const loadPlans = async () => {
      setLoadingPlans(true);
      setError('');
      try {
        const { plans: data, geo } = await subscriptionsService.getPlansWithGeo();
        setPlans(data || []);
        setGeoInfo(geo || null);
      } catch (err) {
        console.error('Pricing plans error:', err);
        setError(t('pricing.cannotLoadPlans'));
      } finally {
        setLoadingPlans(false);
      }
    };

    loadPlans();
  }, []);

  useEffect(() => {
    const loadAuthAndSubscription = async () => {
      try {
        const authenticated = await authService.isAuthenticated();
        setIsAuthenticated(authenticated);
        if (!authenticated) {
          setSubscriptionStatus(null);
          return;
        }
        const sub = await subscriptionsService.getMySubscription();
        setSubscriptionStatus(sub || null);
      } catch (_) {
        setSubscriptionStatus(null);
      }
    };
    loadAuthAndSubscription();
  }, []);

  const sortedPlans = useMemo(() => {
    const groups = new Map();
    plans.forEach((plan) => {
      const key = getPlanFamilyKey(plan);
      const cycle = detectBillingCycle(plan);
      const group = groups.get(key) || {};
      group[cycle] = plan;
      groups.set(key, group);
    });

    const selectedPlans = [];
    groups.forEach((group) => {
      if (group[billingCycle]) {
        const selectedPlan = group[billingCycle];
        if (billingCycle === 'annual' && group.monthly) {
          const monthlyEquivalentCents = Math.round(Number(selectedPlan.basePriceCents || 0) / 12);
          selectedPlans.push({
            ...selectedPlan,
            monthlyEquivalentCents,
            annualSavingsPercent: Math.max(0, Math.round((1 - (monthlyEquivalentCents / Math.max(1, Number(group.monthly.basePriceCents || 1)))) * 100)),
          });
        } else {
          selectedPlans.push(selectedPlan);
        }
      } else if (billingCycle === 'annual' && group.monthly) {
        const monthly = group.monthly;
        selectedPlans.push({
          ...monthly,
          id: `${monthly.id}-annual-proxy`,
          slug: `${monthly.slug}-annual-proxy`,
          displayOnlyAnnual: true,
          basePriceCents: Math.round(Number(monthly.basePriceCents || 0) * 12 * 0.8),
          durationDays: 365,
        });
      } else if (group.monthly) {
        selectedPlans.push(group.monthly);
      }
    });

    return selectedPlans.sort((a, b) => Number(a.basePriceCents || 0) - Number(b.basePriceCents || 0));
  }, [plans, billingCycle]);

  const annualAvailableCount = useMemo(
    () => plans.filter((plan) => detectBillingCycle(plan) === 'annual').length,
    [plans]
  );

  // Sync familyMembersCount minimum when billing cycle or plans change
  useEffect(() => {
    const familyPlan = sortedPlans.find((p) => getPlanFamilyKey(p) === 'family');
    if (familyPlan) {
      const min = Number(familyPlan.includedUsers || 3);
      setFamilyMembersCount((prev) => Math.max(prev, min));
    }
  }, [sortedPlans]);

  const toggleFaq = (faqId) => (_, expanded) => {
    setExpandedFaq((prev) => ({
      ...prev,
      [faqId]: expanded,
    }));
  };

  const handleCheckout = async (plan, membersCount) => {
    const isFamily = getPlanFamilyKey(plan) === 'family';
    const resolvedUsersLimit = isFamily && membersCount !== undefined
      ? membersCount
      : Number(plan.includedUsers || 1);

    const activeSub = Boolean(subscriptionStatus?.isActive && subscriptionStatus?.subscription);
    const currentSub = subscriptionStatus?.subscription || null;
    const currentPlanId = currentSub?.plan_id || null;
    const currentPlanType = String(currentSub?.plan_type || '').toLowerCase();
    const currentUsersLimit = Number(currentSub?.users_limit || plan.includedUsers || 1);
    const currentDisplayedPlan = sortedPlans.find((p) => p.id === currentPlanId)
      || sortedPlans.find((p) => getPlanFamilyKey(p) === getPlanFamilyKey({ slug: currentPlanType }));
    const currentPrice = Number(currentDisplayedPlan?.basePriceCents || 0);
    const samePlan = (currentPlanId && currentPlanId === plan.id)
      || (currentPlanType && getPlanFamilyKey({ slug: currentPlanType }) === getPlanFamilyKey(plan));

    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (activeSub && samePlan) return;

    setLoadingCheckoutSlug(plan.slug);
    setError('');
    try {
      if (plan.displayOnlyAnnual) {
        showSnack(t('pricing.planNotAvailable', { name: plan.name }), 'warning');
        return;
      }

      if (activeSub) {
        if (Number(plan.basePriceCents || 0) <= currentPrice) {
          showSnack(t('pricing.upgradeOnly'), 'warning');
          return;
        }
        await subscriptionsService.changePlan({
          planId: plan.id,
          usersLimit: Math.max(currentUsersLimit, resolvedUsersLimit),
        });
        showSnack(t('pricing.planChanged', { name: plan.name }), 'success');
        setLoadingCheckoutSlug('');
      } else {
        // Open payment method dialog — user will choose between Stripe (card) or Flutterwave (mobile money)
        setLoadingCheckoutSlug('');
        setPaymentDialog({ open: true, plan, membersCount: resolvedUsersLimit, providerBusy: '' });
      }
    } catch (err) {
      console.error('Checkout error:', err);
      const msg = err?.message || '';
      if (msg.toLowerCase().includes('not authenticated') || msg.toLowerCase().includes('session expired')) {
        navigate('/login');
        return;
      }
      showSnack(msg || t('pricing.genericError'), 'error');
      setLoadingCheckoutSlug('');
    }
  };

  // Called when user picks a payment provider in the dialog
  const doCheckout = async (provider) => {
    const { plan, membersCount } = paymentDialog;
    setPaymentDialog((d) => ({ ...d, providerBusy: provider }));
    setLoadingCheckoutSlug(plan.slug);
    try {
      const response = await subscriptionsService.checkout({
        planId: plan.id,
        usersLimit: membersCount,
        provider,
        promoCode: promoResult ? promoCode.trim().toUpperCase() : undefined,
      });
      setPaymentDialog({ open: false, plan: null, membersCount: null, providerBusy: '' });
      setPromoCode('');
      setPromoResult(null);
      setPromoError('');
      if (response.paymentLink) {
        window.location.href = response.paymentLink;
        return;
      }
      showSnack(t('pricing.paymentLinkUnavailable'), 'warning');
    } catch (err) {
      console.error('doCheckout error:', err);
      const msg = err?.message || '';
      if (msg.toLowerCase().includes('not authenticated') || msg.toLowerCase().includes('session expired')) {
        navigate('/login');
        return;
      }
      showSnack(msg || t('pricing.genericError'), 'error');
      setPaymentDialog((d) => ({ ...d, providerBusy: '' }));
    } finally {
      setLoadingCheckoutSlug('');
    }
  };

  const comparisonRows = [
    {
      key: 'price',
      label: t('pricing.priceLabel'),
      value: (p) => {
        if (p.localizedPriceCents && p.localizedCurrency) return formatMinorUnits(p.localizedPriceCents, p.localizedCurrency);
        if (isFrontendLocalized) return formatLocalPrice(p.basePriceCents);
        return formatMinorUnits(p.basePriceCents, p.currency || 'EUR');
      },
    },
    {
      key: 'includedUsers',
      label: t('pricing.includedUsers', { n: '' }),
      value: (p) => String(p.includedUsers || 1),
    },
    {
      key: 'textQuota',
      label: t('pricing.textBooksQuota', { n: '' }),
      value: (p) => String(p.textQuotaPerUser || 0),
    },
    {
      key: 'audioQuota',
      label: t('pricing.audioBooksQuota', { n: '' }),
      value: (p) => String(p.audioQuotaPerUser || 0),
    },
    {
      key: 'discount',
      label: t('pricing.discountPaid', { n: '' }),
      value: (p) => `${p.discountPercentPaidBooks || 0}%`,
    },
    {
      key: 'extraUser',
      label: t('pricing.extraUser', { price: '' }),
      value: (p) => {
        if (Number(p.extraUserPriceCents || 0) <= 0) return <RemoveIcon sx={{ color: '#b9b3aa' }} />;
        if (p.localizedExtraUserPriceCents && p.localizedCurrency) return formatMinorUnits(p.localizedExtraUserPriceCents, p.localizedCurrency);
        if (isFrontendLocalized) return formatLocalPrice(p.extraUserPriceCents);
        return formatMinorUnits(p.extraUserPriceCents, p.currency || 'EUR');
      },
    },
  ];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: background, color: '#1c160d' }}>
      <CurrencyFloatingSelector />
      <PublicHeader
        activeKey="pricing"
        isAuthenticated={isAuthenticated}
        authenticatedCtaPath="/subscription"
        background={background}
      />

      <Box sx={{ background: 'linear-gradient(to bottom, rgba(244,168,37,0.12), rgba(244,168,37,0))', py: { xs: 8, md: 12 } }}>
        <Container maxWidth="md" sx={{ textAlign: 'center' }}>
          <Typography sx={{ fontFamily: 'Playfair Display, Newsreader, serif', fontSize: { xs: '2.2rem', md: '4rem' }, fontWeight: 900, lineHeight: 1.05 }}>
            {t('pricing.choosePlan2')}
          </Typography>
          <Typography sx={{ mt: 2, color: '#6d665d' }}>
            {t('pricing.realtimePricing')}
          </Typography>

          {(geoInfo?.currency && geoInfo.currency !== 'EUR') || isFrontendLocalized ? (
            <Typography sx={{ mt: 1, fontSize: '0.82rem', color: '#9a7f4d', bgcolor: 'rgba(244,168,37,0.08)', display: 'inline-block', px: 2, py: 0.5, borderRadius: '20px', border: '1px solid rgba(244,168,37,0.2)' }}>
              {t('pricing.priceDisplayed', { currency: geoInfo?.currency || localCurrency })}
              {(geoInfo?.country || localCountry) ? ` (${geoInfo?.country || localCountry})` : ''}
            </Typography>
          ) : null}

          <Box sx={{ mt: 4.5, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1.5 }}>
            {!isMobile && <Typography sx={{ fontSize: '0.84rem', fontWeight: 600 }}>{t('pricing.monthlyBilling')}</Typography>}
            <Box sx={{ width: 260, borderRadius: 999, p: 0.5, bgcolor: '#fff', border: '1px solid rgba(244,168,37,0.25)', display: 'flex' }}>
              <Box
                onClick={() => setBillingCycle('monthly')}
                sx={{
                  cursor: 'pointer',
                  flex: 1,
                  height: 36,
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: 999,
                  bgcolor: billingCycle === 'monthly' ? primary : 'transparent',
                }}
              >
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: billingCycle === 'monthly' ? '#111' : '#1c160d' }}>
                  {t('pricing.monthly')}
                </Typography>
              </Box>
              <Box
                onClick={() => {
                  if (annualAvailableCount > 0) setBillingCycle('annual');
                }}
                sx={{
                  cursor: annualAvailableCount > 0 ? 'pointer' : 'not-allowed',
                  flex: 1,
                  height: 36,
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: 999,
                  bgcolor: billingCycle === 'annual' ? primary : 'transparent',
                  opacity: annualAvailableCount > 0 ? 1 : 0.5,
                }}
              >
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 800, color: billingCycle === 'annual' ? '#111' : '#1c160d' }}>
                  {t('pricing.annual')}
                </Typography>
              </Box>
            </Box>
            {!isMobile && (
              <Typography sx={{ fontSize: '0.84rem', fontWeight: 600 }}>
                {annualAvailableCount > 0
                  ? billingCycle === 'annual'
                    ? t('pricing.annualSavings')
                    : t('pricing.annualBilling')
                  : t('pricing.annualComingSoon')}
              </Typography>
            )}
          </Box>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ mt: { xs: -2, md: -6 }, mb: 12 }}>
        {error && <Alert severity="warning" sx={{ mb: 3 }}>{error}</Alert>}

        {loadingPlans ? (
          <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 220 }}>
            <CircularProgress sx={{ color: primary }} />
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: `repeat(${Math.max(1, sortedPlans.length)},minmax(0,1fr))` }, gap: 3 }}>
            {sortedPlans.map((plan) => {
              const activeSub = Boolean(subscriptionStatus?.isActive && subscriptionStatus?.subscription);
              const currentSub = subscriptionStatus?.subscription || null;
              const currentPlanId = currentSub?.plan_id || null;
              const currentPlanType = String(currentSub?.plan_type || '').toLowerCase();
              const currentDisplayedPlan = sortedPlans.find((p) => p.id === currentPlanId)
                || sortedPlans.find((p) => getPlanFamilyKey(p) === getPlanFamilyKey({ slug: currentPlanType }));
              const currentPrice = Number(currentDisplayedPlan?.basePriceCents || 0);
              const samePlan = activeSub && (
                (currentPlanId && currentPlanId === plan.id)
                || (currentPlanType && getPlanFamilyKey({ slug: currentPlanType }) === getPlanFamilyKey(plan))
              );

              let actionLabel = planCta(plan.slug, t);
              let actionDisabled = false;
              if (!isAuthenticated) {
                actionLabel = planCta(plan.slug, t);
              } else if (samePlan) {
                actionLabel = t('pricing.currentPlan');
                actionDisabled = true;
              } else if (activeSub) {
                if (Number(plan.basePriceCents || 0) > currentPrice) {
                  actionLabel = t('pricing.upgrade');
                } else {
                  actionLabel = t('pricing.lowerPlan');
                  actionDisabled = true;
                }
              }

              const isFamily = getPlanFamilyKey(plan) === 'family';

              return (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  loadingCheckout={loadingCheckoutSlug === plan.slug}
                  onCheckout={handleCheckout}
                  actionLabel={actionLabel}
                  actionDisabled={actionDisabled}
                  membersCount={isFamily ? familyMembersCount : undefined}
                  onMembersCountChange={isFamily ? setFamilyMembersCount : undefined}
                  localCurrency={localCurrency}
                  convertFromEUR={convertFromEUR}
                  formatLocalFromEUR={formatLocalPrice}
                />
              );
            })}
          </Box>
        )}
      </Container>

      <Container maxWidth="md" sx={{ py: 8 }}>
        <Typography sx={{ textAlign: 'center', fontFamily: 'Playfair Display, Newsreader, serif', fontWeight: 700, fontSize: '2rem', mb: 4.5 }}>
          {t('pricing.detailedComparison')}
        </Typography>
        <Box sx={{ overflowX: 'auto' }}>
          <Table sx={{ minWidth: 700 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#75706a', fontWeight: 800 }}>{t('pricing.features')}</TableCell>
                {sortedPlans.map((p) => (
                  <TableCell key={p.id} sx={{ color: getPlanFamilyKey(p) === 'personal' ? primary : 'inherit', fontWeight: getPlanFamilyKey(p) === 'personal' ? 800 : 700 }}>
                    {p.name}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {comparisonRows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell sx={{ fontSize: '0.9rem', fontWeight: 600 }}>{row.label}</TableCell>
                  {sortedPlans.map((p) => (
                    <TableCell key={`${row.key}-${p.id}`} sx={{ fontSize: '0.9rem' }}>
                      {row.value(p)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Container>

      <Container maxWidth="md" sx={{ py: 8 }}>
        <Typography sx={{ textAlign: 'center', fontFamily: 'Playfair Display, Newsreader, serif', fontWeight: 700, fontSize: '2rem', mb: 4 }}>{t('pricing.faqTitle')}</Typography>
        <Stack spacing={1.5}>
          {[
            [t('pricing.faq0Q'), t('pricing.faq0A')],
            [t('pricing.faq1Q'), t('pricing.faq1A')],
            [t('pricing.faq2Q'), t('pricing.faq2A')],
          ].map((faq, index) => (
            <Accordion
              key={faq[0]}
              expanded={Boolean(expandedFaq[`faq-${index}`])}
              onChange={toggleFaq(`faq-${index}`)}
              sx={{ border: '1px solid #e0ddd6', borderRadius: '10px !important', bgcolor: '#fff', boxShadow: 'none' }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography sx={{ fontWeight: 700 }}>{faq[0]}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography sx={{ color: '#686259', fontSize: '0.88rem' }}>{faq[1]}</Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Stack>
      </Container>

      <Container maxWidth="lg" sx={{ pb: 10 }}>
        <Box sx={{ borderRadius: '18px', px: { xs: 3, md: 7 }, py: { xs: 4, md: 7 }, background: 'linear-gradient(90deg,#f4a825,#f97316)', textAlign: 'center', boxShadow: '0 18px 30px rgba(0,0,0,0.15)' }}>
          <Typography sx={{ fontSize: { xs: '1.8rem', md: '3rem' }, lineHeight: 1.05, fontWeight: 900 }}>{t('pricing.readyToUnlock')}</Typography>
          <Typography sx={{ mt: 1.2, color: 'rgba(0,0,0,0.72)' }}>
            {t('pricing.choosePlanStart')}
          </Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mt: 3, justifyContent: 'center' }}>
            <Button sx={{ bgcolor: '#111', color: '#fff', height: 46, px: 3.2, borderRadius: '10px', fontWeight: 800, '&:hover': { bgcolor: '#000' } }} onClick={() => navigate(isAuthenticated ? '/subscription' : '/register')}>
              {isAuthenticated ? t('pricing.mySpace') : t('pricing.createAccount')}
            </Button>
            <Button sx={{ bgcolor: 'rgba(255,255,255,0.28)', color: '#111', height: 46, px: 3.2, borderRadius: '10px', border: '1px solid rgba(0,0,0,0.1)', fontWeight: 800 }} onClick={() => navigate('/catalogue')}>
              {t('pricing.viewLibrary')}
            </Button>
          </Stack>
        </Box>
      </Container>

      <Box sx={{ borderTop: '1px solid #e6e2db', py: 4.2, bgcolor: '#fff' }}>
        <Container maxWidth="lg" sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: 'center', justifyContent: 'space-between', gap: 2.5 }}>
          <Box component="img" src={papyriLogo} alt="Papyri" sx={{ height: 38, objectFit: 'contain' }} />
          <Typography sx={{ fontSize: '0.74rem', color: '#9b9488' }}>{t('landing.footerCopyright')}</Typography>
        </Container>
      </Box>

      {/* Payment method dialog */}
      <Dialog
        open={paymentDialog.open}
        onClose={closePaymentDialog}
        PaperProps={{ sx: { borderRadius: 4, p: 0.5, maxWidth: 420, width: '100%' } }}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1.2rem', pb: 0.5, color: '#1c160d' }}>
          {t('pricing.paymentTitle')}
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#8a7f74', mb: 2, fontSize: '0.92rem' }}>
            {paymentDialog.plan ? t('pricing.paymentDescPlan', { plan: paymentDialog.plan.name }) : t('pricing.paymentDesc')}
          </Typography>

          {/* ── Code promo ── */}
          <Box sx={{ mb: 2.5 }}>
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <TextField
                size="small"
                placeholder={t('pricing.promoPlaceholder')}
                value={promoCode}
                onChange={(e) => {
                  setPromoCode(e.target.value.toUpperCase());
                  setPromoResult(null);
                  setPromoError('');
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleValidatePromo(); }}
                disabled={Boolean(paymentDialog.providerBusy) || promoLoading}
                sx={{ flex: 1, '& .MuiInputBase-input': { fontFamily: 'monospace', letterSpacing: 1 } }}
                InputProps={{
                  endAdornment: promoResult ? (
                    <InputAdornment position="end">
                      <Box component="span" sx={{ color: 'success.main', fontSize: '1.1rem' }}>✓</Box>
                    </InputAdornment>
                  ) : null,
                }}
              />
              <Button
                variant="outlined"
                size="small"
                onClick={handleValidatePromo}
                disabled={!promoCode.trim() || Boolean(paymentDialog.providerBusy) || promoLoading}
                sx={{ whiteSpace: 'nowrap', borderRadius: 2, textTransform: 'none', height: 40 }}
              >
                {promoLoading ? <CircularProgress size={16} /> : t('pricing.promoApply')}
              </Button>
            </Stack>

            <Collapse in={Boolean(promoResult)}>
              {promoResult && (
                <Box sx={{ mt: 1, p: 1.5, bgcolor: '#f0fdf4', borderRadius: 2, border: '1px solid #bbf7d0' }}>
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#15803d' }}>
                    {t('pricing.promoApplied', { code: promoResult.code })}
                  </Typography>
                  <Typography sx={{ fontSize: '0.82rem', color: '#166534', mt: 0.3 }}>
                    {t('pricing.promoDiscount', {
                      discount: promoResult.discountType === 'percent'
                        ? `-${promoResult.discountValue}%`
                        : `-${formatMinorUnits(promoResult.discountCents, paymentDialog.plan?.currency || 'EUR')}`,
                      total: formatMinorUnits(promoResult.finalAmountCents, paymentDialog.plan?.currency || 'EUR'),
                      original: formatMinorUnits(promoResult.originalAmountCents, paymentDialog.plan?.currency || 'EUR'),
                    })}
                  </Typography>
                </Box>
              )}
            </Collapse>

            <Collapse in={Boolean(promoError)}>
              {promoError && (
                <Typography sx={{ mt: 0.8, fontSize: '0.82rem', color: 'error.main' }}>
                  {promoError}
                </Typography>
              )}
            </Collapse>
          </Box>

          <Stack spacing={1.5}>
            {/* Stripe — carte bancaire */}
            <Button
              fullWidth
              variant="outlined"
              disabled={Boolean(paymentDialog.providerBusy)}
              onClick={() => doCheckout('stripe')}
              sx={{
                borderRadius: 3,
                p: 2,
                textTransform: 'none',
                borderColor: '#5469d4',
                justifyContent: 'flex-start',
                gap: 2,
                '&:hover': { bgcolor: '#f0f1ff', borderColor: '#4556c4' },
                '&.Mui-disabled': { borderColor: '#ccc' },
              }}
            >
              {paymentDialog.providerBusy === 'stripe' ? (
                <CircularProgress size={22} sx={{ color: '#5469d4', flexShrink: 0 }} />
              ) : (
                <Box component="span" sx={{ fontSize: '1.6rem', lineHeight: 1, flexShrink: 0 }}>💳</Box>
              )}
              <Stack alignItems="flex-start" spacing={0.2} sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: '#5469d4' }}>
                  {t('pricing.cardPayment')}
                </Typography>
                <Typography sx={{ fontSize: '0.78rem', color: '#888' }}>
                  {t('pricing.cardSubtitle')}
                </Typography>
              </Stack>
            </Button>

            {/* Flutterwave — mobile money */}
            <Button
              fullWidth
              variant="outlined"
              disabled={Boolean(paymentDialog.providerBusy)}
              onClick={() => doCheckout('flutterwave')}
              sx={{
                borderRadius: 3,
                p: 2,
                textTransform: 'none',
                borderColor: '#f9a825',
                justifyContent: 'flex-start',
                gap: 2,
                '&:hover': { bgcolor: '#fff8e1', borderColor: '#f9a825' },
                '&.Mui-disabled': { borderColor: '#ccc' },
              }}
            >
              {paymentDialog.providerBusy === 'flutterwave' ? (
                <CircularProgress size={22} sx={{ color: '#f9a825', flexShrink: 0 }} />
              ) : (
                <Box component="span" sx={{ fontSize: '1.6rem', lineHeight: 1, flexShrink: 0 }}>📱</Box>
              )}
              <Stack alignItems="flex-start" spacing={0.2} sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: '#e65100' }}>
                  {t('pricing.mobileMoneyPayment')}
                </Typography>
                <Typography sx={{ fontSize: '0.78rem', color: '#888' }}>
                  {t('pricing.mobileMoneySubtitle')}
                </Typography>
              </Stack>
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>

      {/* Snackbar global — visible peu importe le scroll */}
      <Snackbar
        open={snack.open}
        autoHideDuration={snack.severity === 'success' ? 6000 : 8000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snack.severity}
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          sx={{ width: '100%', maxWidth: 520, fontWeight: 600 }}
          action={
            snack.severity === 'success' ? (
              <Button color="inherit" size="small" onClick={() => navigate('/subscription')}>
                {t('pricing.seeSubscription')}
              </Button>
            ) : null
          }
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
