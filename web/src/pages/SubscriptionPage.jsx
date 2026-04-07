import React, { useEffect, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BadgeCheck,
  Download,
  Plus,
  Search,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { subscriptionsService } from '../services/subscriptions.service';
import * as familyService from '../services/family.service';
import tokens from '../config/tokens';
import * as authService from '../services/auth.service';
import UserSpaceSidebar from '../components/UserSpaceSidebar';
import MobileBottomNav from '../components/MobileBottomNav';
import FamilyProfilesManager from '../components/FamilyProfilesManager';
import CurrencyFloatingSelector from '../components/CurrencyFloatingSelector';
import { useCurrency } from '../hooks/useCurrency';

const MAX_FAMILY_SEATS = 10;

function formatDate(iso, locale = 'fr-FR') {
  if (!iso) return '-';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
}

function progressValue(value, total) {
  const safeTotal = Math.max(1, Number(total || 0));
  const safeValue = Math.max(0, Number(value || 0));
  return Math.min(100, Math.round((safeValue / safeTotal) * 100));
}

function RingCard({ title, value, hint, pct }) {
  const safePct = Math.min(100, Math.max(0, Number(pct || 0)));
  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, md: 3 },
        borderRadius: 4,
        border: '1px solid #ece7dd',
        background: '#ffffff',
        minHeight: { xs: 190, md: 220 },
      }}
    >
      <Typography sx={{ fontWeight: 700, color: '#2e2e2e', mb: 2 }}>{title}</Typography>
      <Box sx={{ display: 'grid', placeItems: 'center', mb: 2.5 }}>
        <Box
          sx={{
            width: 102,
            height: 102,
            borderRadius: '50%',
            background: `conic-gradient(#f1a10a ${safePct}%, #efefef ${safePct}% 100%)`,
            p: '10px',
          }}
        >
          <Box
            sx={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              bgcolor: '#fff',
              display: 'grid',
              placeItems: 'center',
              textAlign: 'center',
              lineHeight: 1.1,
            }}
          >
            <Typography sx={{ fontWeight: 800, fontSize: { xs: '1.55rem', md: '1.9rem' }, color: '#1e1e1e' }}>{value}</Typography>
          </Box>
        </Box>
      </Box>
      <Typography sx={{ color: '#8a8175', fontSize: '0.83rem', textAlign: 'center' }}>{hint}</Typography>
    </Paper>
  );
}

export default function SubscriptionPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith('fr') ? 'fr-FR' : 'en-US';
  const { formatPrice: formatLocalPrice, formatFrom: formatMoneyFromSource } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [status, setStatus] = useState(null);
  const [plans, setPlans] = useState([]);
  const [usage, setUsage] = useState(null);
  const [bonuses, setBonuses] = useState([]);
  const [payments, setPayments] = useState([]);
  const [members, setMembers] = useState([]);
  const [memberRole, setMemberRole] = useState(null);
  const [user, setUser] = useState(null);
  const [familySummary, setFamilySummary] = useState(null);

  // Email lookup state for adding family members
  const [lookupEmail, setLookupEmail] = useState('');
  const [lookupUser, setLookupUser] = useState(null);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupError, setLookupError] = useState('');

  // Extra seat payment dialog
  const [seatDialog, setSeatDialog] = useState({ open: false, providerBusy: '' });
  const closeSeatDialog = () => { if (!seatDialog.providerBusy) setSeatDialog({ open: false, providerBusy: '' }); };

  const hasActive = Boolean(status?.isActive);
  const subscription = status?.subscription || null;
  const isStripe = subscription?.provider === 'stripe';

  const bonusAvailableTotal = bonuses.reduce((sum, item) => sum + Number(item.available || 0), 0);
  const activeMembersCount = members.filter((m) => m.status === 'active').length;
  const planCode = (subscription?.plan_snapshot?.planCode || subscription?.plan_type || '').toLowerCase();
  const isFamilyPlan = planCode.includes('family');
  const profileCount = familySummary?.profiles?.length || 0;
  const usersLimit = Number(subscription?.profiles_limit || subscription?.users_limit || 1);
  const seatsRemaining = Math.max(0, usersLimit - (isFamilyPlan ? profileCount : activeMembersCount));
  const isOwner = memberRole === 'owner';

  // Detect family plan
  const currentPlan = plans.find((p) => p.id === subscription?.plan_id);
  const extraUserPriceCents = currentPlan?.extraUserPriceCents || 600;
  const minFamilyMembers = currentPlan?.includedUsers || 3;
  const formatDirectMoney = (cents, currency = 'EUR') => formatMoneyFromSource(cents, currency);
  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [
        myStatus,
        allPlans,
        usageResult,
        bonusesResult,
        historyResult,
        membersResult,
        userResult,
      ] = await Promise.allSettled([
        subscriptionsService.getMySubscription(),
        subscriptionsService.getPlans(),
        subscriptionsService.getMyUsage(),
        subscriptionsService.getMyBonuses(),
        subscriptionsService.getPaymentHistory(),
        subscriptionsService.getMembers(),
        authService.getUser(),
      ]);

      if (myStatus.status === 'fulfilled') {
        setStatus(myStatus.value);
      } else {
        throw new Error(myStatus.reason?.message || t('subscription.loadStatusError'));
      }

      if (allPlans.status === 'fulfilled') setPlans(allPlans.value || []);
      setUsage(usageResult.status === 'fulfilled' ? (usageResult.value?.data || null) : null);
      setBonuses(bonusesResult.status === 'fulfilled' ? (bonusesResult.value?.data || []) : []);
      setPayments(historyResult.status === 'fulfilled' ? (historyResult.value?.payments || []) : []);

      if (membersResult.status === 'fulfilled') {
        setMembers(membersResult.value?.data?.members || []);
        setMemberRole(membersResult.value?.data?.member_role || null);
      } else {
        setMembers([]);
        setMemberRole(null);
      }
      if (userResult.status === 'fulfilled') setUser(userResult.value || null);
    } catch (err) {
      setError(err.message || t('subscription.loadError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!isFamilyPlan) {
      setFamilySummary(null);
      return;
    }
    familyService.getProfiles()
      .then((data) => setFamilySummary(data || null))
      .catch(() => setFamilySummary(null));
  }, [isFamilyPlan, subscription?.id]);

  const openPaymentLink = (paymentLink) => {
    if (!paymentLink) { setError(t('subscription.paymentLinkUnavailable')); return; }
    window.location.href = paymentLink;
  };

  const runAction = async (fn, successText) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await fn();
      if (result?.paymentLink) { openPaymentLink(result.paymentLink); return; }
      setMessage(successText);
      await loadData();
    } catch (err) {
      setError(err.message || t('subscription.actionError'));
    } finally {
      setBusy(false);
    }
  };

  const runMemberAction = async (fn, successText) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await fn();
      setMessage(successText);
      await loadData();
    } catch (err) {
      const msg = String(err?.message || t('subscription.memberActionError'));
      if (msg.includes('users_limit reached')) {
        setError(t('subscription.seatLimitReached'));
      } else if (msg.includes('already a member')) {
        setError(t('subscription.alreadyMember'));
      } else if (msg.includes('Only subscription owner')) {
        setError(t('subscription.ownerOnly'));
      } else if (msg.includes('Active member not found')) {
        setError(t('subscription.memberNotFound'));
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const doBuyExtraSeat = async (provider) => {
    setSeatDialog((d) => ({ ...d, providerBusy: provider }));
    try {
      const result = await subscriptionsService.buyExtraSeat({ provider });
      setSeatDialog({ open: false, providerBusy: '' });
      if (result.paymentLink) {
        window.location.href = result.paymentLink;
        return;
      }
      setError(t('subscription.paymentLinkUnavailable'));
    } catch (err) {
      setError(err.message || t('subscription.seatPurchaseError'));
      setSeatDialog((d) => ({ ...d, providerBusy: '' }));
    }
  };

  const [invoiceBusy, setInvoiceBusy] = useState({});
  const handleDownloadInvoice = async (paymentId) => {
    if (invoiceBusy[paymentId]) return;
    setInvoiceBusy((prev) => ({ ...prev, [paymentId]: true }));
    try {
      await subscriptionsService.downloadInvoice(paymentId);
    } catch (err) {
      setError(err.message || t('subscription.invoiceDownloadError'));
    } finally {
      setInvoiceBusy((prev) => ({ ...prev, [paymentId]: false }));
    }
  };

  const handleLookupUser = async () => {
    if (!lookupEmail.trim()) return;
    setLookupBusy(true);
    setLookupError('');
    setLookupUser(null);
    try {
      const found = await subscriptionsService.lookupUserByEmail(lookupEmail.trim());
      setLookupUser(found);
    } catch (err) {
      setLookupError(err.message || t('subscription.userNotFound'));
    } finally {
      setLookupBusy(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  const usageData = usage?.usage || {};
  const textUsed = usageData.text_unlocked_count || 0;
  const textQuota = usageData.text_quota || 0;
  const audioUsed = usageData.audio_unlocked_count || 0;
  const audioQuota = usageData.audio_quota || 0;
  const activeLabel = hasActive ? t('subscription.active').toUpperCase() : t('subscription.inactive').toUpperCase();
  const subscriptionLabel = hasActive
    ? t('subscription.subscriptionActiveLabel', { name: subscription?.plan_snapshot?.name || subscription?.plan_type || t('subscription.title') })
    : t('subscription.noSubscription');

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5', display: 'flex' }}>
      <CurrencyFloatingSelector />
      <UserSpaceSidebar user={user} activeKey="subscription" subscriptionLabel={subscriptionLabel} />

      <Box sx={{ flex: 1, p: { xs: 1.25, sm: 2, md: 4 } }}>
        <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', md: 'center' }}
            sx={{ mb: 3, gap: 1.5 }}
          >
            <Box>
              <Typography sx={{ fontWeight: 800, color: '#222', fontSize: { xs: '1.9rem', md: '2.2rem' } }}>
                {t('subscription.pageTitle')}
              </Typography>
              <Typography sx={{ color: '#918a80' }}>{t('subscription.pageSubtitle')}</Typography>
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} sx={{ width: { xs: '100%', md: 'auto' } }}>
              <Button variant="outlined" sx={{ borderColor: '#d7d7d7', color: '#555', textTransform: 'none', borderRadius: 3, width: { xs: '100%', sm: 'auto' } }} onClick={loadData}>
                {t('common.refresh')}
              </Button>
              <Button variant="contained" sx={{ bgcolor: '#f1a10a', textTransform: 'none', borderRadius: 3, width: { xs: '100%', sm: 'auto' }, '&:hover': { bgcolor: '#d9900a' } }} onClick={() => navigate('/pricing')}>
                {t('subscription.changePlan')}
              </Button>
            </Stack>
          </Stack>

          <Box
            sx={{
              display: { xs: 'grid', lg: 'none' },
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 1,
              mb: 2,
            }}
          >
            {[
              { label: t('subscription.plan'), value: hasActive ? t('subscription.active') : t('subscription.inactive') },
              { label: t('subscription.seats'), value: `${activeMembersCount}/${usersLimit}` },
              { label: t('subscription.bonus'), value: `${bonusAvailableTotal}` },
            ].map((item) => (
              <Paper key={item.label} elevation={0} sx={{ p: 1.4, borderRadius: 3, border: '1px solid #ece7dd' }}>
                <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#8a8175', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</Typography>
                <Typography sx={{ mt: 0.25, fontWeight: 800, fontSize: '1rem', color: '#1f1f1f' }}>{item.value}</Typography>
              </Paper>
            ))}
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}

          {/* Plan header card */}
          <Paper elevation={0} sx={{ p: { xs: 2.2, md: 3.2 }, borderRadius: 4, border: '1px solid #ece7dd', background: '#fff', mb: 3 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2.5}>
              <Stack direction="row" spacing={2}>
                <Box sx={{ width: 72, height: 72, borderRadius: 2.2, bgcolor: '#f1a10a', display: 'grid', placeItems: 'center', color: '#fff', flexShrink: 0 }}>
                  <BadgeCheck size={32} />
                </Box>
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.6 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: { xs: '1.4rem', md: '1.8rem' }, color: '#1f1f1f' }}>
                      {subscription?.plan_snapshot?.name || subscription?.plan_type || t('subscription.noPlan')}
                    </Typography>
                    <Box sx={{ px: 1.1, py: 0.2, borderRadius: 99, bgcolor: hasActive ? '#f6ead4' : '#f7d7d7', color: hasActive ? '#b5770c' : '#b42318', fontSize: '0.72rem', fontWeight: 700 }}>
                      {activeLabel}
                    </Box>
                  </Stack>
                  <Typography sx={{ color: '#8a8175', maxWidth: 560, mb: 1.3 }}>
                    {hasActive
                      ? t('subscription.activeDesc')
                      : t('subscription.inactiveDesc')}
                  </Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ color: '#6a665f', fontSize: '0.9rem' }}>
                    <Typography>
                      {subscription?.cancel_at_period_end
                        ? <>{t('subscription.expiresOn')} <b>{formatDate(subscription?.current_period_end, locale)}</b> <span style={{ color: '#e65100', fontWeight: 700 }}>({t('subscription.cancellationScheduled')})</span></>
                        : <>{t('subscription.renewsOn')} <b>{formatDate(subscription?.current_period_end, locale)}</b></>}
                    </Typography>
                    <Typography>{isFamilyPlan ? t('subscription.profiles') : t('subscription.users')} <b>{usersLimit}</b></Typography>
                  </Stack>
                </Box>
              </Stack>
              <Box sx={{ minWidth: { xs: 0, md: 170 }, textAlign: { xs: 'left', md: 'right' }, borderLeft: { md: '1px solid #efefef' }, pl: { md: 3 }, width: { xs: '100%', md: 'auto' } }}>
                <Typography sx={{ color: '#9f9f9f', fontWeight: 700, fontSize: '0.75rem' }}>{t('subscription.nextPayment').toUpperCase()}</Typography>
                <Typography sx={{ fontSize: { xs: '1.65rem', md: '2.1rem' }, color: '#1f1f1f', fontWeight: 800, lineHeight: 1.1, overflowWrap: 'anywhere' }}>
                  {subscription ? formatDirectMoney(subscription.amount, subscription.currency || 'USD') : '-'}
                </Typography>
                <Typography sx={{ color: '#b5770c', fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer' }} onClick={() => navigate('/pricing')}>
                  {t('subscription.managePlan')}
                </Typography>
              </Box>
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.1} sx={{ mt: 2.4 }}>
              {/* "Renouveler" only shown for Flutterwave subs — Stripe handles renewals automatically */}
              {!isStripe && (
                <Button disabled={busy || !subscription} variant="contained" sx={{ bgcolor: '#f1a10a', textTransform: 'none', '&:hover': { bgcolor: '#d9900a' } }} onClick={() => runAction(() => subscriptionsService.renew(), t('subscription.renewalInitiated'))}>{t('subscription.renew')}</Button>
              )}
              {/* "Réactiver" — restores auto-renewal for Stripe / cancel-at-period-end for others */}
              <Button
                disabled={busy || !subscription?.cancel_at_period_end}
                variant="outlined"
                sx={{ textTransform: 'none' }}
                onClick={() => runAction(
                  () => isStripe ? subscriptionsService.reactivate() : subscriptionsService.resume(),
                  t('subscription.autoRenewalRestored')
                )}
              >
                {t('subscription.reactivate')}
              </Button>
              <Button disabled={busy || !subscription} variant="outlined" color="warning" sx={{ textTransform: 'none' }} onClick={() => runAction(() => subscriptionsService.cancel({ immediately: false }), t('subscription.cancelAtEndActivated'))}>{t('subscription.cancelAtEnd')}</Button>
              <Button disabled={busy || !subscription} variant="outlined" color="error" sx={{ textTransform: 'none' }} onClick={() => runAction(() => subscriptionsService.cancel({ immediately: true }), t('subscription.cancelledNow'))}>{t('subscription.cancelNow')}</Button>
            </Stack>
          </Paper>

          {/* Usage ring cards */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 2, mb: 2.5 }}>
            <RingCard title={t('subscription.textUnlocks')} value={`${textUsed}`} hint={`${textUsed} ${t('common.of')} ${textQuota} ${t('subscription.thisCycle')}`} pct={progressValue(textUsed, textQuota)} />
            <RingCard title={isFamilyPlan ? t('subscription.activeProfiles') : t('subscription.activeDevices')} value={`${Math.min(isFamilyPlan ? profileCount : activeMembersCount, usersLimit)}`} hint={isFamilyPlan ? `${profileCount} ${t('subscription.activeProfiles')} ${t('common.of')} ${usersLimit}` : `${activeMembersCount} ${t('subscription.activeMembers')} ${t('common.of')} ${usersLimit}`} pct={progressValue(isFamilyPlan ? profileCount : activeMembersCount, usersLimit)} />
            <RingCard title={t('subscription.bonusCredits')} value={`${bonusAvailableTotal}`} hint={t('subscription.bonusCreditsRemaining')} pct={progressValue(bonusAvailableTotal, Math.max(1, usageData.bonus_quota || bonusAvailableTotal || 1))} />
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1.4fr' }, gap: 2 }}>
            {/* Left panel */}
            <Stack spacing={2}>
              {/* Active perks */}
              <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, borderRadius: 4, border: '1px solid #ece7dd' }}>
                <Typography sx={{ fontWeight: 800, color: '#262626', mb: 2 }}>{t('subscription.activePerks')}</Typography>
                <Stack spacing={1.2}>
                  <Typography sx={{ color: '#4f4f4f' }}>- {t('subscription.discountPaidBooks')}: <b>{subscription?.plan_snapshot?.discountPercentPaidBooks || 30}%</b></Typography>
                  <Typography sx={{ color: '#4f4f4f' }}>- {t('subscription.textQuota')}: <b>{textQuota}</b></Typography>
                  <Typography sx={{ color: '#4f4f4f' }}>- {t('subscription.audioQuota')}: <b>{audioQuota}</b></Typography>
                  <Typography sx={{ color: '#4f4f4f' }}>- {t('subscription.bonusAvailable')}: <b>{bonusAvailableTotal}</b></Typography>
                  {isFamilyPlan ? (
                    <>
                      <Typography sx={{ color: '#4f4f4f' }}>- {t('subscription.activeProfiles')}: <b>{profileCount}</b></Typography>
                      <Typography sx={{ color: '#4f4f4f' }}>- {t('subscription.availableSeats')}: <b>{seatsRemaining}</b></Typography>
                    </>
                  ) : (
                    <Typography sx={{ color: '#4f4f4f' }}>- {t('subscription.activeDevicesCount')}: <b>{activeMembersCount}</b></Typography>
                  )}
                </Stack>
              </Paper>
            </Stack>

            {/* Right panel — invoices */}
            <Paper elevation={0} sx={{ borderRadius: 4, border: '1px solid #ece7dd', overflow: 'hidden', alignSelf: 'start' }}>
              <Box sx={{ p: { xs: 2, md: 2.5 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #efefef' }}>
                <Typography sx={{ fontWeight: 800, color: '#262626' }}>{t('subscription.billingHistory')}</Typography>
                <Typography sx={{ color: '#f1a10a', fontWeight: 700 }}>{t('landing.viewAll')}</Typography>
              </Box>
              <Box sx={{ display: { xs: 'block', sm: 'none' }, p: 1.5 }}>
                <Stack spacing={1}>
                  {(payments || []).slice(0, 8).map((p) => {
                    const ptLabel = {
                      subscription_initial: t('subscription.paymentTypeInitial'),
                      subscription_renewal: t('subscription.paymentTypeRenewal'),
                      extra_seat: t('subscription.paymentTypeExtraSeat'),
                      content_unlock: t('subscription.paymentTypeContentUnlock'),
                    }[p.metadata?.payment_type] || t('subscription.paymentTypeDefault');
                    const isBusy = Boolean(invoiceBusy[p.id]);
                    const canDownload = p.status === 'succeeded';
                    return (
                      <Paper key={p.id} variant="outlined" sx={{ p: 1.5, borderRadius: 3, borderColor: '#ece7dd' }}>
                        <Stack spacing={0.5}>
                          <Typography sx={{ fontSize: '0.76rem', fontWeight: 700, color: '#8a8175', textTransform: 'uppercase' }}>
                            {formatDate(p.paid_at || p.created_at, locale)}
                          </Typography>
                          <Typography sx={{ fontWeight: 700, fontSize: '0.92rem', color: '#2d2d2d' }}>{ptLabel}</Typography>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography sx={{ fontSize: '0.9rem', color: '#3d3d3d' }}>{formatDirectMoney(p.amount, p.currency || 'USD')}</Typography>
                            <Button
                              size="small"
                              variant="text"
                              disabled={!canDownload || isBusy}
                              onClick={canDownload ? () => handleDownloadInvoice(p.id) : undefined}
                              sx={{ textTransform: 'none', minWidth: 0, px: 0.5 }}
                            >
                              {isBusy ? <CircularProgress size={14} /> : t('subscription.invoice')}
                            </Button>
                          </Stack>
                        </Stack>
                      </Paper>
                    );
                  })}
                  {payments.length === 0 && (
                    <Typography sx={{ color: '#8c8c8c', px: 0.5 }}>{t('subscription.noPaymentsYet')}</Typography>
                  )}
                </Stack>
              </Box>
              <Box sx={{ overflowX: 'auto', display: { xs: 'none', sm: 'block' } }}>
                <Box sx={{ minWidth: 500 }}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1.2fr 1.4fr 1fr 0.6fr', px: 2.5, py: 1.3, bgcolor: '#fafafa', color: '#7f7f7f', fontSize: '0.78rem', fontWeight: 700 }}>
                    <Box>{t('subscription.dateHeader')}</Box>
                    <Box>{t('subscription.descriptionHeader')}</Box>
                    <Box>{t('subscription.amountHeader')}</Box>
                    <Box>{t('subscription.invoiceHeader')}</Box>
                  </Box>
                  {(payments || []).slice(0, 8).map((p) => {
                    const ptLabel = {
                      subscription_initial: t('subscription.paymentTypeInitial'),
                      subscription_renewal: t('subscription.paymentTypeRenewal'),
                      extra_seat: t('subscription.paymentTypeExtraSeat'),
                      content_unlock: t('subscription.paymentTypeContentUnlock'),
                    }[p.metadata?.payment_type] || t('subscription.paymentTypeDefault');
                    const isBusy = Boolean(invoiceBusy[p.id]);
                    const canDownload = p.status === 'succeeded';
                    return (
                      <Box key={p.id} sx={{ display: 'grid', gridTemplateColumns: '1.2fr 1.4fr 1fr 0.6fr', px: 2.5, py: 1.5, borderTop: '1px solid #f1f1f1', alignItems: 'center' }}>
                        <Typography sx={{ color: '#565656', fontSize: '0.9rem' }}>{formatDate(p.paid_at || p.created_at, locale)}</Typography>
                        <Typography sx={{ color: '#3d3d3d', fontSize: '0.9rem' }}>{ptLabel}</Typography>
                        <Typography sx={{ color: '#3d3d3d', fontSize: '0.9rem' }}>{formatDirectMoney(p.amount, p.currency || 'USD')}</Typography>
                        <Tooltip title={canDownload ? t('subscription.downloadInvoice') : t('subscription.paymentPending')} placement="top">
                          <Box
                            component="span"
                            sx={{
                              display: 'inline-flex',
                              cursor: canDownload ? 'pointer' : 'default',
                              opacity: canDownload ? 1 : 0.35,
                              '&:hover': canDownload ? { color: tokens.colors.primary } : {},
                            }}
                            onClick={canDownload ? () => handleDownloadInvoice(p.id) : undefined}
                          >
                            {isBusy
                              ? <CircularProgress size={16} sx={{ color: tokens.colors.primary }} />
                              : <Download size={16} color="#8c8c8c" />}
                          </Box>
                        </Tooltip>
                      </Box>
                    );
                  })}
                  {payments.length === 0 && (
                    <Box sx={{ px: 2.5, py: 2.5 }}>
                      <Typography sx={{ color: '#8c8c8c' }}>{t('subscription.noPaymentsYet')}</Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            </Paper>
          </Box>

          {/* Family management — full width to avoid squeezed cards */}
          {isFamilyPlan && (
            <Stack spacing={2} sx={{ mt: 2 }}>
              <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, borderRadius: 4, border: '1px solid #ece7dd' }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', sm: 'center' }} sx={{ mb: 2.5 }}>
                  <Users size={18} color="#f1a10a" />
                  <Typography sx={{ fontWeight: 800, color: '#262626', fontSize: '1rem' }}>
                    {t('subscription.familyTitle')} · {profileCount}/{usersLimit} {t('subscription.profiles')}
                  </Typography>
                  {seatsRemaining > 0 ? (
                    <Chip label={seatsRemaining > 1 ? t('subscription.seatsAvailablePlural', { count: seatsRemaining }) : t('subscription.seatsAvailable', { count: seatsRemaining })} size="small" sx={{ height: 20, fontSize: '0.7rem', bgcolor: '#e8f5e9', color: '#2e7d32', fontWeight: 700, ml: { sm: 'auto !important' } }} />
                  ) : (
                    <Chip label={t('subscription.seatsFull')} size="small" sx={{ height: 20, fontSize: '0.7rem', bgcolor: '#fff3e0', color: '#e65100', fontWeight: 700, ml: { sm: 'auto !important' } }} />
                  )}
                </Stack>

                {isOwner && (
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, borderColor: '#ece7dd', bgcolor: '#fafafa' }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1.2}>
                      <Box>
                        <Typography sx={{ fontWeight: 700, color: '#333', fontSize: '0.9rem' }}>
                          {usersLimit > 1 ? t('subscription.profilesAvailableCountPlural', { count: usersLimit }) : t('subscription.profilesAvailableCount', { count: usersLimit })}
                        </Typography>
                        <Typography sx={{ color: '#999', fontSize: '0.8rem' }}>
                          {t('subscription.profilesIncluded', { min: minFamilyMembers, price: formatLocalPrice(extraUserPriceCents) })}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography sx={{ fontWeight: 800, fontSize: '1.3rem', minWidth: 32, textAlign: 'center', color: '#1f1f1f' }}>
                          {usersLimit}
                        </Typography>
                        <Tooltip title={t('subscription.addProfileTooltip', { price: formatLocalPrice(extraUserPriceCents) })}>
                          <span>
                            <IconButton
                              size="small"
                              aria-label={t('subscription.addProfileTooltip', { price: formatLocalPrice(extraUserPriceCents) })}
                              disabled={busy || usersLimit >= MAX_FAMILY_SEATS}
                              onClick={() => setSeatDialog({ open: true, providerBusy: '' })}
                              sx={{ border: '1px solid #f1a10a', bgcolor: '#fff9ec', color: '#b87c00', '&:hover': { bgcolor: '#f6ead4' } }}
                            >
                              <Plus size={14} />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Stack>
                    </Stack>
                  </Paper>
                )}
              </Paper>

              <FamilyProfilesManager
                onProfileChange={(profile) => setFamilySummary((prev) => (prev ? { ...prev, activeProfile: profile } : prev))}
                onSummaryChange={setFamilySummary}
              />
            </Stack>
          )}
        </Box>
      </Box>

      {/* Extra seat payment dialog */}
      <Dialog
        open={seatDialog.open}
        onClose={closeSeatDialog}
        PaperProps={{ sx: { borderRadius: 4, p: 0.5, maxWidth: 420, width: '100%' } }}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1.1rem', pb: 0.5, color: '#1f1f1f' }}>
          {t('subscription.addSeatTitle')}
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#888', mb: 0.5, fontSize: '0.92rem' }}>
            {usersLimit} → <b>{usersLimit + 1} {t('subscription.seats')}</b>
          </Typography>
          <Typography sx={{ color: '#b5770c', fontWeight: 700, fontSize: '1rem', mb: 2.5 }}>
            +{formatLocalPrice(extraUserPriceCents)} {t('common.per_month')}
          </Typography>
          <Stack spacing={1.5}>
            <Button
              fullWidth
              variant="outlined"
              disabled={Boolean(seatDialog.providerBusy)}
              onClick={() => doBuyExtraSeat('stripe')}
              sx={{
                borderRadius: 3, p: 2, textTransform: 'none', borderColor: '#5469d4',
                justifyContent: 'flex-start', gap: 2,
                '&:hover': { bgcolor: '#f0f1ff', borderColor: '#4556c4' },
              }}
            >
              {seatDialog.providerBusy === 'stripe'
                ? <CircularProgress size={22} sx={{ color: '#5469d4', flexShrink: 0 }} />
                : <Box component="span" sx={{ fontSize: '1.5rem', lineHeight: 1, flexShrink: 0 }}>💳</Box>
              }
              <Stack alignItems="flex-start" spacing={0.2} sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: '#5469d4' }}>{t('subscription.creditCard')}</Typography>
                <Typography sx={{ fontSize: '0.78rem', color: '#888' }}>{t('subscription.creditCardDesc')}</Typography>
              </Stack>
            </Button>

            <Button
              fullWidth
              variant="outlined"
              disabled={Boolean(seatDialog.providerBusy)}
              onClick={() => doBuyExtraSeat('flutterwave')}
              sx={{
                borderRadius: 3, p: 2, textTransform: 'none', borderColor: '#f9a825',
                justifyContent: 'flex-start', gap: 2,
                '&:hover': { bgcolor: '#fff8e1', borderColor: '#f9a825' },
              }}
            >
              {seatDialog.providerBusy === 'flutterwave'
                ? <CircularProgress size={22} sx={{ color: '#f9a825', flexShrink: 0 }} />
                : <Box component="span" sx={{ fontSize: '1.5rem', lineHeight: 1, flexShrink: 0 }}>📱</Box>
              }
              <Stack alignItems="flex-start" spacing={0.2} sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: '#e65100' }}>{t('pricing.mobileMoney')}</Typography>
                <Typography sx={{ fontSize: '0.78rem', color: '#888' }}>{t('subscription.mobileMoneyDesc')}</Typography>
              </Stack>
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>
      <MobileBottomNav />
    </Box>
  );
}
