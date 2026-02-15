import React, { useEffect, useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RemoveIcon from '@mui/icons-material/Remove';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useNavigate } from 'react-router-dom';
import { subscriptionsService } from '../services/subscriptions.service';

const primary = '#f4a825';
const background = '#f8f7f5';

function formatMoney(cents, currency = 'USD') {
  const amount = Number(cents || 0) / 100;
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

function planBadge(slug) {
  const key = getPlanFamilyKey({ slug });
  if (key === 'family') return 'Groupe';
  if (key === 'personal') return 'Individuel';
  return 'Basique';
}

function planCta(slug) {
  const key = getPlanFamilyKey({ slug });
  if (key === 'family') return 'Choisir Famille';
  if (key === 'personal') return 'Commencer Premium';
  return 'Commencer Slow';
}

function planFeatures(plan) {
  const features = [
    `${plan.textQuotaPerUser || 0} livres texte par utilisateur`,
    `${plan.audioQuotaPerUser || 0} livres audio par utilisateur`,
    `${plan.discountPercentPaidBooks || 0}% de réduction sur livres payants`,
    `Validité ${plan.durationDays || 30} jours`,
  ];

  if ((plan.includedUsers || 1) > 1) {
    features.unshift(`${plan.includedUsers} utilisateurs inclus`);
    features.push(`+ ${formatMoney(plan.extraUserPriceCents || 0, plan.currency)} par utilisateur supplémentaire`);
  }

  if (plan.bonusQuantityPerUser > 0) {
    const trigger = plan.bonusTrigger === 'immediate' ? 'bonus immédiat' : 'bonus au quota atteint';
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

function PlanCard({ plan, loadingCheckout, onCheckout }) {
  const isPremium = getPlanFamilyKey(plan) === 'personal';
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
          label="Recommandé"
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
        {planBadge(plan.slug)}
      </Typography>
      <Typography sx={{ mt: 0.5, fontSize: '1.6rem', fontWeight: 800 }}>{plan.name}</Typography>
      <Box sx={{ mt: 2.1, display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
        <Typography sx={{ fontSize: '2.4rem', lineHeight: 1, fontWeight: 900 }}>{formatMoney(plan.basePriceCents, plan.currency)}</Typography>
        <Typography sx={{ fontSize: '1rem', fontWeight: 700 }}>/ {plan.durationDays} jours</Typography>
      </Box>
      {plan.monthlyEquivalentCents ? (
        <Typography sx={{ mt: 0.8, fontSize: '0.82rem', color: '#6d665d' }}>
          Soit {formatMoney(plan.monthlyEquivalentCents, plan.currency)} / mois
        </Typography>
      ) : null}

      <Button
        fullWidth
        disabled={loadingCheckout}
        onClick={() => onCheckout(plan)}
        sx={{
          mt: 3,
          height: 46,
          bgcolor: isPremium ? primary : '#f2f2f2',
          color: isPremium ? '#111' : '#1c160d',
          borderRadius: '10px',
          fontWeight: 800,
          '&:hover': {
            bgcolor: isPremium ? '#e49e22' : '#e8e8e8',
          },
        }}
      >
        {loadingCheckout ? 'Chargement...' : planCta(plan.slug)}
      </Button>

      <Stack spacing={1.7} sx={{ mt: 2.2 }}>
        {planFeatures(plan).map((feature) => (
          <Box key={feature} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.2 }}>
            <CheckCircleOutlineIcon sx={{ color: isPremium ? primary : '#30a46c', fontSize: 20 }} />
            <Typography sx={{ fontSize: '0.9rem', color: '#1c160d' }}>{feature}</Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

export default function PricingPage() {
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width:900px)');

  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [loadingCheckoutSlug, setLoadingCheckoutSlug] = useState('');
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [expandedFaq, setExpandedFaq] = useState(() => ({ 'faq-0': true }));
  const [error, setError] = useState('');

  useEffect(() => {
    const loadPlans = async () => {
      setLoadingPlans(true);
      setError('');
      try {
        const data = await subscriptionsService.getPlans();
        setPlans(data || []);
      } catch (err) {
        console.error('Pricing plans error:', err);
        setError('Impossible de charger les forfaits pour le moment.');
      } finally {
        setLoadingPlans(false);
      }
    };

    loadPlans();
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

  const toggleFaq = (faqId) => (_, expanded) => {
    setExpandedFaq((prev) => ({
      ...prev,
      [faqId]: expanded,
    }));
  };

  const handleCheckout = async (plan) => {
    setLoadingCheckoutSlug(plan.slug);
    setError('');
    try {
      if (plan.displayOnlyAnnual) {
        setError(`Le plan annuel réel pour "${plan.name}" n'est pas encore configuré côté backend.`);
        return;
      }

      const response = await subscriptionsService.checkout({
        planId: plan.id,
        usersLimit: plan.includedUsers,
      });

      if (response.paymentLink) {
        window.location.href = response.paymentLink;
      } else {
        setError('Le lien de paiement est indisponible pour ce plan.');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setError('Connecte-toi puis réessaie pour lancer le paiement.');
      if (String(err.message || '').toLowerCase().includes('not authenticated')) {
        navigate('/login');
      }
    } finally {
      setLoadingCheckoutSlug('');
    }
  };

  const comparisonRows = [
    {
      key: 'Prix',
      value: (p) => formatMoney(p.basePriceCents, p.currency),
    },
    {
      key: 'Utilisateurs inclus',
      value: (p) => String(p.includedUsers || 1),
    },
    {
      key: 'Quota texte / utilisateur',
      value: (p) => String(p.textQuotaPerUser || 0),
    },
    {
      key: 'Quota audio / utilisateur',
      value: (p) => String(p.audioQuotaPerUser || 0),
    },
    {
      key: 'Réduction livres payants',
      value: (p) => `${p.discountPercentPaidBooks || 0}%`,
    },
    {
      key: 'Coût utilisateur supplémentaire',
      value: (p) => (Number(p.extraUserPriceCents || 0) > 0 ? formatMoney(p.extraUserPriceCents, p.currency) : <RemoveIcon sx={{ color: '#b9b3aa' }} />),
    },
  ];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: background, color: '#1c160d' }}>
      <Box sx={{ borderBottom: '1px solid rgba(244,168,37,0.14)', bgcolor: background, position: 'sticky', top: 0, zIndex: 30 }}>
        <Container maxWidth="lg" sx={{ height: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography sx={{ fontWeight: 800, fontSize: '1.03rem' }}>emoti numérique</Typography>
          <Stack direction="row" spacing={3} sx={{ display: { xs: 'none', md: 'flex' } }}>
            <Typography sx={{ fontSize: '0.9rem', cursor: 'pointer' }} onClick={() => navigate('/catalogue')}>Bibliothèque</Typography>
            <Typography sx={{ fontSize: '0.9rem' }}>Nouveautés</Typography>
            <Typography sx={{ fontSize: '0.9rem', color: primary, fontWeight: 700 }}>Tarifs</Typography>
            <Typography sx={{ fontSize: '0.9rem' }}>À propos</Typography>
          </Stack>
          <Button sx={{ bgcolor: primary, color: '#111', borderRadius: '9px', fontWeight: 800, '&:hover': { bgcolor: '#e29d22' } }} onClick={() => navigate('/register')}>
            S'inscrire
          </Button>
        </Container>
      </Box>

      <Box sx={{ background: 'linear-gradient(to bottom, rgba(244,168,37,0.12), rgba(244,168,37,0))', py: { xs: 8, md: 12 } }}>
        <Container maxWidth="md" sx={{ textAlign: 'center' }}>
          <Typography sx={{ fontFamily: 'Playfair Display, Newsreader, serif', fontSize: { xs: '2.2rem', md: '4rem' }, fontWeight: 900, lineHeight: 1.05 }}>
            Choisissez votre plan
          </Typography>
          <Typography sx={{ mt: 2, color: '#6d665d' }}>
            Forfaits connectés aux données backend en temps réel.
          </Typography>

          <Box sx={{ mt: 4.5, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1.5 }}>
            {!isMobile && <Typography sx={{ fontSize: '0.84rem', fontWeight: 600 }}>Facturation mensuelle</Typography>}
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
                  Mensuel
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
                  Annuel
                </Typography>
              </Box>
            </Box>
            {!isMobile && (
              <Typography sx={{ fontSize: '0.84rem', fontWeight: 600 }}>
                {annualAvailableCount > 0
                  ? billingCycle === 'annual'
                    ? 'Économie annuelle active'
                    : 'Basculer en annuel'
                  : 'Annuel bientôt disponible'}
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
            {sortedPlans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                loadingCheckout={loadingCheckoutSlug === plan.slug}
                onCheckout={handleCheckout}
              />
            ))}
          </Box>
        )}
      </Container>

      <Container maxWidth="md" sx={{ py: 8 }}>
        <Typography sx={{ textAlign: 'center', fontFamily: 'Playfair Display, Newsreader, serif', fontWeight: 700, fontSize: '2rem', mb: 4.5 }}>
          Comparaison détaillée
        </Typography>
        <Box sx={{ overflowX: 'auto' }}>
          <Table sx={{ minWidth: 700 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#75706a', fontWeight: 800 }}>Fonctionnalités</TableCell>
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
                  <TableCell sx={{ fontSize: '0.9rem', fontWeight: 600 }}>{row.key}</TableCell>
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
        <Typography sx={{ textAlign: 'center', fontFamily: 'Playfair Display, Newsreader, serif', fontWeight: 700, fontSize: '2rem', mb: 4 }}>Questions fréquentes</Typography>
        <Stack spacing={1.5}>
          {[
            ["Puis-je annuler mon abonnement à tout moment ?", 'Oui, annulation possible depuis votre espace.'],
            ["Quand les quotas se réinitialisent ?", 'Chaque cycle de 30 jours.'],
            ['Les bonus expirent quand ?', 'Les bonus expirent après 12 mois si non utilisés.'],
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
          <Typography sx={{ fontSize: { xs: '1.8rem', md: '3rem' }, lineHeight: 1.05, fontWeight: 900 }}>Prêt à déverrouiller votre prochain livre ?</Typography>
          <Typography sx={{ mt: 1.2, color: 'rgba(0,0,0,0.72)' }}>
            Choisissez un plan et commencez immédiatement.
          </Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mt: 3, justifyContent: 'center' }}>
            <Button sx={{ bgcolor: '#111', color: '#fff', height: 46, px: 3.2, borderRadius: '10px', fontWeight: 800, '&:hover': { bgcolor: '#000' } }} onClick={() => navigate('/register')}>
              Créer un compte
            </Button>
            <Button sx={{ bgcolor: 'rgba(255,255,255,0.28)', color: '#111', height: 46, px: 3.2, borderRadius: '10px', border: '1px solid rgba(0,0,0,0.1)', fontWeight: 800 }} onClick={() => navigate('/catalogue')}>
              Voir la bibliothèque
            </Button>
          </Stack>
        </Box>
      </Container>

      <Box sx={{ borderTop: '1px solid #e6e2db', py: 4.2, bgcolor: '#fff' }}>
        <Container maxWidth="lg" sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: 'center', justifyContent: 'space-between', gap: 2.5 }}>
          <Typography sx={{ fontWeight: 800 }}>emoti numérique</Typography>
          <Typography sx={{ fontSize: '0.74rem', color: '#9b9488' }}>© 2024 Emoti Numérique. Tous droits réservés.</Typography>
        </Container>
      </Box>
    </Box>
  );
}
