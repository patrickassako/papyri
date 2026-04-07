import React, { useEffect, useMemo, useState } from 'react';
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
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
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
import tokens from '../config/tokens';
import * as authService from '../services/auth.service';
import UserSpaceSidebar from '../components/UserSpaceSidebar';
import MobileBottomNav from '../components/MobileBottomNav';
import { useCurrency } from '../hooks/useCurrency';
import { formatMinorUnits } from '../services/currency.service';

function formatDate(iso) {
  if (!iso) return '-';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
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
  const { formatPrice: formatLocalPrice } = useCurrency();
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

  const [changePlanId, setChangePlanId] = useState('');
  const [changeUsersLimit, setChangeUsersLimit] = useState(1);

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

  const availablePlanOptions = useMemo(() => {
    const currentPlanId = subscription?.plan_id || subscription?.plan_snapshot?.id;
    return plans.filter((p) => p.id !== currentPlanId);
  }, [plans, subscription]);

  const bonusAvailableTotal = bonuses.reduce((sum, item) => sum + Number(item.available || 0), 0);
  const activeMembersCount = members.filter((m) => m.status === 'active').length;
  const usersLimit = Number(subscription?.users_limit || 1);
  const seatsRemaining = Math.max(0, usersLimit - activeMembersCount);
  const isOwner = memberRole === 'owner';

  // Detect family plan
  const planCode = (subscription?.plan_snapshot?.planCode || subscription?.plan_type || '').toLowerCase();
  const isFamilyPlan = planCode.includes('family');
  const currentPlan = plans.find((p) => p.id === subscription?.plan_id);
  const extraUserPriceCents = currentPlan?.extraUserPriceCents || 600;
  const minFamilyMembers = currentPlan?.includedUsers || 3;
  const formatDirectMoney = (cents, currency = 'EUR') => formatMinorUnits(cents, currency);

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
        setChangeUsersLimit(Number(myStatus.value?.subscription?.users_limit || 1));
      } else {
        throw new Error(myStatus.reason?.message || 'Impossible de charger le statut abonnement.');
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
      setError(err.message || 'Erreur de chargement.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openPaymentLink = (paymentLink) => {
    if (!paymentLink) { setError('Lien de paiement indisponible.'); return; }
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
      setError(err.message || 'Action impossible.');
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
      const msg = String(err?.message || 'Action membre impossible.');
      if (msg.includes('users_limit reached')) {
        setError('Limite de sièges atteinte. Ajoutez une place supplémentaire d\'abord.');
      } else if (msg.includes('already a member')) {
        setError('Cet utilisateur est déjà membre de cet abonnement.');
      } else if (msg.includes('Only subscription owner')) {
        setError('Seul le propriétaire peut gérer les membres.');
      } else if (msg.includes('Active member not found')) {
        setError('Membre introuvable ou déjà retiré.');
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
      setError('Lien de paiement indisponible.');
    } catch (err) {
      setError(err.message || 'Erreur lors de l\'achat du siège.');
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
      setError(err.message || 'Erreur lors du téléchargement de la facture.');
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
      setLookupError(err.message || 'Utilisateur introuvable.');
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
  const activeLabel = hasActive ? 'ACTIVE' : 'INACTIVE';
  const subscriptionLabel = hasActive
    ? `${subscription?.plan_snapshot?.name || subscription?.plan_type || 'Abonnement'} actif`
    : 'Aucun abonnement actif';

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5', display: 'flex' }}>
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
                Aperçu de votre abonnement
              </Typography>
              <Typography sx={{ color: '#918a80' }}>Gérez votre plan, suivez votre utilisation et consultez l'historique de facturation.</Typography>
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} sx={{ width: { xs: '100%', md: 'auto' } }}>
              <Button variant="outlined" sx={{ borderColor: '#d7d7d7', color: '#555', textTransform: 'none', borderRadius: 3, width: { xs: '100%', sm: 'auto' } }} onClick={loadData}>
                Actualiser
              </Button>
              <Button variant="contained" sx={{ bgcolor: '#f1a10a', textTransform: 'none', borderRadius: 3, width: { xs: '100%', sm: 'auto' }, '&:hover': { bgcolor: '#d9900a' } }} onClick={() => navigate('/pricing')}>
                Changer de plan
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
              { label: 'Plan', value: hasActive ? 'Actif' : 'Inactif' },
              { label: 'Sieges', value: `${activeMembersCount}/${usersLimit}` },
              { label: 'Bonus', value: `${bonusAvailableTotal}` },
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
                      {subscription?.plan_snapshot?.name || subscription?.plan_type || 'Aucun plan'}
                    </Typography>
                    <Box sx={{ px: 1.1, py: 0.2, borderRadius: 99, bgcolor: hasActive ? '#f6ead4' : '#f7d7d7', color: hasActive ? '#b5770c' : '#b42318', fontSize: '0.72rem', fontWeight: 700 }}>
                      {activeLabel}
                    </Box>
                  </Stack>
                  <Typography sx={{ color: '#8a8175', maxWidth: 560, mb: 1.3 }}>
                    {hasActive
                      ? 'Votre abonnement est actif. Gérez les actions de cycle, sièges et paiements depuis ce tableau.'
                      : 'Abonnement inactif ou expiré. Reprenez un plan pour réactiver tous les accès.'}
                  </Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ color: '#6a665f', fontSize: '0.9rem' }}>
                    <Typography>
                      {subscription?.cancel_at_period_end
                        ? <>Expire le <b>{formatDate(subscription?.current_period_end)}</b> <span style={{ color: '#e65100', fontWeight: 700 }}>(annulation programmée)</span></>
                        : <>Renouvellement le <b>{formatDate(subscription?.current_period_end)}</b></>}
                    </Typography>
                    <Typography>Utilisateurs <b>{usersLimit}</b></Typography>
                  </Stack>
                </Box>
              </Stack>
              <Box sx={{ minWidth: { md: 170 }, textAlign: { xs: 'left', md: 'right' }, borderLeft: { md: '1px solid #efefef' }, pl: { md: 3 } }}>
                <Typography sx={{ color: '#9f9f9f', fontWeight: 700, fontSize: '0.75rem' }}>PROCHAIN PAIEMENT</Typography>
                <Typography sx={{ fontSize: '2.1rem', color: '#1f1f1f', fontWeight: 800, lineHeight: 1.1 }}>
                  {subscription ? formatDirectMoney(subscription.amount, subscription.currency || 'USD') : '-'}
                </Typography>
                <Typography sx={{ color: '#b5770c', fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer' }} onClick={() => navigate('/pricing')}>
                  Gérer mon plan
                </Typography>
              </Box>
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.1} sx={{ mt: 2.4 }}>
              {/* "Renouveler" only shown for Flutterwave subs — Stripe handles renewals automatically */}
              {!isStripe && (
                <Button disabled={busy || !subscription} variant="contained" sx={{ bgcolor: '#f1a10a', textTransform: 'none', '&:hover': { bgcolor: '#d9900a' } }} onClick={() => runAction(() => subscriptionsService.renew(), 'Renouvellement initié, redirection paiement.')}>Renouveler</Button>
              )}
              {/* "Réactiver" — restores auto-renewal for Stripe / cancel-at-period-end for others */}
              <Button
                disabled={busy || !subscription?.cancel_at_period_end}
                variant="outlined"
                sx={{ textTransform: 'none' }}
                onClick={() => runAction(
                  () => isStripe ? subscriptionsService.reactivate() : subscriptionsService.resume(),
                  'Renouvellement automatique rétabli.'
                )}
              >
                Réactiver
              </Button>
              <Button disabled={busy || !subscription} variant="outlined" color="warning" sx={{ textTransform: 'none' }} onClick={() => runAction(() => subscriptionsService.cancel({ immediately: false }), 'Annulation en fin de période activée.')}>Annuler fin période</Button>
              <Button disabled={busy || !subscription} variant="outlined" color="error" sx={{ textTransform: 'none' }} onClick={() => runAction(() => subscriptionsService.cancel({ immediately: true }), 'Abonnement annulé immédiatement.')}>Annuler maintenant</Button>
            </Stack>
          </Paper>

          {/* Usage ring cards */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 2, mb: 2.5 }}>
            <RingCard title="Déblocages texte" value={`${textUsed}`} hint={`${textUsed} sur ${textQuota} ce cycle`} pct={progressValue(textUsed, textQuota)} />
            <RingCard title="Appareils actifs" value={`${Math.min(activeMembersCount, usersLimit)}`} hint={`${activeMembersCount} membres actifs sur ${usersLimit}`} pct={progressValue(activeMembersCount, usersLimit)} />
            <RingCard title="Crédits bonus" value={`${bonusAvailableTotal}`} hint="Crédits bonus restants" pct={progressValue(bonusAvailableTotal, Math.max(1, usageData.bonus_quota || bonusAvailableTotal || 1))} />
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1.4fr' }, gap: 2 }}>
            {/* Left panel */}
            <Stack spacing={2}>
              {/* Active Perks + Change Plan */}
              <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, borderRadius: 4, border: '1px solid #ece7dd' }}>
                <Typography sx={{ fontWeight: 800, color: '#262626', mb: 2 }}>Avantages actifs</Typography>
                <Stack spacing={1.2}>
                  <Typography sx={{ color: '#4f4f4f' }}>- Réduction livres payants: <b>{subscription?.plan_snapshot?.discountPercentPaidBooks || 30}%</b></Typography>
                  <Typography sx={{ color: '#4f4f4f' }}>- Quota texte: <b>{textQuota}</b></Typography>
                  <Typography sx={{ color: '#4f4f4f' }}>- Quota audio: <b>{audioQuota}</b></Typography>
                  <Typography sx={{ color: '#4f4f4f' }}>- Bonus disponibles: <b>{bonusAvailableTotal}</b></Typography>
                  <Typography sx={{ color: '#4f4f4f' }}>- Membres actifs: <b>{activeMembersCount}</b></Typography>
                  <Typography sx={{ color: '#4f4f4f' }}>- Places restantes: <b>{seatsRemaining}</b></Typography>
                </Stack>

                <Divider sx={{ my: 2 }} />

                <Typography sx={{ fontWeight: 700, color: '#444', fontSize: '0.88rem', mb: 1.5 }}>Changer de plan</Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} alignItems={{ sm: 'flex-end' }}>
                  <TextField
                    select
                    size="small"
                    label="Nouveau plan"
                    value={changePlanId}
                    onChange={(e) => setChangePlanId(e.target.value)}
                    sx={{ minWidth: { sm: 200 }, flex: 1 }}
                  >
                    {availablePlanOptions.map((plan) => (
                      <MenuItem key={plan.id} value={plan.id}>
                        {plan.name} ({formatLocalPrice(plan.basePriceCents || 0)})
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    type="number"
                    size="small"
                    label="Utilisateurs"
                    value={changeUsersLimit}
                    onChange={(e) => setChangeUsersLimit(Math.max(1, Number(e.target.value || 1)))}
                    sx={{ width: 110 }}
                  />
                  <Button
                    disabled={busy || !changePlanId}
                    variant="contained"
                    sx={{ bgcolor: '#f1a10a', textTransform: 'none', '&:hover': { bgcolor: '#d9900a' }, whiteSpace: 'nowrap' }}
                    onClick={() => runAction(() => subscriptionsService.changePlan({ planId: changePlanId, usersLimit: changeUsersLimit }), 'Changement de plan programmé.')}
                  >
                    Programmer
                  </Button>
                </Stack>
              </Paper>

              {/* Family management — only when family plan */}
              {isFamilyPlan && (
                <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, borderRadius: 4, border: '1px solid #ece7dd' }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2.5 }}>
                    <Users size={18} color="#f1a10a" />
                    <Typography sx={{ fontWeight: 800, color: '#262626', fontSize: '1rem' }}>
                      Famille · {activeMembersCount}/{usersLimit} sièges
                    </Typography>
                    {seatsRemaining > 0 && (
                      <Chip label={`${seatsRemaining} libre${seatsRemaining > 1 ? 's' : ''}`} size="small" sx={{ height: 20, fontSize: '0.7rem', bgcolor: '#e8f5e9', color: '#2e7d32', fontWeight: 700, ml: 'auto !important' }} />
                    )}
                    {seatsRemaining === 0 && (
                      <Chip label="Complet" size="small" sx={{ height: 20, fontSize: '0.7rem', bgcolor: '#fff3e0', color: '#e65100', fontWeight: 700, ml: 'auto !important' }} />
                    )}
                  </Stack>

                  {/* Seat management */}
                  {isOwner && (
                    <>
                      <Typography sx={{ fontWeight: 700, color: '#444', fontSize: '0.88rem', mb: 1 }}>Places</Typography>
                      <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, mb: 2.5, borderColor: '#ece7dd', bgcolor: '#fafafa' }}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1.2}>
                          <Box>
                            <Typography sx={{ fontWeight: 700, color: '#333', fontSize: '0.9rem' }}>
                              {usersLimit} place{usersLimit > 1 ? 's' : ''} au total
                            </Typography>
                            <Typography sx={{ color: '#999', fontSize: '0.8rem' }}>
                              +{formatLocalPrice(extraUserPriceCents)}/place supplémentaire/mois
                            </Typography>
                          </Box>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography sx={{ fontWeight: 800, fontSize: '1.3rem', minWidth: 32, textAlign: 'center', color: '#1f1f1f' }}>
                              {usersLimit}
                            </Typography>
                            <Tooltip title={`Ajouter une place — ${formatLocalPrice(extraUserPriceCents)}/mois`}>
                              <span>
                                <IconButton
                                  size="small"
                                  aria-label="Ajouter une place"
                                  disabled={busy}
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

                      {/* Add member by email */}
                      <Typography sx={{ fontWeight: 700, color: '#444', fontSize: '0.88rem', mb: 1 }}>Ajouter un membre</Typography>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 1 }}>
                        <TextField
                          size="small"
                          placeholder="adresse@email.com"
                          value={lookupEmail}
                          onChange={(e) => { setLookupEmail(e.target.value); setLookupUser(null); setLookupError(''); }}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleLookupUser(); }}
                          sx={{ flex: 1 }}
                          disabled={seatsRemaining <= 0}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <Search size={15} color="#bbb" />
                              </InputAdornment>
                            ),
                          }}
                        />
                        <Button
                          variant="outlined"
                          disabled={lookupBusy || !lookupEmail.trim() || seatsRemaining <= 0}
                          onClick={handleLookupUser}
                          sx={{ textTransform: 'none', minWidth: 110, borderColor: '#d0d0d0', color: '#555' }}
                        >
                          {lookupBusy ? <CircularProgress size={16} /> : 'Rechercher'}
                        </Button>
                      </Stack>

                      {seatsRemaining <= 0 && (
                        <Typography sx={{ color: '#e65100', fontSize: '0.82rem', mb: 1 }}>
                          Aucune place disponible. Ajoutez un siège via le bouton <b>+</b> ci-dessus.
                        </Typography>
                      )}

                      {lookupError && (
                        <Typography sx={{ color: '#d32f2f', fontSize: '0.82rem', mb: 1 }}>{lookupError}</Typography>
                      )}

                      {lookupUser && (
                        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2.5, mb: 2, borderColor: '#c8e6c9', bgcolor: '#f1f8f1' }}>
                          <Stack direction="row" alignItems="center" spacing={1.5}>
                            <Avatar
                              src={lookupUser.avatar_url || undefined}
                              sx={{ width: 38, height: 38, bgcolor: '#f1a10a', fontSize: '0.95rem', color: '#fff', fontWeight: 700 }}
                            >
                              {(lookupUser.full_name?.[0] || lookupUser.email?.[0] || '?').toUpperCase()}
                            </Avatar>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: '#2d2d2d' }} noWrap>
                                {lookupUser.full_name || 'Utilisateur'}
                              </Typography>
                              <Typography sx={{ fontSize: '0.8rem', color: '#777' }} noWrap>{lookupUser.email}</Typography>
                            </Box>
                            <Button
                              variant="contained"
                              size="small"
                              startIcon={busy ? <CircularProgress size={14} color="inherit" /> : <UserCheck size={14} />}
                              disabled={busy}
                              onClick={async () => {
                                await runMemberAction(
                                  () => subscriptionsService.addMember(lookupUser.id),
                                  `${lookupUser.full_name || lookupUser.email} ajouté à la famille.`
                                );
                                setLookupEmail('');
                                setLookupUser(null);
                              }}
                              sx={{ bgcolor: '#388e3c', textTransform: 'none', flexShrink: 0, '&:hover': { bgcolor: '#2e7d32' } }}
                            >
                              Ajouter
                            </Button>
                          </Stack>
                        </Paper>
                      )}

                      <Divider sx={{ mb: 2 }} />
                    </>
                  )}

                  {/* Members list */}
                  <Typography sx={{ fontWeight: 700, color: '#888', fontSize: '0.75rem', mb: 1.2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Membres actifs
                  </Typography>
                  <Stack spacing={0.8}>
                    {members.filter((m) => m.status === 'active').map((m, i) => {
                      const isOwnerMember = m.role === 'owner' || m.user_id === subscription?.user_id;
                      const displayName = isOwnerMember
                        ? (user?.full_name || 'Vous (Propriétaire)')
                        : `Membre #${i}`;
                      const initials = displayName.trim().split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

                      return (
                        <Stack
                          key={m.id || m.user_id}
                          direction="row"
                          alignItems="center"
                          spacing={1.5}
                          sx={{
                            px: 1.5,
                            py: 1,
                            border: '1px solid',
                            borderColor: isOwnerMember ? '#f6ead4' : '#f0f0f0',
                            borderRadius: 2.5,
                            bgcolor: isOwnerMember ? '#fffbf2' : '#fff',
                          }}
                        >
                          <Avatar
                            sx={{
                              width: 34,
                              height: 34,
                              bgcolor: isOwnerMember ? '#f1a10a' : '#e8e8e8',
                              fontSize: '0.82rem',
                              fontWeight: 700,
                              color: isOwnerMember ? '#fff' : '#666',
                              flexShrink: 0,
                            }}
                          >
                            {initials}
                          </Avatar>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Stack direction="row" spacing={0.8} alignItems="center">
                              <Typography sx={{ fontWeight: 700, fontSize: '0.88rem', color: '#2d2d2d' }} noWrap>
                                {displayName}
                              </Typography>
                              {isOwnerMember && (
                                <Chip label="Propriétaire" size="small" sx={{ height: 18, fontSize: '0.66rem', bgcolor: '#f6ead4', color: '#b5770c', fontWeight: 700 }} />
                              )}
                            </Stack>
                            <Typography sx={{ fontSize: '0.77rem', color: '#bbb' }}>
                              Rejoint le {formatDate(m.joined_at)}
                            </Typography>
                          </Box>
                          {isOwner && !isOwnerMember && (
                            <Tooltip title="Retirer ce membre">
                              <IconButton
                                size="small"
                                aria-label="Retirer ce membre"
                                disabled={busy}
                                onClick={() => runMemberAction(() => subscriptionsService.removeMember(m.user_id), 'Membre retiré.')}
                                sx={{ color: '#ccc', '&:hover': { color: '#d32f2f' } }}
                              >
                                <Trash2 size={15} />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Stack>
                      );
                    })}
                    {members.filter((m) => m.status === 'active').length === 0 && (
                      <Typography sx={{ color: '#bbb', fontSize: '0.86rem' }}>Aucun membre actif.</Typography>
                    )}
                  </Stack>

                  {!isOwner && (
                    <Typography sx={{ color: '#aaa', fontSize: '0.82rem', mt: 1.5 }}>
                      Seul le propriétaire peut ajouter ou retirer des membres.
                    </Typography>
                  )}
                </Paper>
              )}
            </Stack>

            {/* Right panel — invoices */}
            <Paper elevation={0} sx={{ borderRadius: 4, border: '1px solid #ece7dd', overflow: 'hidden', alignSelf: 'start' }}>
              <Box sx={{ p: { xs: 2, md: 2.5 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #efefef' }}>
                <Typography sx={{ fontWeight: 800, color: '#262626' }}>Historique de facturation</Typography>
                <Typography sx={{ color: '#f1a10a', fontWeight: 700 }}>Tout voir</Typography>
              </Box>
              <Box sx={{ display: { xs: 'block', sm: 'none' }, p: 1.5 }}>
                <Stack spacing={1}>
                  {(payments || []).slice(0, 8).map((p) => {
                    const ptLabel = {
                      subscription_initial: 'Souscription',
                      subscription_renewal: 'Renouvellement',
                      extra_seat: 'Place supplémentaire',
                      content_unlock: 'Achat contenu',
                    }[p.metadata?.payment_type] || 'Abonnement';
                    const isBusy = Boolean(invoiceBusy[p.id]);
                    const canDownload = p.status === 'succeeded';
                    return (
                      <Paper key={p.id} variant="outlined" sx={{ p: 1.5, borderRadius: 3, borderColor: '#ece7dd' }}>
                        <Stack spacing={0.5}>
                          <Typography sx={{ fontSize: '0.76rem', fontWeight: 700, color: '#8a8175', textTransform: 'uppercase' }}>
                            {formatDate(p.paid_at || p.created_at)}
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
                              {isBusy ? <CircularProgress size={14} /> : 'Facture'}
                            </Button>
                          </Stack>
                        </Stack>
                      </Paper>
                    );
                  })}
                  {payments.length === 0 && (
                    <Typography sx={{ color: '#8c8c8c', px: 0.5 }}>Aucun paiement pour le moment.</Typography>
                  )}
                </Stack>
              </Box>
              <Box sx={{ overflowX: 'auto', display: { xs: 'none', sm: 'block' } }}>
                <Box sx={{ minWidth: 500 }}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1.2fr 1.4fr 1fr 0.6fr', px: 2.5, py: 1.3, bgcolor: '#fafafa', color: '#7f7f7f', fontSize: '0.78rem', fontWeight: 700 }}>
                    <Box>DATE</Box>
                    <Box>DESCRIPTION</Box>
                    <Box>AMOUNT</Box>
                    <Box>INVOICE</Box>
                  </Box>
                  {(payments || []).slice(0, 8).map((p) => {
                    const ptLabel = {
                      subscription_initial: 'Souscription',
                      subscription_renewal: 'Renouvellement',
                      extra_seat: 'Place supplémentaire',
                      content_unlock: 'Achat contenu',
                    }[p.metadata?.payment_type] || 'Abonnement';
                    const isBusy = Boolean(invoiceBusy[p.id]);
                    const canDownload = p.status === 'succeeded';
                    return (
                      <Box key={p.id} sx={{ display: 'grid', gridTemplateColumns: '1.2fr 1.4fr 1fr 0.6fr', px: 2.5, py: 1.5, borderTop: '1px solid #f1f1f1', alignItems: 'center' }}>
                        <Typography sx={{ color: '#565656', fontSize: '0.9rem' }}>{formatDate(p.paid_at || p.created_at)}</Typography>
                        <Typography sx={{ color: '#3d3d3d', fontSize: '0.9rem' }}>{ptLabel}</Typography>
                        <Typography sx={{ color: '#3d3d3d', fontSize: '0.9rem' }}>{formatDirectMoney(p.amount, p.currency || 'USD')}</Typography>
                        <Tooltip title={canDownload ? 'Télécharger la facture' : 'Paiement en attente'} placement="top">
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
                      <Typography sx={{ color: '#8c8c8c' }}>Aucun paiement pour le moment.</Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            </Paper>
          </Box>
        </Box>
      </Box>

      {/* Extra seat payment dialog */}
      <Dialog
        open={seatDialog.open}
        onClose={closeSeatDialog}
        PaperProps={{ sx: { borderRadius: 4, p: 0.5, maxWidth: 420, width: '100%' } }}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1.1rem', pb: 0.5, color: '#1f1f1f' }}>
          Ajouter une place à votre abonnement
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#888', mb: 0.5, fontSize: '0.92rem' }}>
            {usersLimit} → <b>{usersLimit + 1} places</b>
          </Typography>
          <Typography sx={{ color: '#b5770c', fontWeight: 700, fontSize: '1rem', mb: 2.5 }}>
            +{formatLocalPrice(extraUserPriceCents)} / mois
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
                <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: '#5469d4' }}>Carte bancaire</Typography>
                <Typography sx={{ fontSize: '0.78rem', color: '#888' }}>Visa, Mastercard · sécurisé par Stripe</Typography>
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
                <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: '#e65100' }}>Mobile Money</Typography>
                <Typography sx={{ fontSize: '0.78rem', color: '#888' }}>MTN, Orange, Wave · via Flutterwave</Typography>
              </Stack>
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>
      <MobileBottomNav />
    </Box>
  );
}
