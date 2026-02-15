import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  BadgeCheck,
  Bookmark,
  CreditCard,
  Download,
  LayoutDashboard,
  Trash2,
  UserPlus,
  Search,
  Settings,
  Users,
} from 'lucide-react';
import { subscriptionsService } from '../services/subscriptions.service';
import * as authService from '../services/auth.service';

function formatMoney(amount, currency = 'USD') {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(Number(amount || 0));
}

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
        p: 3,
        borderRadius: 4,
        border: '1px solid #ece7dd',
        background: '#ffffff',
        minHeight: 220,
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
            <Typography sx={{ fontWeight: 800, fontSize: '1.9rem', color: '#1e1e1e' }}>{value}</Typography>
          </Box>
        </Box>
      </Box>
      <Typography sx={{ color: '#8a8175', fontSize: '0.83rem', textAlign: 'center' }}>{hint}</Typography>
    </Paper>
  );
}

export default function SubscriptionPage() {
  const navigate = useNavigate();
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
  const [usersLimitInput, setUsersLimitInput] = useState(1);
  const [memberUserIdInput, setMemberUserIdInput] = useState('');

  const hasActive = Boolean(status?.isActive);
  const subscription = status?.subscription || null;

  const availablePlanOptions = useMemo(() => {
    const currentPlanId = subscription?.plan_id || subscription?.plan_snapshot?.id;
    return plans.filter((p) => p.id !== currentPlanId);
  }, [plans, subscription]);

  const bonusAvailableTotal = bonuses.reduce((sum, item) => sum + Number(item.available || 0), 0);
  const activeMembersCount = members.filter((m) => m.status === 'active').length;
  const seatsRemaining = Math.max(0, Number(subscription?.users_limit || 1) - activeMembersCount);
  const isOwner = memberRole === 'owner';

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
        setUsersLimitInput(Number(myStatus.value?.subscription?.users_limit || 1));
        setChangeUsersLimit(Number(myStatus.value?.subscription?.users_limit || 1));
      } else {
        throw new Error(myStatus.reason?.message || 'Impossible de charger le statut abonnement.');
      }

      if (allPlans.status === 'fulfilled') {
        setPlans(allPlans.value || []);
      }
      if (usageResult.status === 'fulfilled') {
        setUsage(usageResult.value?.data || null);
      } else {
        setUsage(null);
      }
      if (bonusesResult.status === 'fulfilled') {
        setBonuses(bonusesResult.value?.data || []);
      } else {
        setBonuses([]);
      }
      if (historyResult.status === 'fulfilled') {
        setPayments(historyResult.value?.payments || []);
      } else {
        setPayments([]);
      }
      if (membersResult.status === 'fulfilled') {
        setMembers(membersResult.value?.data?.members || []);
        setMemberRole(membersResult.value?.data?.member_role || null);
      } else {
        setMembers([]);
        setMemberRole(null);
      }
      if (userResult.status === 'fulfilled') {
        setUser(userResult.value || null);
      }
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
    if (!paymentLink) {
      setError('Lien de paiement indisponible.');
      return;
    }
    window.location.href = paymentLink;
  };

  const runAction = async (fn, successText) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await fn();
      if (result?.paymentLink) {
        openPaymentLink(result.paymentLink);
        return;
      }
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
        setError('Limite de sièges atteinte: augmentez users_limit ou retirez un membre.');
      } else if (msg.includes('already a member')) {
        setError('Cet utilisateur est déjà membre de cet abonnement.');
      } else if (msg.includes('Only subscription owner')) {
        setError('Seul le propriétaire de l’abonnement peut gérer les membres.');
      } else if (msg.includes('Active member not found')) {
        setError('Membre introuvable ou déjà retiré.');
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
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
  const usersLimit = Number(subscription?.users_limit || 1);
  const activeLabel = hasActive ? 'ACTIVE' : 'INACTIVE';

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5', display: 'flex' }}>
      <Box
        component="aside"
        sx={{
          width: 240,
          bgcolor: '#fff',
          borderRight: '1px solid #e8e8e8',
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
        }}
      >
        <Box sx={{ p: 3.2, display: 'flex', alignItems: 'center', gap: 1.4 }}>
          <Box
            sx={{
              width: 34,
              height: 34,
              borderRadius: 1.3,
              bgcolor: '#f1a10a',
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 700,
            }}
          >
            L
          </Box>
          <Typography sx={{ fontWeight: 800, fontSize: '1.8rem', lineHeight: 1, letterSpacing: '-0.03em' }}>
            LuminaLib
          </Typography>
        </Box>

        <Stack sx={{ px: 1.4, gap: 0.3 }}>
          <Button startIcon={<LayoutDashboard size={17} />} sx={{ justifyContent: 'flex-start', color: '#595959', textTransform: 'none' }} onClick={() => navigate('/home')}>Library</Button>
          <Button startIcon={<Search size={17} />} sx={{ justifyContent: 'flex-start', color: '#595959', textTransform: 'none' }} onClick={() => navigate('/catalogue')}>Discover</Button>
          <Button startIcon={<Bookmark size={17} />} sx={{ justifyContent: 'flex-start', color: '#595959', textTransform: 'none' }}>Saved</Button>
          <Typography sx={{ px: 1.8, pt: 1.5, fontSize: '0.72rem', color: '#a1a1a1', fontWeight: 700 }}>ACCOUNT</Typography>
          <Button
            startIcon={<CreditCard size={17} />}
            sx={{
              justifyContent: 'flex-start',
              bgcolor: '#fdf1de',
              color: '#b6780b',
              textTransform: 'none',
              borderRadius: 3,
              '&:hover': { bgcolor: '#f8e6ca' },
            }}
          >
            Subscription
          </Button>
          <Button startIcon={<Settings size={17} />} sx={{ justifyContent: 'flex-start', color: '#595959', textTransform: 'none' }}>Settings</Button>
        </Stack>

        <Box sx={{ mt: 'auto', borderTop: '1px solid #ececec', p: 2.4 }}>
          <Typography sx={{ fontWeight: 700, color: '#2d2d2d' }}>{user?.full_name || 'Membre'}</Typography>
          <Typography sx={{ fontSize: '0.82rem', color: '#8d8d8d' }}>
            {hasActive ? 'Abonnement actif' : 'Sans abonnement actif'}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ flex: 1, p: { xs: 2, md: 4 } }}>
        <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', md: 'center' }}
            sx={{ mb: 3, gap: 1.5 }}
          >
            <Box>
              <Typography sx={{ fontWeight: 800, color: '#222', fontSize: { xs: '1.9rem', md: '2.2rem' } }}>
                Subscription Overview
              </Typography>
              <Typography sx={{ color: '#918a80' }}>Manage your plan, track usage, and view billing history.</Typography>
            </Box>
            <Stack direction="row" spacing={1.2}>
              <Button variant="outlined" sx={{ borderColor: '#d7d7d7', color: '#555', textTransform: 'none', borderRadius: 3 }} onClick={loadData}>
                Refresh
              </Button>
              <Button variant="contained" sx={{ bgcolor: '#f1a10a', textTransform: 'none', borderRadius: 3, '&:hover': { bgcolor: '#d9900a' } }} onClick={() => navigate('/pricing')}>
                Upgrade / Change Plan
              </Button>
            </Stack>
          </Stack>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}

          <Paper
            elevation={0}
            sx={{
              p: { xs: 2.2, md: 3.2 },
              borderRadius: 4,
              border: '1px solid #ece7dd',
              background: '#fff',
              mb: 3,
            }}
          >
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2.5}>
              <Stack direction="row" spacing={2}>
                <Box
                  sx={{
                    width: 72,
                    height: 72,
                    borderRadius: 2.2,
                    bgcolor: '#f1a10a',
                    display: 'grid',
                    placeItems: 'center',
                    color: '#fff',
                    flexShrink: 0,
                  }}
                >
                  <BadgeCheck size={32} />
                </Box>
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.6 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: { xs: '1.4rem', md: '1.8rem' }, color: '#1f1f1f' }}>
                      {subscription?.plan_snapshot?.name || subscription?.plan_type || 'No Plan'}
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
                    <Typography>Renews on <b>{formatDate(subscription?.current_period_end)}</b></Typography>
                    <Typography>Users limit <b>{usersLimit}</b></Typography>
                  </Stack>
                </Box>
              </Stack>

              <Box sx={{ minWidth: 170, textAlign: { xs: 'left', md: 'right' }, borderLeft: { md: '1px solid #efefef' }, pl: { md: 3 } }}>
                <Typography sx={{ color: '#9f9f9f', fontWeight: 700, fontSize: '0.75rem' }}>NEXT PAYMENT</Typography>
                <Typography sx={{ fontSize: '2.1rem', color: '#1f1f1f', fontWeight: 800, lineHeight: 1.1 }}>
                  {subscription ? formatMoney(subscription.amount, subscription.currency || 'USD') : '-'}
                </Typography>
                <Typography sx={{ color: '#b5770c', fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer' }} onClick={() => navigate('/pricing')}>
                  Manage Plan
                </Typography>
              </Box>
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.1} sx={{ mt: 2.4 }}>
              <Button disabled={busy || !subscription} variant="contained" sx={{ bgcolor: '#f1a10a', textTransform: 'none', '&:hover': { bgcolor: '#d9900a' } }} onClick={() => runAction(() => subscriptionsService.renew(), 'Renouvellement initié, redirection paiement.')}>Renouveler</Button>
              <Button disabled={busy || !subscription?.cancel_at_period_end} variant="outlined" sx={{ textTransform: 'none' }} onClick={() => runAction(() => subscriptionsService.resume(), 'Abonnement repris.')}>Reprendre</Button>
              <Button disabled={busy || !subscription} variant="outlined" color="warning" sx={{ textTransform: 'none' }} onClick={() => runAction(() => subscriptionsService.cancel({ immediately: false }), 'Annulation en fin de période activée.')}>Annuler fin période</Button>
              <Button disabled={busy || !subscription} variant="outlined" color="error" sx={{ textTransform: 'none' }} onClick={() => runAction(() => subscriptionsService.cancel({ immediately: true }), 'Abonnement annulé immédiatement.')}>Annuler maintenant</Button>
            </Stack>
          </Paper>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2, mb: 2.5 }}>
            <RingCard title="Text unlocks" value={`${textUsed}`} hint={`${textUsed} sur ${textQuota} ce cycle`} pct={progressValue(textUsed, textQuota)} />
            <RingCard title="Active devices" value={`${Math.min(activeMembersCount, usersLimit)}`} hint={`${activeMembersCount} membres actifs sur ${usersLimit}`} pct={progressValue(activeMembersCount, usersLimit)} />
            <RingCard title="Bonus credits" value={`${bonusAvailableTotal}`} hint="Crédits bonus restants" pct={progressValue(bonusAvailableTotal, Math.max(1, (usageData.bonus_quota || bonusAvailableTotal || 1)))} />
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1.4fr' }, gap: 2 }}>
            <Paper elevation={0} sx={{ p: 3, borderRadius: 4, border: '1px solid #ece7dd' }}>
              <Typography sx={{ fontWeight: 800, color: '#262626', mb: 2 }}>Active Perks</Typography>
              <Stack spacing={1.2}>
                <Typography sx={{ color: '#4f4f4f' }}>- Réduction livres payants: <b>{subscription?.plan_snapshot?.discountPercentPaidBooks || 30}%</b></Typography>
                <Typography sx={{ color: '#4f4f4f' }}>- Quota texte: <b>{textQuota}</b></Typography>
                <Typography sx={{ color: '#4f4f4f' }}>- Quota audio: <b>{audioQuota}</b></Typography>
                <Typography sx={{ color: '#4f4f4f' }}>- Bonus disponibles: <b>{bonusAvailableTotal}</b></Typography>
                <Typography sx={{ color: '#4f4f4f' }}>- Members actifs: <b>{activeMembersCount}</b></Typography>
                <Typography sx={{ color: '#4f4f4f' }}>- Places restantes: <b>{seatsRemaining}</b></Typography>
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} sx={{ mt: 2.2 }}>
                <TextField
                  select
                  size="small"
                  label="Nouveau plan"
                  value={changePlanId}
                  onChange={(e) => setChangePlanId(e.target.value)}
                  sx={{ minWidth: 220 }}
                >
                  {availablePlanOptions.map((plan) => (
                    <MenuItem key={plan.id} value={plan.id}>
                      {plan.name} ({formatMoney((plan.basePriceCents || 0) / 100, plan.currency || 'USD')})
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  type="number"
                  size="small"
                  label="Utilisateurs"
                  value={changeUsersLimit}
                  onChange={(e) => setChangeUsersLimit(Math.max(1, Number(e.target.value || 1)))}
                  sx={{ width: 130 }}
                />
                <Button
                  disabled={busy || !changePlanId}
                  variant="contained"
                  sx={{ bgcolor: '#f1a10a', textTransform: 'none', '&:hover': { bgcolor: '#d9900a' } }}
                  onClick={() => runAction(() => subscriptionsService.changePlan({ planId: changePlanId, usersLimit: changeUsersLimit }), 'Changement de plan programmé.')}
                >
                  Programmer
                </Button>
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} sx={{ mt: 1.2 }} alignItems={{ sm: 'center' }}>
                <TextField
                  type="number"
                  size="small"
                  label="users_limit"
                  value={usersLimitInput}
                  onChange={(e) => setUsersLimitInput(Math.max(1, Number(e.target.value || 1)))}
                  sx={{ width: 140 }}
                />
                <Button disabled={busy || !subscription} variant="outlined" sx={{ textTransform: 'none' }} onClick={() => runAction(() => subscriptionsService.updateUsersLimit(usersLimitInput), 'users_limit mis à jour.')}>Mettre à jour</Button>
                <Stack direction="row" spacing={0.6} alignItems="center">
                  <Users size={16} color="#868686" />
                  <Typography sx={{ fontSize: '0.9rem', color: '#6b6b6b' }}>Membres actifs: {activeMembersCount}</Typography>
                </Stack>
              </Stack>

              <Box sx={{ mt: 2.2, pt: 2, borderTop: '1px solid #efefef' }}>
                <Typography sx={{ fontWeight: 800, color: '#262626', mb: 1.2 }}>Gestion membres famille</Typography>
                <Typography sx={{ color: '#6f6f6f', fontSize: '0.86rem', mb: 1.2 }}>
                  Rôle: <b>{memberRole || '-'}</b> • Sièges: <b>{activeMembersCount}/{usersLimit}</b>
                </Typography>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} sx={{ mb: 1.4 }}>
                  <TextField
                    size="small"
                    label="User ID à ajouter"
                    value={memberUserIdInput}
                    onChange={(e) => setMemberUserIdInput(e.target.value)}
                    sx={{ minWidth: 280 }}
                    disabled={busy || !isOwner}
                  />
                  <Button
                    disabled={busy || !isOwner || !memberUserIdInput.trim()}
                    variant="contained"
                    startIcon={<UserPlus size={16} />}
                    sx={{ bgcolor: '#f1a10a', textTransform: 'none', '&:hover': { bgcolor: '#d9900a' } }}
                    onClick={() =>
                      runMemberAction(
                        () => subscriptionsService.addMember(memberUserIdInput.trim()),
                        'Membre ajouté.'
                      ).then(() => setMemberUserIdInput(''))
                    }
                  >
                    Ajouter membre
                  </Button>
                </Stack>

                {!isOwner && (
                  <Typography sx={{ color: '#8c8c8c', fontSize: '0.82rem', mb: 1 }}>
                    Seul le propriétaire peut ajouter ou retirer des membres.
                  </Typography>
                )}

                <Stack spacing={0.8}>
                  {members.filter((m) => m.status === 'active').map((m) => {
                    const isOwnerMember = m.role === 'owner' || m.user_id === subscription?.user_id;
                    return (
                      <Stack
                        key={m.id}
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        sx={{ px: 1.2, py: 1, border: '1px solid #efefef', borderRadius: 2 }}
                      >
                        <Box>
                          <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: '#3b3b3b' }}>
                            {m.user_id}
                          </Typography>
                          <Typography sx={{ fontSize: '0.8rem', color: '#8a8a8a' }}>
                            role: {m.role} • joined: {formatDate(m.joined_at)}
                          </Typography>
                        </Box>
                        <Button
                          size="small"
                          color="error"
                          variant="text"
                          startIcon={<Trash2 size={14} />}
                          disabled={busy || !isOwner || isOwnerMember}
                          onClick={() =>
                            runMemberAction(
                              () => subscriptionsService.removeMember(m.user_id),
                              'Membre retiré.'
                            )
                          }
                          sx={{ textTransform: 'none' }}
                        >
                          Retirer
                        </Button>
                      </Stack>
                    );
                  })}
                  {members.filter((m) => m.status === 'active').length === 0 && (
                    <Typography sx={{ color: '#8c8c8c', fontSize: '0.86rem' }}>
                      Aucun membre actif.
                    </Typography>
                  )}
                </Stack>
              </Box>
            </Paper>

            <Paper elevation={0} sx={{ borderRadius: 4, border: '1px solid #ece7dd', overflow: 'hidden' }}>
              <Box sx={{ p: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #efefef' }}>
                <Typography sx={{ fontWeight: 800, color: '#262626' }}>Recent Invoices</Typography>
                <Typography sx={{ color: '#f1a10a', fontWeight: 700 }}>View All</Typography>
              </Box>
              <Box sx={{ overflowX: 'auto' }}>
                <Box sx={{ minWidth: 620 }}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1.2fr 1.4fr 1fr 0.6fr', px: 2.5, py: 1.3, bgcolor: '#fafafa', color: '#7f7f7f', fontSize: '0.78rem', fontWeight: 700 }}>
                    <Box>DATE</Box>
                    <Box>DESCRIPTION</Box>
                    <Box>AMOUNT</Box>
                    <Box>INVOICE</Box>
                  </Box>
                  {(payments || []).slice(0, 8).map((p) => (
                    <Box key={p.id} sx={{ display: 'grid', gridTemplateColumns: '1.2fr 1.4fr 1fr 0.6fr', px: 2.5, py: 1.5, borderTop: '1px solid #f1f1f1', alignItems: 'center' }}>
                      <Typography sx={{ color: '#565656', fontSize: '0.9rem' }}>{formatDate(p.created_at)}</Typography>
                      <Typography sx={{ color: '#3d3d3d', fontSize: '0.9rem' }}>
                        {p.metadata?.payment_type === 'subscription_renewal' ? 'Renouvellement' : 'Abonnement'}
                      </Typography>
                      <Typography sx={{ color: '#3d3d3d', fontSize: '0.9rem' }}>{formatMoney(p.amount, p.currency || 'USD')}</Typography>
                      <Download size={16} color="#8c8c8c" />
                    </Box>
                  ))}
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
    </Box>
  );
}
