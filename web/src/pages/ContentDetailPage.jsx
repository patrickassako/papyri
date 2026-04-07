import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Rating,
  Snackbar,
  Skeleton,
  TextField,
  Typography,
} from '@mui/material';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  BookmarkPlus,
  BookOpen,
  ChevronRight,
  Headphones,
  Play,
} from 'lucide-react';
import { contentsService } from '../services/contents.service';
import tokens from '../config/tokens';
import * as authService from '../services/auth.service';
import { readingService } from '../services/reading.service';
import { subscriptionsService } from '../services/subscriptions.service';
import TopNavBar from '../components/TopNavBar';
import PublicHeader from '../components/PublicHeader';
import { useCurrency } from '../hooks/useCurrency';

function formatDuration(seconds) {
  if (!seconds || Number.isNaN(Number(seconds))) return '-';
  const total = Number(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
}

function formatSize(bytes) {
  if (!bytes || Number.isNaN(Number(bytes))) return '-';
  const mb = Number(bytes) / (1024 * 1024);
  if (mb >= 1024) {
    const gb = mb / 1024;
    return `${gb.toFixed(2)} GB`;
  }
  return `${mb.toFixed(1)} MB`;
}

function formatDate(iso) {
  if (!iso) return '-';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function formatLanguage(language) {
  if (!language) return '-';
  if (language === 'fr') return 'Francais';
  if (language === 'en') return 'Anglais';
  return language;
}

function formatType(type) {
  if (type === 'audiobook') return 'Livre audio';
  if (type === 'ebook') return 'E-book';
  return '-';
}

function formatMoney(cents, currency = 'USD') {
  const amount = Number(cents || 0) / 100;
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export default function ContentDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [content, setContent] = useState(null);
  const [recommendations, setRecommendations] = useState({ sameGenre: [], youllLike: [] });
  const [loading, setLoading] = useState(true);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [error, setError] = useState('');
  const [authContextLoading, setAuthContextLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [hasAnySubscription, setHasAnySubscription] = useState(false);
  const [accessInfo, setAccessInfo] = useState(null);
  const [usageInfo, setUsageInfo] = useState(null);
  const [accessActionLoading, setAccessActionLoading] = useState(false);
  const [accessActionError, setAccessActionError] = useState('');
  const [callbackNotice, setCallbackNotice] = useState('');
  const [paymentDialog, setPaymentDialog] = useState({ open: false, providerBusy: '' });
  const [lockLostNoticeOpen, setLockLostNoticeOpen] = useState(false);

  // ─── Avis lecteurs ───
  const [reviews, setReviews] = useState([]);
  const [reviewStats, setReviewStats] = useState(null);
  const [myReview, setMyReview] = useState(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 0, body: '' });
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [reviewSuccess, setReviewSuccess] = useState('');

  // ─── Ebook reading list ───
  const [inEbookList, setInEbookList] = useState(false);
  const [ebookListLoading, setEbookListLoading] = useState(false);

  useEffect(() => {
    if (!location.state?.readingLockLost) return;
    setLockLostNoticeOpen(true);
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    const loadContent = async () => {
      setLoading(true);
      setError('');
      setRecommendations({ sameGenre: [], youllLike: [] });

      try {
        const data = await contentsService.getContentById(id);
        setContent(data);

        setRelatedLoading(true);
        const recs = await contentsService.getContentRecommendations(id);
        setRecommendations(recs);
      } catch (err) {
        console.error('Erreur chargement contenu:', err);
        setError('Impossible de charger ce contenu. Veuillez réessayer.');
      } finally {
        setRelatedLoading(false);
        setLoading(false);
      }
    };

    loadContent();
  }, [id]);

  // Charge les avis à chaque changement de contenu
  useEffect(() => {
    if (!id) return;
    let active = true;
    setReviewsLoading(true);
    readingService.getReviews(id)
      .then(data => {
        if (!active) return;
        setReviews(data.reviews || []);
        setReviewStats(data.stats || null);
        setMyReview(data.myReview || null);
        if (data.myReview) {
          setReviewForm({ rating: data.myReview.rating, body: data.myReview.body || '' });
        }
      })
      .catch(() => {})
      .finally(() => { if (active) setReviewsLoading(false); });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    let active = true;

    const processPaymentCallback = async () => {
      if (authContextLoading || !isAuthenticated) return;

      const provider = searchParams.get('provider');
      const status = searchParams.get('status');
      const sessionId = searchParams.get('session_id');
      const txRef = searchParams.get('tx_ref');
      const transactionId = searchParams.get('transaction_id');

      const isStripeCallback = provider === 'stripe' && Boolean(status) && Boolean(sessionId);
      const isFlutterwaveCallback = Boolean(status) && Boolean(txRef);
      if (!isStripeCallback && !isFlutterwaveCallback) return;

      if (status !== 'successful') {
        if (active) {
          setCallbackNotice('');
          setAccessActionError('Paiement non confirmé. Vous pouvez relancer le déblocage.');
          setSearchParams({}, { replace: true });
        }
        return;
      }

      if (isFlutterwaveCallback && !transactionId) {
        if (active) {
          setAccessActionError('transaction_id manquant dans le callback de paiement.');
          setSearchParams({}, { replace: true });
        }
        return;
      }

      try {
        const verified = await contentsService.verifyUnlockPayment(id, {
          provider: isStripeCallback ? 'stripe' : 'flutterwave',
          sessionId: isStripeCallback ? sessionId : undefined,
          transactionId: isFlutterwaveCallback ? transactionId : undefined,
          reference: isFlutterwaveCallback ? txRef : undefined,
        });

        if (!active) return;

        setAccessInfo((prev) => ({
          ...(prev || {}),
          unlocked: true,
          unlock: verified?.unlock || null,
        }));
        setCallbackNotice('Paiement confirmé. Contenu débloqué.');
      } catch (verifyError) {
        if (!active) return;
        setCallbackNotice('');
        setAccessActionError(verifyError.message || 'Impossible de vérifier le paiement.');
      } finally {
        if (active) {
          setSearchParams({}, { replace: true });
        }
      }
    };

    processPaymentCallback();

    return () => {
      active = false;
    };
  }, [authContextLoading, id, isAuthenticated, searchParams, setSearchParams]);

  useEffect(() => {
    let active = true;

    const loadViewerContext = async () => {
      setAuthContextLoading(true);
      setAccessActionError('');

      try {
        const authenticated = await authService.isAuthenticated();
        if (!active) return;

        setIsAuthenticated(authenticated);

        if (authenticated) {
          authService.getUser().then((u) => { if (active) setUser(u); }).catch(() => {});
        }

        if (!authenticated) {
          setHasActiveSubscription(false);
          setHasAnySubscription(false);
          setAccessInfo(null);
          setAuthContextLoading(false);
          return;
        }

        const [subscriptionResult, accessResult, usageResult] = await Promise.allSettled([
          subscriptionsService.getMySubscription(),
          contentsService.getContentAccess(id),
          subscriptionsService.getMyUsage(),
        ]);

        if (!active) return;

        if (subscriptionResult.status === 'fulfilled') {
          setHasAnySubscription(Boolean(subscriptionResult.value?.hasSubscription));
          setHasActiveSubscription(Boolean(subscriptionResult.value?.isActive));
        } else {
          setHasAnySubscription(false);
          setHasActiveSubscription(false);
        }

        if (accessResult.status === 'fulfilled') {
          setAccessInfo(accessResult.value);
          if (typeof accessResult.value?.has_active_subscription === 'boolean') {
            setHasActiveSubscription(accessResult.value.has_active_subscription);
          }
        } else {
          setAccessInfo(null);
        }

        if (usageResult.status === 'fulfilled') {
          setUsageInfo(usageResult.value?.data?.usage || null);
        } else {
          setUsageInfo(null);
        }
      } catch (ctxError) {
        console.error('Erreur contexte utilisateur:', ctxError);
        if (!active) return;
        setIsAuthenticated(false);
        setHasAnySubscription(false);
        setHasActiveSubscription(false);
        setAccessInfo(null);
        setUsageInfo(null);
      } finally {
        if (active) setAuthContextLoading(false);
      }
    };

    loadViewerContext();

    return () => {
      active = false;
    };
  }, [id]);

  const handleRead = () => {
    const format = String(content?.format || '').toLowerCase();
    if (format === 'pdf') {
      navigate(`/pdf/${id}`);
    } else {
      navigate(`/read/${id}`);
    }
  };

  const handleListen = () => {
    navigate(`/listen/${id}`);
  };

  const { formatBoth: formatCurrencyBoth } = useCurrency();

  const isAudiobook = content?.content_type === 'audiobook';
  const accessType = content?.access_type || 'subscription';
  const isSubscriptionBook = ['subscription', 'subscription_or_paid'].includes(accessType);
  const isPaidBook = accessType === 'paid' || accessType === 'subscription_or_paid' || Number(content?.price_cents || 0) > 0;

  const localizedPrice = content?.localized_price || null;
  const pricingCurrency = accessInfo?.pricing?.currency || localizedPrice?.currency || content?.price_currency || 'EUR';
  const basePriceCents = Number(accessInfo?.pricing?.base_price_cents ?? localizedPrice?.price_cents ?? content?.price_cents ?? 0);
  const defaultDiscountPercent = Number(content?.subscription_discount_percent ?? 30);
  const discountPercent = Number(
    accessInfo?.pricing?.discount_percent ?? (hasActiveSubscription ? defaultDiscountPercent : 0)
  );
  const reducedPriceCents = Number(
    accessInfo?.pricing?.final_price_cents ?? Math.max(0, Math.round(basePriceCents * (100 - discountPercent) / 100))
  );
  const isUnlocked = Boolean(accessInfo?.unlocked);
  const canOpenContent = Boolean(accessInfo?.can_read || isUnlocked);
  const quotaUsed = Number(isAudiobook ? usageInfo?.audio_unlocked_count : usageInfo?.text_unlocked_count || 0);
  const quotaTotal = Number(isAudiobook ? usageInfo?.audio_quota : usageInfo?.text_quota || 0);
  const quotaRemaining = Math.max(0, quotaTotal - quotaUsed);

  const scenario = useMemo(() => {
    if (!isAuthenticated) return 'guest';
    if (hasActiveSubscription) return 'active_subscriber';
    return 'inactive_subscriber';
  }, [isAuthenticated, hasActiveSubscription]);

  const primaryActionLabel = useMemo(() => {
    if (scenario === 'guest') {
      return isPaidBook ? 'Se connecter pour acheter' : 'Se connecter pour accéder';
    }
    if (scenario === 'active_subscriber') {
      if (canOpenContent) return isAudiobook ? 'Écouter maintenant' : 'Lire maintenant';
      if (isPaidBook) return 'Acheter au prix réduit';
      return 'Débloquer avec mon abonnement';
    }
    if (isPaidBook) return 'Acheter sans réduction';
    return 'Prendre un abonnement';
  }, [scenario, isPaidBook, canOpenContent, isAudiobook]);

  const secondaryActionLabel = useMemo(() => {
    if (scenario === 'guest') return 'Voir les abonnements';
    if (scenario === 'active_subscriber') {
      if (isAudiobook) return 'Ajouter à la playlist';
      return inEbookList ? 'Retirer de ma liste' : 'Ajouter à ma liste';
    }
    return isPaidBook ? 'Prendre un abonnement' : 'Voir les abonnements';
  }, [scenario, isPaidBook, isAudiobook, inEbookList]);

  const doUnlock = async (provider) => {
    setAccessActionLoading(true);
    try {
      const result = await contentsService.unlockContent(id, { provider });

      if (result.paymentRequired) {
        const paymentLink = result?.data?.payment?.payment_link;
        if (paymentLink) {
          setPaymentDialog({ open: false, providerBusy: '' });
          window.location.href = paymentLink;
          return;
        }
        throw new Error('Lien de paiement indisponible.');
      }

      if (result.success) {
        setAccessInfo((prev) => ({
          ...(prev || {}),
          unlocked: true,
          can_read: true,
          unlock: result.data?.unlock || null,
        }));
        if (result.data?.cycle_usage) {
          setUsageInfo((prev) => {
            const next = { ...(prev || {}) };
            if (isAudiobook) {
              next.audio_unlocked_count = Number(result.data.cycle_usage.used || 0);
              next.audio_quota = Number(result.data.cycle_usage.quota || next.audio_quota || 0);
            } else {
              next.text_unlocked_count = Number(result.data.cycle_usage.used || 0);
              next.text_quota = Number(result.data.cycle_usage.quota || next.text_quota || 0);
            }
            return next;
          });
        } else {
          // Refresh usage when source is bonus/paid or when backend does not include cycle_usage.
          subscriptionsService.getMyUsage()
            .then((usageRes) => setUsageInfo(usageRes?.data?.usage || null))
            .catch(() => {});
        }

        if (isAudiobook) {
          handleListen();
        } else {
          handleRead();
        }
      }
    } catch (unlockError) {
      console.error('Erreur de déblocage:', unlockError);
      setAccessActionError(unlockError.message || 'Impossible de débloquer ce contenu.');
    } finally {
      setAccessActionLoading(false);
      setPaymentDialog((prev) => ({ ...prev, providerBusy: '' }));
    }
  };

  const handleChoosePaymentProvider = async (provider) => {
    setPaymentDialog((prev) => ({ ...prev, providerBusy: provider }));
    await doUnlock(provider);
  };

  const handlePrimaryAccessAction = async () => {
    setAccessActionError('');

    if (scenario === 'guest') {
      navigate('/login');
      return;
    }

    if (scenario === 'inactive_subscriber' && !isPaidBook) {
      navigate('/pricing');
      return;
    }

    if (canOpenContent) {
      if (isAudiobook) {
        handleListen();
      } else {
        handleRead();
      }
      return;
    }

    const needsProviderChoice = ['paid', 'subscription_or_paid'].includes(accessType);
    if (needsProviderChoice) {
      setPaymentDialog({ open: true, providerBusy: '' });
      return;
    }

    await doUnlock(undefined);
  };

  const handleAddToList = async () => {
    try {
      if (isAudiobook) {
        await readingService.addToAudioPlaylist(id);
        setAccessActionError('');
        setCallbackNotice('Livre audio ajouté à votre playlist.');
      } else {
        setEbookListLoading(true);
        if (inEbookList) {
          await readingService.removeFromEbookList(id);
          setInEbookList(false);
          setCallbackNotice('Retiré de votre liste de lecture.');
        } else {
          await readingService.addToEbookList(id);
          setInEbookList(true);
          setCallbackNotice('Ajouté à votre liste de lecture.');
        }
      }
    } catch (err) {
      setAccessActionError(err?.message || 'Impossible de modifier votre liste.');
    } finally {
      setEbookListLoading(false);
    }
  };

  const handleSecondaryAction = async () => {
    if (scenario === 'active_subscriber') {
      await handleAddToList();
      return;
    }
    navigate('/pricing');
  };

  const categories = useMemo(() => {
    if (!Array.isArray(content?.categories)) return [];
    return content.categories.map((item) => item?.name).filter(Boolean);
  }, [content]);

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Skeleton variant="text" width={280} height={40} />
        <Box sx={{ mt: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '340px 1fr' }, gap: 5 }}>
          <Skeleton variant="rounded" height={520} />
          <Box>
            <Skeleton variant="text" width="80%" height={70} />
            <Skeleton variant="text" width="55%" />
            <Skeleton variant="rounded" width="100%" height={220} sx={{ mt: 2 }} />
          </Box>
        </Box>
      </Container>
    );
  }

  if (error || !content) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error || 'Contenu introuvable'}
        </Alert>
        <Button onClick={() => navigate('/catalogue')} variant="outlined">
          Retour au catalogue
        </Button>
      </Container>
    );
  }

  return (
    <Box sx={{ bgcolor: '#fcfaf8', minHeight: '100vh', color: '#1c160d' }}>
      <Snackbar
        open={lockLostNoticeOpen}
        autoHideDuration={4200}
        onClose={() => setLockLostNoticeOpen(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setLockLostNoticeOpen(false)}
          severity="warning"
          variant="filled"
          sx={{ width: '100%' }}
        >
          La lecture a ete reprise sur un autre appareil connecte a ce compte.
        </Alert>
      </Snackbar>

      {isAuthenticated
        ? <TopNavBar user={user} />
        : <PublicHeader activeKey="catalogue" isAuthenticated={false} background="#fcfaf8" />
      }

      <Container maxWidth="lg" sx={{ py: { xs: 2, md: 5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#9c7e49', fontSize: { xs: '0.82rem', md: '0.95rem' }, mb: { xs: 2, md: 4 }, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: 'inherit', cursor: 'pointer' }} onClick={() => navigate('/catalogue')}>
            Bibliotheque
          </Typography>
          <ChevronRight size={14} />
          <Typography sx={{ fontSize: 'inherit' }}>{categories[0] || 'Detail'}</Typography>
          <ChevronRight size={14} />
          <Typography sx={{ fontSize: 'inherit', color: '#1c160d', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: { xs: '160px', md: 'none' } }}>{content.title}</Typography>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '360px minmax(0, 1fr)' },
            gap: { xs: 3, md: 8 },
            alignItems: 'start'
          }}
        >
          <Box sx={{ position: { md: 'sticky' }, top: { md: 100 } }}>
            <Box
              sx={{
                width: '100%',
                maxWidth: { xs: '190px', sm: '220px', md: '100%' },
                mx: { xs: 'auto', md: 0 },
                aspectRatio: '3 / 4.2',
                borderRadius: '18px',
                overflow: 'hidden',
                boxShadow: '0 22px 45px rgba(0,0,0,0.18)',
                bgcolor: '#ece4d7'
              }}
            >
              <Box
                component="img"
                src={content.cover_url || 'https://placehold.co/600x900/ece4d7/6b5840?text=Couverture'}
                alt={content.title}
                sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </Box>

            <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: { xs: 'center', md: 'flex-start' } }}>
              <Chip
                label={content.format ? content.format.toUpperCase() : 'FORMAT'}
                icon={isAudiobook ? <Headphones size={15} /> : <BookOpen size={15} />}
                sx={{
                  bgcolor: '#f4efe7',
                  color: '#1c160d',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  '& .MuiChip-icon': { color: '#4f412b' }
                }}
              />
              <Chip
                label={formatType(content.content_type)}
                sx={{
                  bgcolor: '#f4efe7',
                  color: '#1c160d',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '0.75rem'
                }}
              />
              <Chip
                label={formatLanguage(content.language)}
                sx={{
                  bgcolor: '#f4efe7',
                  color: '#1c160d',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '0.75rem'
                }}
              />
            </Box>

            <Box sx={{ mt: 2.25, display: 'flex', flexDirection: 'column', gap: 1.1 }}>
              <Button
                fullWidth
                onClick={handlePrimaryAccessAction}
                startIcon={<Play size={18} />}
                disabled={accessActionLoading || authContextLoading}
                sx={{
                  height: 48,
                  borderRadius: 999,
                  bgcolor: '#f29e0d',
                  color: '#fff',
                  fontWeight: 700,
                  '&:hover': { bgcolor: '#e18f08' }
                }}
              >
                {accessActionLoading ? 'Traitement...' : primaryActionLabel}
              </Button>
              <Button
                fullWidth
                variant="outlined"
                onClick={handleSecondaryAction}
                startIcon={<BookmarkPlus size={18} />}
                sx={{
                  height: 48,
                  borderRadius: 999,
                  borderColor: '#f29e0d',
                  color: '#d28709',
                  fontWeight: 700,
                  '&:hover': { borderColor: '#e18f08', bgcolor: '#fff6e8' }
                }}
              >
                {secondaryActionLabel}
              </Button>
            </Box>
          </Box>

          <Box>
            <Typography
              sx={{
                fontFamily: 'Newsreader, Playfair Display, Georgia, serif',
                fontWeight: 700,
                fontSize: { xs: '1.8rem', sm: '2.25rem', md: '4rem' },
                letterSpacing: '-0.02em',
                lineHeight: 1.05,
                maxWidth: '100%'
              }}
            >
              {content.title}
            </Typography>

            <Typography sx={{ mt: 1.6, color: '#e6970c', fontSize: { xs: '1.1rem', md: '1.45rem' }, fontFamily: 'Newsreader, serif', fontWeight: 500 }}>
              Par {content.author}
            </Typography>

            <Box
              sx={{
                display: { xs: 'grid', md: 'none' },
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: 1,
                mt: 2,
                maxWidth: 560,
              }}
            >
              {[
                { label: 'Format', value: content.format ? content.format.toUpperCase() : '-' },
                { label: 'Langue', value: formatLanguage(content.language) },
                { label: isAudiobook ? 'Audio' : 'Taille', value: isAudiobook ? formatDuration(content.duration_seconds) : formatSize(content.file_size_bytes) },
              ].map((item) => (
                <Box key={item.label} sx={{ p: 1.2, borderRadius: 3, border: '1px solid #f0e7d8', bgcolor: '#fffdfa' }}>
                  <Typography sx={{ color: '#9c7e49', fontSize: '0.62rem', letterSpacing: '0.08em', fontWeight: 700, textTransform: 'uppercase' }}>{item.label}</Typography>
                  <Typography sx={{ mt: 0.25, fontWeight: 700, fontSize: '0.86rem', color: '#1c160d' }}>{item.value}</Typography>
                </Box>
              ))}
            </Box>

            <Box
              sx={{
                mt: 2.4,
                p: { xs: 1.6, md: 2.2 },
                borderRadius: '14px',
                border: '1px solid #f0e7d8',
                bgcolor: '#fffdfa',
                maxWidth: 760
              }}
            >
              {authContextLoading ? (
                <Typography sx={{ color: '#7a6a4e', fontSize: '0.95rem' }}>
                  Vérification de l’accès en cours...
                </Typography>
              ) : scenario === 'guest' ? (
                <Box>
                  <Typography sx={{ fontWeight: 700 }}>
                    Vous êtes en mode visiteur.
                  </Typography>
                  <Typography sx={{ mt: 0.8, color: '#5f513d', fontSize: '0.95rem' }}>
                    {isSubscriptionBook
                      ? 'Connectez-vous ou prenez un abonnement pour accéder à ce livre.'
                      : 'Connectez-vous pour acheter ce livre.'}
                  </Typography>
                  {isPaidBook && basePriceCents > 0 ? (() => {
                    const p = formatCurrencyBoth(basePriceCents);
                    return (
                      <Typography sx={{ mt: 0.9, color: '#5f513d', fontSize: '0.95rem' }}>
                        Prix: <strong>{p.local}</strong>{p.eur ? <span style={{ color: '#9a8c7f', fontSize: '0.85em' }}> (≈ {p.eur})</span> : ''}. Avec un abonnement actif, vous bénéficiez de
                        {' '}<strong>{defaultDiscountPercent}%</strong> de réduction.
                      </Typography>
                    );
                  })() : null}
                </Box>
              ) : scenario === 'active_subscriber' ? (
                <Box>
                  <Typography sx={{ fontWeight: 700 }}>
                    Abonnement actif détecté.
                  </Typography>
                  <Typography sx={{ mt: 0.8, color: '#5f513d', fontSize: '0.95rem' }}>
                    {isSubscriptionBook
                      ? 'Débloquez ce livre avec votre abonnement pour consommer votre quota.'
                      : 'Vous pouvez acheter ce livre avec remise abonnement.'}
                  </Typography>
                  {isSubscriptionBook ? (
                    <Typography sx={{ mt: 0.9, color: '#5f513d', fontSize: '0.95rem' }}>
                      Quota {isAudiobook ? 'audio' : 'texte'}: <strong>{quotaUsed}</strong> / <strong>{quotaTotal}</strong>
                      {' '}({quotaRemaining} restant{quotaRemaining > 1 ? 's' : ''})
                    </Typography>
                  ) : null}
                  {/* Prix avec réduction abonné — uniquement si le livre est payant ET que la réduction est effective */}
                  {isPaidBook && basePriceCents > 0 && discountPercent > 0 && reducedPriceCents < basePriceCents ? (() => {
                    const pBase = formatCurrencyBoth(basePriceCents);
                    const pReduced = formatCurrencyBoth(reducedPriceCents);
                    return (
                      <Box sx={{ mt: 1.2, p: 1.5, borderRadius: '8px', bgcolor: 'rgba(181,101,29,0.06)', border: '1px solid rgba(181,101,29,0.15)' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                          <Typography component="span" sx={{ color: '#5f513d', fontSize: '0.9rem' }}>
                          {isSubscriptionBook ? 'Ou achetez-le' : 'Prix abonné'}:{' '}
                          <strong style={{ textDecoration: 'line-through', opacity: 0.55, fontWeight: 500 }}>{pBase.local}</strong>
                          {'  '}
                          <strong style={{ color: '#b5651d' }}>{pReduced.local}</strong>
                          {pReduced.eur ? <span style={{ color: '#9a8c7f', fontSize: '0.82em' }}> (≈ {pReduced.eur})</span> : ''}
                          </Typography>
                          <Chip label={`-${discountPercent}%`} size="small" sx={{ bgcolor: '#b5651d', color: '#fff', fontWeight: 700, fontSize: '0.72rem', height: 20 }} />
                        </Box>
                      </Box>
                    );
                  })() : isPaidBook && basePriceCents > 0 && discountPercent === 0 ? (() => {
                    const pBase = formatCurrencyBoth(basePriceCents);
                    return (
                      <Typography sx={{ mt: 0.9, color: '#5f513d', fontSize: '0.9rem' }}>
                        Prix: <strong>{pBase.local}</strong>{pBase.eur ? <span style={{ color: '#9a8c7f', fontSize: '0.85em' }}> (≈ {pBase.eur})</span> : ''}
                      </Typography>
                    );
                  })() : null}
                </Box>
              ) : (
                <Box>
                  <Typography sx={{ fontWeight: 700 }}>
                    Abonnement inactif ou expiré.
                  </Typography>
                  <Typography sx={{ mt: 0.8, color: '#5f513d', fontSize: '0.95rem' }}>
                    Prenez un abonnement pour accéder aux livres inclus et profiter de la réduction sur les livres payants.
                  </Typography>
                  {isPaidBook && basePriceCents > 0 ? (() => {
                    const p = formatCurrencyBoth(basePriceCents);
                    return (
                      <Typography sx={{ mt: 0.9, color: '#5f513d', fontSize: '0.95rem' }}>
                        Achat sans réduction: <strong>{p.local}</strong>{p.eur ? <span style={{ color: '#9a8c7f', fontSize: '0.85em' }}> (≈ {p.eur})</span> : ''}.
                      </Typography>
                    );
                  })() : null}
                  {hasAnySubscription ? (
                    <Typography sx={{ mt: 0.8, color: '#9c7e49', fontSize: '0.86rem' }}>
                      Votre abonnement précédent n’est plus actif.
                    </Typography>
                  ) : null}
                </Box>
              )}
            </Box>

            {accessActionError ? (
              <Alert severity="warning" sx={{ mt: 2, maxWidth: 760 }}>
                {accessActionError}
              </Alert>
            ) : null}
            {callbackNotice ? (
              <Alert severity="success" sx={{ mt: 2, maxWidth: 760 }}>
                {callbackNotice}
              </Alert>
            ) : null}

            <Box sx={{ mt: 2.5, py: 2, borderTop: '1px solid #f4efe7', borderBottom: '1px solid #f4efe7', display: { xs: 'none', md: 'flex' }, gap: 4, flexWrap: 'wrap' }}>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>{content.format ? content.format.toUpperCase() : '-'}</Typography>
                <Typography sx={{ mt: 0.35, color: '#9c7e49', fontSize: '0.64rem', letterSpacing: '0.1em' }}>FORMAT</Typography>
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>{formatLanguage(content.language)}</Typography>
                <Typography sx={{ mt: 0.35, color: '#9c7e49', fontSize: '0.64rem', letterSpacing: '0.1em' }}>LANGUE</Typography>
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>{isAudiobook ? formatDuration(content.duration_seconds) : '-'}</Typography>
                <Typography sx={{ mt: 0.35, color: '#9c7e49', fontSize: '0.64rem', letterSpacing: '0.1em' }}>AUDIO</Typography>
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>{formatSize(content.file_size_bytes)}</Typography>
                <Typography sx={{ mt: 0.35, color: '#9c7e49', fontSize: '0.64rem', letterSpacing: '0.1em' }}>TAILLE</Typography>
              </Box>
            </Box>

            {categories.length > 0 && (
              <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {categories.map((cat) => (
                  <Box
                    key={cat}
                    sx={{
                      px: 1.4,
                      py: 0.5,
                      borderRadius: 999,
                      bgcolor: '#fff2dd',
                      color: '#db8b0a',
                      fontSize: '0.76rem',
                      fontWeight: 700
                    }}
                  >
                    {cat}
                  </Box>
                ))}
              </Box>
            )}

            <Box sx={{ mt: 3.3 }}>
              <Typography sx={{ fontFamily: 'Newsreader, serif', fontWeight: 700, fontSize: { xs: '1.75rem', md: '2.2rem' }, lineHeight: 0.95 }}>Synopsis</Typography>
              <Typography sx={{ mt: 1.3, color: '#4d3f2b', fontSize: { xs: '0.98rem', md: '1.08rem' }, lineHeight: 1.7, maxWidth: 740, whiteSpace: 'pre-line' }}>
                {content.description || 'Aucune description disponible pour ce livre.'}
              </Typography>
            </Box>

            {isAudiobook && (
              <Box
                sx={{
                  mt: 3,
                  p: 2,
                  borderRadius: '16px',
                  bgcolor: '#f4efe7',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  maxWidth: 740
                }}
              >
                <Box sx={{ width: 48, height: 48, borderRadius: '50%', bgcolor: '#e2d6c2', border: '2px solid #f29e0d' }} />
                <Box>
                  <Typography sx={{ fontSize: '0.62rem', letterSpacing: '0.12em', color: '#9c7e49', fontWeight: 700 }}>VERSION AUDIO</Typography>
                  <Typography sx={{ fontSize: '1.14rem', fontWeight: 700 }}>
                    Narrateur: {content.narrator || 'Non renseigne'}
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#9c7e49' }}>Duree: {formatDuration(content.duration_seconds)}</Typography>
                </Box>
              </Box>
            )}

            <Box sx={{ mt: 3, maxWidth: 740 }}>
              <Typography sx={{ color: '#9c7e49', fontSize: '0.84rem' }}>
                Publication: {formatDate(content.published_at)}
                {content.rights_holder?.name ? ` - Editeur: ${content.rights_holder.name}` : ''}
              </Typography>
            </Box>

            {/* ── Avis des lecteurs ── */}
            <Box sx={{ mt: 4.2, maxWidth: 740 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 2 }}>
                <Typography sx={{ fontFamily: 'Newsreader, serif', fontWeight: 700, fontSize: '2.15rem' }}>Avis des lecteurs</Typography>
                {reviewStats && Number(reviewStats.review_count) > 0 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Rating value={Number(reviewStats.average_rating)} precision={0.1} readOnly size="small" sx={{ color: tokens.colors.primary }} />
                    <Typography sx={{ color: '#9c7e49', fontSize: '0.85rem' }}>
                      {Number(reviewStats.average_rating).toFixed(1)} ({reviewStats.review_count} avis)
                    </Typography>
                  </Box>
                )}
              </Box>

              {/* Formulaire d'avis (utilisateur connecté) */}
              {isAuthenticated && (
                <Box sx={{ bgcolor: '#faf6f0', borderRadius: '14px', p: 2.5, mb: 3 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', mb: 1.5, color: '#1c160d' }}>
                    {myReview ? 'Modifier mon avis' : 'Donner mon avis'}
                  </Typography>
                  {reviewError && <Alert severity="error" sx={{ mb: 1.5, borderRadius: '10px' }}>{reviewError}</Alert>}
                  {reviewSuccess && <Alert severity="success" sx={{ mb: 1.5, borderRadius: '10px' }}>{reviewSuccess}</Alert>}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                    <Typography sx={{ fontSize: '0.85rem', color: '#6d5a3e' }}>Note :</Typography>
                    <Rating
                      value={reviewForm.rating}
                      onChange={(_, v) => setReviewForm(f => ({ ...f, rating: v || 0 }))}
                      size="medium"
                      sx={{ color: tokens.colors.primary }}
                    />
                  </Box>
                  <TextField
                    placeholder="Partagez votre expérience de lecture… (optionnel)"
                    value={reviewForm.body}
                    onChange={e => setReviewForm(f => ({ ...f, body: e.target.value }))}
                    multiline
                    rows={3}
                    fullWidth
                    size="small"
                    sx={{ mb: 1.5, '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: '#fff' } }}
                  />
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      variant="contained"
                      size="small"
                      disabled={reviewSubmitting || reviewForm.rating === 0}
                      startIcon={reviewSubmitting ? <CircularProgress size={14} color="inherit" /> : null}
                      onClick={async () => {
                        setReviewError(''); setReviewSuccess(''); setReviewSubmitting(true);
                        try {
                          const res = await readingService.submitReview(id, reviewForm);
                          setMyReview(res.review);
                          setReviews(prev => {
                            const filtered = prev.filter(r => r.id !== res.review.id);
                            return [{ ...res.review, profiles: { full_name: 'Moi' } }, ...filtered];
                          });
                          setReviewSuccess('Votre avis a été enregistré.');
                        } catch (e) { setReviewError(e.message); }
                        finally { setReviewSubmitting(false); }
                      }}
                      sx={{ bgcolor: tokens.colors.primary, borderRadius: '9px', textTransform: 'none', fontWeight: 700, fontSize: '0.82rem', '&:hover': { bgcolor: '#9e5519' } }}
                    >
                      {myReview ? 'Mettre à jour' : 'Publier mon avis'}
                    </Button>
                    {myReview && (
                      <Button
                        size="small"
                        onClick={async () => {
                          try {
                            await readingService.deleteReview(id);
                            setMyReview(null);
                            setReviewForm({ rating: 0, body: '' });
                            setReviews(prev => prev.filter(r => r.user_id !== null));
                            setReviewSuccess('Avis supprimé.');
                          } catch (e) { setReviewError(e.message); }
                        }}
                        sx={{ textTransform: 'none', color: '#9c7e49', fontSize: '0.8rem' }}
                      >
                        Supprimer
                      </Button>
                    )}
                  </Box>
                </Box>
              )}

              {/* Liste des avis */}
              {reviewsLoading ? (
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <CircularProgress size={16} sx={{ color: tokens.colors.primary }} />
                  <Typography sx={{ color: '#9c7e49', fontSize: '0.85rem' }}>Chargement des avis…</Typography>
                </Box>
              ) : reviews.length === 0 ? (
                <Typography sx={{ color: '#9c7e49', fontSize: '0.9rem' }}>
                  Aucun avis pour ce contenu. Soyez le premier à donner votre avis !
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {reviews.map(r => (
                    <Box key={r.id} sx={{ display: 'flex', gap: 2 }}>
                      <Avatar sx={{ width: 36, height: 36, bgcolor: tokens.colors.primary, fontSize: '0.85rem', fontWeight: 700, flexShrink: 0 }}>
                        {(r.profiles?.full_name || '?').charAt(0).toUpperCase()}
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                          <Typography sx={{ fontWeight: 700, fontSize: '0.87rem', color: '#1c160d' }}>
                            {r.profiles?.full_name || 'Lecteur'}
                          </Typography>
                          <Rating value={r.rating} readOnly size="small" sx={{ color: tokens.colors.primary }} />
                          <Typography sx={{ color: '#9c7e49', fontSize: '0.75rem' }}>
                            {new Date(r.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </Typography>
                        </Box>
                        {r.body && (
                          <Typography sx={{ mt: 0.5, fontSize: '0.875rem', color: '#3d2e1a', lineHeight: 1.65 }}>
                            {r.body}
                          </Typography>
                        )}
                        <Divider sx={{ mt: 1.5, borderColor: '#f4efe7' }} />
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>

            {/* ── Dans le même genre ── */}
            {(relatedLoading || recommendations.sameGenre.length > 0) && (
              <Box sx={{ mt: 6.2 }}>
                <Typography sx={{ fontFamily: 'Newsreader, serif', fontWeight: 700, fontSize: '2.15rem' }}>Dans le même genre</Typography>
                {relatedLoading ? (
                  <Box sx={{ mt: 1.8, display: 'flex', gap: 2, overflowX: 'auto', pb: 1 }}>
                    {[1, 2, 3, 4].map((k) => (
                      <Box key={k} sx={{ minWidth: 140, flexShrink: 0 }}>
                        <Skeleton variant="rounded" sx={{ width: 140, height: 196, borderRadius: '12px' }} />
                        <Skeleton variant="text" width="80%" sx={{ mt: 0.8 }} />
                        <Skeleton variant="text" width="55%" />
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Box sx={{ mt: 1.8, display: 'flex', gap: 2, overflowX: 'auto', pb: 1 }}>
                    {recommendations.sameGenre.map((book) => (
                      <Box
                        key={book.id}
                        sx={{ minWidth: 140, flexShrink: 0, cursor: 'pointer' }}
                        onClick={() => navigate(`/catalogue/${book.id}`)}
                      >
                        <Box
                          sx={{
                            width: 140,
                            height: 196,
                            borderRadius: '12px',
                            overflow: 'hidden',
                            bgcolor: '#ece4d7',
                            boxShadow: '0 4px 10px rgba(0,0,0,0.08)',
                          }}
                        >
                          <Box
                            component="img"
                            src={book.cover_url || 'https://placehold.co/140x196/ece4d7/6b5840?text=Couverture'}
                            alt={book.title}
                            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </Box>
                        <Typography sx={{ mt: 0.8, fontSize: '0.8rem', fontWeight: 700, lineHeight: 1.3 }} noWrap>{book.title}</Typography>
                        <Typography sx={{ mt: 0.2, color: '#9c7e49', fontSize: '0.68rem' }} noWrap>{book.author}</Typography>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            )}

            {/* ── Vous aimerez aussi (même auteur) ── */}
            {!relatedLoading && recommendations.youllLike.length > 0 && (
              <Box sx={{ mt: 4 }}>
                <Typography sx={{ fontFamily: 'Newsreader, serif', fontWeight: 700, fontSize: '2.15rem' }}>Vous aimerez aussi</Typography>
                <Box sx={{ mt: 1.8, display: 'flex', gap: 2, overflowX: 'auto', pb: 1 }}>
                  {recommendations.youllLike.map((book) => (
                    <Box
                      key={book.id}
                      sx={{ minWidth: 140, flexShrink: 0, cursor: 'pointer' }}
                      onClick={() => navigate(`/catalogue/${book.id}`)}
                    >
                      <Box
                        sx={{
                          width: 140,
                          height: 196,
                          borderRadius: '12px',
                          overflow: 'hidden',
                          bgcolor: '#ece4d7',
                          boxShadow: '0 4px 10px rgba(0,0,0,0.08)',
                        }}
                      >
                        <Box
                          component="img"
                          src={book.cover_url || 'https://placehold.co/140x196/ece4d7/6b5840?text=Couverture'}
                          alt={book.title}
                          sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </Box>
                      <Typography sx={{ mt: 0.8, fontSize: '0.8rem', fontWeight: 700, lineHeight: 1.3 }} noWrap>{book.title}</Typography>
                      <Typography sx={{ mt: 0.2, color: '#9c7e49', fontSize: '0.68rem' }} noWrap>{book.author}</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        </Box>
      </Container>

      <Dialog
        open={paymentDialog.open}
        onClose={() => {
          if (!paymentDialog.providerBusy) setPaymentDialog({ open: false, providerBusy: '' });
        }}
        PaperProps={{ sx: { borderRadius: 3, maxWidth: 420, width: '100%' } }}
      >
        <DialogTitle sx={{ pb: 0.5, fontWeight: 800, color: '#1c160d' }}>
          Choisir le mode de paiement
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#7b6b51', fontSize: '0.92rem', mb: 2 }}>
            Sélectionnez votre méthode pour acheter ce livre.
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            <Button
              fullWidth
              variant="outlined"
              disabled={Boolean(paymentDialog.providerBusy)}
              onClick={() => handleChoosePaymentProvider('stripe')}
              sx={{
                borderRadius: 3,
                p: 1.5,
                textTransform: 'none',
                justifyContent: 'space-between',
                borderColor: '#5469d4',
                '&:hover': { bgcolor: '#f0f1ff', borderColor: '#4556c4' },
                '&.Mui-disabled': { borderColor: '#d0d0d0' },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                <Box component="span" sx={{ fontSize: '1.1rem' }}>💳</Box>
                <Box sx={{ textAlign: 'left' }}>
                  <Typography sx={{ fontWeight: 700, color: '#5469d4' }}>Carte bancaire</Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#8a8a8a' }}>Paiement sécurisé via Stripe</Typography>
                </Box>
              </Box>
              {paymentDialog.providerBusy === 'stripe' ? <CircularProgress size={18} sx={{ color: '#5469d4' }} /> : null}
            </Button>

            <Button
              fullWidth
              variant="outlined"
              disabled={Boolean(paymentDialog.providerBusy)}
              onClick={() => handleChoosePaymentProvider('flutterwave')}
              sx={{
                borderRadius: 3,
                p: 1.5,
                textTransform: 'none',
                justifyContent: 'space-between',
                borderColor: '#f9a825',
                '&:hover': { bgcolor: '#fff8e1', borderColor: '#f9a825' },
                '&.Mui-disabled': { borderColor: '#d0d0d0' },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                <Box component="span" sx={{ fontSize: '1.1rem' }}>📱</Box>
                <Box sx={{ textAlign: 'left' }}>
                  <Typography sx={{ fontWeight: 700, color: '#e65100' }}>Mobile Money</Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#8a8a8a' }}>Paiement via Flutterwave</Typography>
                </Box>
              </Box>
              {paymentDialog.providerBusy === 'flutterwave' ? <CircularProgress size={18} sx={{ color: '#e65100' }} /> : null}
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

      <Box sx={{ mt: 8, py: 4, borderTop: '1px solid #f4efe7' }}>
        <Container maxWidth="lg">
          <Typography sx={{ textAlign: 'center', color: '#9c7e49', fontSize: '0.75rem' }}>
            © 2026 Papyri. developpe par Afrik NoCode
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}
