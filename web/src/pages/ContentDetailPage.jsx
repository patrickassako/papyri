import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Skeleton,
  Typography
} from '@mui/material';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  BookmarkPlus,
  BookOpen,
  ChevronRight,
  Headphones,
  Play,
  Search,
  UserCircle2
} from 'lucide-react';
import { contentsService } from '../services/contents.service';
import * as authService from '../services/auth.service';
import { readingService } from '../services/reading.service';
import { subscriptionsService } from '../services/subscriptions.service';

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
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [content, setContent] = useState(null);
  const [relatedContents, setRelatedContents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [error, setError] = useState('');
  const [authContextLoading, setAuthContextLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [hasAnySubscription, setHasAnySubscription] = useState(false);
  const [accessInfo, setAccessInfo] = useState(null);
  const [usageInfo, setUsageInfo] = useState(null);
  const [accessActionLoading, setAccessActionLoading] = useState(false);
  const [accessActionError, setAccessActionError] = useState('');
  const [callbackNotice, setCallbackNotice] = useState('');

  useEffect(() => {
    const loadContent = async () => {
      setLoading(true);
      setError('');
      setRelatedContents([]);

      try {
        const data = await contentsService.getContentById(id);
        setContent(data);

        const firstCategory = data?.categories?.[0]?.slug;
        const relatedParams = {
          page: 1,
          limit: 6,
          sort: 'newest'
        };

        if (firstCategory) {
          relatedParams.category = firstCategory;
        } else if (data?.content_type) {
          relatedParams.type = data.content_type;
        }

        setRelatedLoading(true);
        const relatedResponse = await contentsService.getContents(relatedParams);
        const relatedData = Array.isArray(relatedResponse.data) ? relatedResponse.data : [];
        setRelatedContents(relatedData.filter((item) => item.id !== data.id).slice(0, 3));
      } catch (err) {
        console.error('Erreur chargement contenu:', err);
        setError('Impossible de charger ce contenu. Veuillez reessayer.');
      } finally {
        setRelatedLoading(false);
        setLoading(false);
      }
    };

    loadContent();
  }, [id]);

  useEffect(() => {
    let active = true;

    const processPaymentCallback = async () => {
      if (authContextLoading || !isAuthenticated) return;

      const status = searchParams.get('status');
      const txRef = searchParams.get('tx_ref');
      const transactionId = searchParams.get('transaction_id');

      if (!status || !txRef) return;

      if (status !== 'successful') {
        if (active) {
          setCallbackNotice('');
          setAccessActionError('Paiement non confirmé. Vous pouvez relancer le déblocage.');
          setSearchParams({}, { replace: true });
        }
        return;
      }

      if (!transactionId) {
        if (active) {
          setAccessActionError('transaction_id manquant dans le callback de paiement.');
          setSearchParams({}, { replace: true });
        }
        return;
      }

      try {
        const verified = await contentsService.verifyUnlockPayment(id, {
          transactionId,
          reference: txRef,
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
    navigate(`/read/${id}`);
  };

  const handleListen = () => {
    navigate(`/listen/${id}`);
  };

  const isAudiobook = content?.content_type === 'audiobook';
  const accessType = content?.access_type || 'subscription';
  const isSubscriptionBook = ['subscription', 'subscription_or_paid'].includes(accessType);
  const isPaidBook = accessType === 'paid' || accessType === 'subscription_or_paid' || Number(content?.price_cents || 0) > 0;

  const pricingCurrency = accessInfo?.pricing?.currency || content?.price_currency || 'USD';
  const basePriceCents = Number(accessInfo?.pricing?.base_price_cents ?? content?.price_cents ?? 0);
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
    if (scenario === 'active_subscriber') return isAudiobook ? 'Ajouter a la playlist' : 'Ajouter a ma liste';
    return isPaidBook ? 'Prendre un abonnement' : 'Voir les abonnements';
  }, [scenario, isPaidBook, isAudiobook]);

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

    setAccessActionLoading(true);
    try {
      const result = await contentsService.unlockContent(id);

      if (result.paymentRequired) {
        const paymentLink = result?.data?.payment?.payment_link;
        if (paymentLink) {
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
      <Box
        component="header"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          bgcolor: '#fcfaf8',
          borderBottom: '1px solid #f4efe7'
        }}
      >
        <Container
          maxWidth="lg"
          sx={{
            height: 72,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Typography
              sx={{
                fontFamily: 'Newsreader, Playfair Display, Georgia, serif',
                fontWeight: 700,
                fontSize: '1.08rem',
                cursor: 'pointer'
              }}
              onClick={() => navigate('/')}
            >
              Papyri
            </Typography>
            <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 3 }}>
              <Typography sx={{ fontSize: '0.9rem', color: '#58482f', cursor: 'pointer' }} onClick={() => navigate('/catalogue')}>
                Bibliotheque
              </Typography>
              <Typography sx={{ fontSize: '0.9rem', color: '#58482f' }}>Nouveautes</Typography>
              <Typography sx={{ fontSize: '0.9rem', color: '#58482f' }}>Ma liste</Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                display: { xs: 'none', sm: 'flex' },
                alignItems: 'center',
                gap: 1,
                px: 1.5,
                height: 38,
                borderRadius: 999,
                bgcolor: '#f4efe7',
                color: '#9c7e49'
              }}
            >
              <Search size={15} />
              <Typography sx={{ fontSize: '0.86rem' }}>Rechercher un livre...</Typography>
            </Box>
            {!hasActiveSubscription && (
              <Button
                variant="contained"
                sx={{
                  minWidth: 0,
                  height: 36,
                  borderRadius: 999,
                  px: 2,
                  bgcolor: '#f29e0d',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  '&:hover': { bgcolor: '#e18f08' }
                }}
                onClick={() => navigate(isAuthenticated ? '/subscription' : '/login')}
              >
                {isAuthenticated ? 'Mon espace' : 'Se connecter'}
              </Button>
            )}
            <UserCircle2 size={18} color="#6e5a3a" />
          </Box>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#9c7e49', fontSize: '0.95rem', mb: 4 }}>
          <Typography sx={{ fontSize: 'inherit', cursor: 'pointer' }} onClick={() => navigate('/catalogue')}>
            Bibliotheque
          </Typography>
          <ChevronRight size={14} />
          <Typography sx={{ fontSize: 'inherit' }}>{categories[0] || 'Detail'}</Typography>
          <ChevronRight size={14} />
          <Typography sx={{ fontSize: 'inherit', color: '#1c160d', fontWeight: 700 }}>{content.title}</Typography>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '360px minmax(0, 1fr)' },
            gap: { xs: 4, md: 8 },
            alignItems: 'start'
          }}
        >
          <Box sx={{ position: { md: 'sticky' }, top: { md: 100 } }}>
            <Box
              sx={{
                width: '100%',
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

            <Box sx={{ mt: 2.5, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
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

            <Box sx={{ mt: 2.5, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              <Button
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
                fontSize: { xs: '2.2rem', md: '4rem' },
                letterSpacing: '-0.02em',
                lineHeight: 0.95,
                maxWidth: '92%'
              }}
            >
              {content.title}
            </Typography>

            <Typography sx={{ mt: 1.6, color: '#e6970c', fontSize: '1.45rem', fontFamily: 'Newsreader, serif', fontWeight: 500 }}>
              Par {content.author}
            </Typography>

            <Box
              sx={{
                mt: 2.4,
                p: 2.2,
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
                  {isPaidBook && basePriceCents > 0 ? (
                    <Typography sx={{ mt: 0.9, color: '#5f513d', fontSize: '0.95rem' }}>
                      Prix: <strong>{formatMoney(basePriceCents, pricingCurrency)}</strong>. Avec un abonnement actif, vous bénéficiez de
                      {' '}<strong>{defaultDiscountPercent}%</strong> de réduction.
                    </Typography>
                  ) : null}
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
                  {isPaidBook && basePriceCents > 0 ? (
                    <Typography sx={{ mt: 0.9, color: '#5f513d', fontSize: '0.95rem' }}>
                      Prix public: <strong>{formatMoney(basePriceCents, pricingCurrency)}</strong>
                      {' '}• Prix abonné: <strong>{formatMoney(reducedPriceCents, pricingCurrency)}</strong>
                      {' '}({discountPercent}% de réduction)
                    </Typography>
                  ) : null}
                </Box>
              ) : (
                <Box>
                  <Typography sx={{ fontWeight: 700 }}>
                    Abonnement inactif ou expiré.
                  </Typography>
                  <Typography sx={{ mt: 0.8, color: '#5f513d', fontSize: '0.95rem' }}>
                    Prenez un abonnement pour accéder aux livres inclus et profiter de la réduction sur les livres payants.
                  </Typography>
                  {isPaidBook && basePriceCents > 0 ? (
                    <Typography sx={{ mt: 0.9, color: '#5f513d', fontSize: '0.95rem' }}>
                      Achat sans réduction: <strong>{formatMoney(basePriceCents, pricingCurrency)}</strong>.
                    </Typography>
                  ) : null}
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

            <Box sx={{ mt: 2.5, py: 2, borderTop: '1px solid #f4efe7', borderBottom: '1px solid #f4efe7', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
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
              <Typography sx={{ fontFamily: 'Newsreader, serif', fontWeight: 700, fontSize: '2.2rem', lineHeight: 0.95 }}>Synopsis</Typography>
              <Typography sx={{ mt: 1.3, color: '#4d3f2b', fontSize: '1.08rem', lineHeight: 1.7, maxWidth: 740, whiteSpace: 'pre-line' }}>
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

            <Box sx={{ mt: 4.2, maxWidth: 740 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Typography sx={{ fontFamily: 'Newsreader, serif', fontWeight: 700, fontSize: '2.15rem' }}>Avis des lecteurs</Typography>
              </Box>
              <Typography sx={{ mt: 1.2, color: '#6d5a3e', fontSize: '0.9rem' }}>
                Aucun endpoint avis n'est disponible pour ce contenu pour le moment.
              </Typography>
            </Box>

            <Box sx={{ mt: 6.2 }}>
              <Typography sx={{ fontFamily: 'Newsreader, serif', fontWeight: 700, fontSize: '2.15rem' }}>Vous aimerez aussi</Typography>

              {relatedLoading ? (
                <Box sx={{ mt: 1.8, display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0,1fr))', md: 'repeat(3, minmax(0,1fr))' }, gap: 2.5 }}>
                  {[1, 2, 3].map((key) => (
                    <Box key={key}>
                      <Skeleton variant="rounded" sx={{ width: '100%', aspectRatio: '3/4.2', borderRadius: '16px' }} />
                      <Skeleton variant="text" width="80%" />
                      <Skeleton variant="text" width="60%" />
                    </Box>
                  ))}
                </Box>
              ) : relatedContents.length === 0 ? (
                <Typography sx={{ mt: 1.4, color: '#6d5a3e', fontSize: '0.9rem' }}>
                  Aucun autre livre disponible pour ce filtre.
                </Typography>
              ) : (
                <Box sx={{ mt: 1.8, display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0,1fr))', md: 'repeat(3, minmax(0,1fr))' }, gap: 2.5 }}>
                  {relatedContents.map((book) => (
                    <Box key={book.id} sx={{ cursor: 'pointer' }} onClick={() => navigate(`/catalogue/${book.id}`)}>
                      <Box
                        sx={{
                          width: '100%',
                          aspectRatio: '3 / 4.2',
                          borderRadius: '16px',
                          overflow: 'hidden',
                          boxShadow: '0 8px 14px rgba(0, 0, 0, 0.1)',
                          bgcolor: '#ece4d7'
                        }}
                      >
                        <Box
                          component="img"
                          src={book.cover_url || 'https://placehold.co/300x420/ece4d7/6b5840?text=Couverture'}
                          alt={book.title}
                          sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </Box>
                      <Typography sx={{ mt: 1, fontSize: '0.86rem', fontWeight: 700 }}>{book.title}</Typography>
                      <Typography sx={{ mt: 0.25, color: '#9c7e49', fontSize: '0.7rem' }}>{book.author}</Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      </Container>

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
  const handleAddToList = async () => {
    try {
      if (!isAudiobook) {
        window.alert('Ajout à ma liste (ebook) à finaliser dans Epic 6.');
        return;
      }
      await readingService.addToAudioPlaylist(id);
      setAccessActionError('Livre audio ajoute a votre playlist.');
    } catch (err) {
      setAccessActionError(err?.message || 'Impossible d ajouter ce livre audio a votre playlist.');
    }
  };
