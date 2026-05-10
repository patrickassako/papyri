import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  Alert,
  Linking,
  Share,
  Modal,
} from 'react-native';
import { Text, ActivityIndicator, ProgressBar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { contentsService } from '../services/contents.service';
import BookCover from '../components/BookCover';
import { subscriptionService } from '../services/subscription.service';
import { detectCurrency, convertCents, formatMinorUnits } from '../services/currency.service';
import {
  isContentDownloaded,
  downloadContent,
  downloadAudiobookChapters,
  deleteDownloadedContent,
  getDownloadedContents,
  getOfflineEntry,
  isOnline,
  formatBytes,
} from '../services/offline.service';
import { readingService } from '../services/reading.service';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COVER_WIDTH = Math.min(SCREEN_WIDTH * 0.58, 260);

function formatDuration(seconds) {
  const value = Number(seconds || 0);
  if (!Number.isFinite(value) || value <= 0) return null;
  const h = Math.floor(value / 3600);
  const m = Math.floor((value % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

// formatMoney : wrapper sur formatMinorUnits du currency service
function formatMoney(cents, currency = 'EUR') {
  return formatMinorUnits(cents, currency);
}

function formatYear(dateString) {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;
  return String(date.getFullYear());
}

function mapContentPayload(raw) {
  const content = raw?.data || raw || {};
  const categories = Array.isArray(content.categories) ? content.categories : [];
  return {
    ...content,
    categories,
  };
}

export default function ContentDetailScreen({ route, navigation }) {
  const { contentId } = route.params || {};
  const { t } = useTranslation();

  const [content, setContent] = useState(null);
  const [access, setAccess] = useState(null);
  const [usageData, setUsageData] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [userCurrency, setUserCurrency] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState(null);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [recommendations, setRecommendations] = useState({ sameGenre: [], youllLike: [] });

  // Favoris
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);

  // Offline download state
  const [downloadState, setDownloadState] = useState('idle'); // 'idle' | 'downloading' | 'downloaded'
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadSize, setDownloadSize] = useState(null);
  const [downloadExpiry, setDownloadExpiry] = useState(null);

  // Modal de choix : crédit / Stripe / Flutterwave
  const [paymentModal, setPaymentModal] = useState({ open: false, busy: '' });

  // Détecter la devise de l'utilisateur au montage (ipapi.co → fuseau → locale → EUR)
  useEffect(() => {
    detectCurrency().then(({ currency }) => setUserCurrency(currency)).catch(() => {});
  }, []);

  // Charger le statut favori
  useEffect(() => {
    if (!contentId) return;
    readingService.getReadingList()
      .then((items) => setIsFavorite(items.some((item) => item.id === contentId)))
      .catch(() => {});
  }, [contentId]);

  const toggleFavorite = async () => {
    if (favoriteLoading) return;
    setFavoriteLoading(true);
    try {
      if (isFavorite) {
        await readingService.removeFromReadingList(contentId);
        setIsFavorite(false);
      } else {
        await readingService.addToReadingList(contentId);
        setIsFavorite(true);
      }
    } catch (err) {
      Alert.alert(t('common.error'), err.message || t('contentDetail.favoritesError'));
    } finally {
      setFavoriteLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;

    const refreshAccessAndUsage = async () => {
      const [accessResult, usageResult] = await Promise.allSettled([
        contentsService.getContentAccess(contentId),
        subscriptionService.getMyUsage(),
      ]);

      if (accessResult.status === 'fulfilled' && alive) {
        setAccess(accessResult.value || null);
      }
      if (usageResult.status === 'fulfilled' && alive) {
        setUsageData(usageResult.value || null);
      }
    };

    const loadFromOffline = async () => {
      const offlineEntry = await getOfflineEntry(contentId);
      if (offlineEntry && alive) {
        setContent({
          id: contentId,
          title: offlineEntry.title || t('contentDetail.fallbackTitle'),
          author: offlineEntry.author || '',
          cover_url: offlineEntry.cover_url || null,
          content_type: offlineEntry.type || 'audiobook',
          access_type: 'subscription',
          price_cents: 0,
        });
        setAccess({ can_read: true, unlocked: true, access_type: 'subscription' });
        return true;
      }
      return false;
    };

    const isNetworkError = (err) => {
      const msg = err?.message || '';
      return msg.includes('Network request failed')
        || msg.includes('network')
        || msg.includes('fetch')
        || msg.includes('ENOTFOUND')
        || msg.includes('ECONNREFUSED')
        || msg.includes('timeout');
    };

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        // Tenter l'API en ligne
        const [contentResult, subscriptionResult] = await Promise.allSettled([
          contentsService.getContentById(contentId),
          subscriptionService.getCurrentSubscription(),
        ]);

        if (contentResult.status !== 'fulfilled') {
          // Erreur API → fallback hors-ligne si disponible
          if (isNetworkError(contentResult.reason)) {
            const loaded = await loadFromOffline();
            if (loaded) return;
          }
          throw contentResult.reason || new Error(t('contentDetail.loadError'));
        }

        const normalized = mapContentPayload(contentResult.value);
        if (alive) setContent(normalized);

        if (subscriptionResult.status === 'fulfilled' && alive) {
          setSubscription(subscriptionResult.value || null);
        }

        await refreshAccessAndUsage();

        // Load recommendations non-blocking
        contentsService.getRecommendations(contentId).then((recs) => {
          if (alive) setRecommendations(recs);
        }).catch(() => {});
      } catch (err) {
        console.error('Error loading content detail:', err);
        // Dernière chance : tenter le hors-ligne
        if (isNetworkError(err)) {
          const loaded = await loadFromOffline();
          if (loaded) return;
          if (alive) setError(t('contentDetail.offlineLoadError'));
        } else {
          if (alive) setError(t('contentDetail.loadError'));
        }
      } finally {
        if (alive) setLoading(false);
      }
    };

    if (contentId) {
      load();
    } else {
      setError(t('contentDetail.notFound'));
      setLoading(false);
    }

    return () => {
      alive = false;
    };
  }, [contentId]);

  // Check if already downloaded + load size/expiry
  useEffect(() => {
    if (!contentId) return;
    getDownloadedContents().then((list) => {
      const entry = list.find((e) => e.contentId === contentId);
      if (entry) {
        setDownloadState('downloaded');
        if (entry.fileSize) setDownloadSize(entry.fileSize);
        if (entry.expiresAt) setDownloadExpiry(new Date(entry.expiresAt));
      }
    });
  }, [contentId]);

  const isAudiobook = useMemo(
    () => String(content?.content_type || '').toLowerCase() === 'audiobook',
    [content?.content_type]
  );

  const hasActiveSubscription = useMemo(
    () =>
      access?.has_active_subscription === true
      || String(subscription?.status || '').toLowerCase() === 'active',
    [access?.has_active_subscription, subscription?.status]
  );

  const isLocked = useMemo(() => {
    if (access && typeof access.can_read === 'boolean') {
      return !access.can_read;
    }

    if (!content) return true;

    const accessType = String(content.access_type || 'subscription').toLowerCase();
    const subscriptionRequired = accessType === 'subscription' || accessType === 'subscription_or_paid';

    if (content.premium_only) return !hasActiveSubscription;
    if (subscriptionRequired) return !hasActiveSubscription;

    return false;
  }, [access, content, hasActiveSubscription]);

  const ratingValue = Number(content?.rating || 0);

  const chapterItems = useMemo(() => {
    if (!isAudiobook) return [];

    const rawChapters = Array.isArray(content?.chapters) ? content.chapters : [];
    if (rawChapters.length > 0) {
      return rawChapters.map((ch, idx) => ({
        id: ch.id || `${idx}`,
        title: ch.title || `Chapitre ${idx + 1}`,
        duration: ch.duration_seconds || ch.duration || null,
      }));
    }

    return [
      { id: 'c1', title: t('contentDetail.chapterIntro'), duration: 1800 },
      { id: 'c2', title: t('contentDetail.chapterDeparture'), duration: 2400 },
      { id: 'c3', title: t('contentDetail.chapterReturn'), duration: 2600 },
    ];
  }, [isAudiobook, content?.chapters]);

  const handleSubscribe = () => {
    Alert.alert(t('contentDetail.subscriptionRequiredTitle'), t('contentDetail.subscriptionRequiredBody'));
    navigation.navigate('Catalog');
  };

  const refreshAccessAndUsage = async () => {
    try {
      const [accessResult, usageResult] = await Promise.allSettled([
        contentsService.getContentAccess(content.id || contentId),
        subscriptionService.getMyUsage(),
      ]);

      if (accessResult.status === 'fulfilled') {
        setAccess(accessResult.value || null);
      }
      if (usageResult.status === 'fulfilled') {
        setUsageData(usageResult.value || null);
      }
    } catch (err) {
      console.error('Refresh access error:', err);
    }
  };

  const handleUnlockedAction = () => {
    if (isAudiobook) {
      navigation.navigate('AudioPlayer', { contentId: content.id || contentId });
      return;
    }
    // All ebook formats (epub, pdf) go to BookReaderScreen (WebView-based)
    navigation.navigate('BookReader', { contentId: content.id || contentId });
  };

  const handleLockedPrimaryAction = async () => {
    const denialCode = access?.denial?.code;
    const canPay = access?.is_purchasable === true;
    const accessType = access?.access_type || content?.access_type || 'subscription';

    // Pas d'abo et catalogue subscription-only → router vers Pricing
    if (denialCode === 'NO_ACTIVE_SUBSCRIPTION' && !canPay) {
      handleSubscribe();
      return;
    }

    // Livre payant ou hybride → ouvrir le modal (crédit / Stripe / Flutterwave)
    const isPayablePath = accessType === 'paid' || accessType === 'subscription_or_paid' || canPay;
    if (isPayablePath) {
      setPaymentModal({ open: true, busy: '' });
      return;
    }

    // Catalogue subscription pur avec abo actif → unlock direct
    try {
      setUnlocking(true);
      const result = await contentsService.unlockContent(content.id || contentId);
      if (result?.success) {
        Alert.alert(t('contentDetail.contentUnlocked'), t('contentDetail.accessGrantedShort'));
        await refreshAccessAndUsage();
      }
    } catch (err) {
      const status = err?.response?.status;
      const data = err?.response?.data || {};
      const message = data?.error?.message || t('contentDetail.unlockFailed');
      if (status === 403 && data?.error?.code === 'UNLOCK_NOT_ALLOWED') {
        handleSubscribe();
        return;
      }
      Alert.alert(t('contentDetail.accessDenied'), message);
    } finally {
      setUnlocking(false);
    }
  };

  // Modal handlers : utiliser un crédit (gratuit, débloque immédiatement)
  const handleUseCredit = async () => {
    setPaymentModal((s) => ({ ...s, busy: 'credit' }));
    try {
      const result = await contentsService.unlockContent(content.id || contentId, { useCredit: true });
      if (result?.success && !result?.paymentRequired) {
        const lifetime = result?.data?.lifetime_access !== false;
        setPaymentModal({ open: false, busy: '' });
        Alert.alert(
          t('contentDetail.contentUnlocked'),
          lifetime
            ? t('contentDetail.creditUsedLifetime')
            : t('contentDetail.creditUsedSubscription')
        );
        await refreshAccessAndUsage();
      } else {
        // Plus de crédit dispo (race) → l'utilisateur doit payer
        setPaymentModal((s) => ({ ...s, busy: '' }));
        Alert.alert(t('contentDetail.noCreditTitle'), t('contentDetail.noCreditBody'));
      }
    } catch (err) {
      setPaymentModal((s) => ({ ...s, busy: '' }));
      Alert.alert(t('common.error'), err?.message || t('contentDetail.creditUseFailed'));
    }
  };

  // Modal handlers : payer via Stripe ou Flutterwave (force useCredit: false)
  const handleChooseProvider = async (provider) => {
    setPaymentModal((s) => ({ ...s, busy: provider }));
    try {
      const result = await contentsService.unlockContent(content.id || contentId, {
        provider,
        useCredit: false,
      });
      if (result?.paymentRequired) {
        const paymentLink = result?.data?.payment?.payment_link;
        if (paymentLink) {
          setPaymentModal({ open: false, busy: '' });
          await Linking.openURL(paymentLink);
        } else {
          throw new Error(t('contentDetail.paymentLinkUnavailable'));
        }
      } else if (result?.success) {
        // Inattendu mais on gère
        setPaymentModal({ open: false, busy: '' });
        await refreshAccessAndUsage();
      }
    } catch (err) {
      setPaymentModal((s) => ({ ...s, busy: '' }));
      Alert.alert(t('contentDetail.paymentError'), err?.message || t('contentDetail.paymentInitFailed'));
    }
  };

  const handlePrimaryAction = () => {
    if (canOpenContent) {
      handleUnlockedAction();
      return;
    }
    handleLockedPrimaryAction();
  };

  const handleDownload = async () => {
    if (downloadState === 'downloading') return;

    // If already downloaded, confirm delete
    if (downloadState === 'downloaded') {
      Alert.alert(
        t('contentDetail.deleteFile'),
        t('contentDetail.deleteOfflineConfirm'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.delete'),
            style: 'destructive',
            onPress: async () => {
              await deleteDownloadedContent(content.id || contentId).catch(() => {});
              setDownloadState('idle');
              setDownloadSize(null);
              setDownloadExpiry(null);
            },
          },
        ],
      );
      return;
    }

    try {
      setDownloadState('downloading');
      setDownloadProgress(0);

      const cid = content.id || contentId;

      if (isAudiobook) {
        // ── Audiobook : télécharger tous les chapitres ─────────────────────
        const chaptersData = await readingService.getChapters(cid);
        const chapterList = chaptersData?.chapters || [];

        if (chapterList.length === 0) {
          // Pas de chapitres → télécharger le fichier principal unique
          const payload = await contentsService.getContentFileUrl(cid);
          const signedUrl = payload?.data?.url || payload?.url || null;
          if (!signedUrl) {
            setDownloadState('idle');
            Alert.alert(t('contentDetail.downloadTitle'), t('contentDetail.urlUnavailable'));
            return;
          }
          await downloadContent({
            contentId: cid,
            url: signedUrl,
            format: 'audio',
            title: content.title || t('contentDetail.fallbackTitle'),
            author: content.author || '',
            cover_url: content.cover_url || '',
            type: 'audiobook',
            onProgress: (pct) => setDownloadProgress(pct / 100),
          });
        } else {
          // Télécharger chaque chapitre
          await downloadAudiobookChapters({
            contentId: cid,
            chapters: chapterList,
            getChapterUrl: async (chapterId) => {
              const data = await readingService.getChapterFileUrl(cid, chapterId);
              return data?.url || null;
            },
            title: content.title || t('contentDetail.fallbackTitle'),
            author: content.author || '',
            cover_url: content.cover_url || '',
            duration_seconds: content.duration_seconds || 0,
            onProgress: (pct) => setDownloadProgress(pct / 100),
          });
        }
      } else {
        // ── Ebook/PDF : télécharger le fichier unique ──────────────────────
        const payload = await contentsService.getContentFileUrl(cid);
        const signedUrl = payload?.data?.url || payload?.url || null;
        if (!signedUrl) {
          setDownloadState('idle');
          Alert.alert(t('contentDetail.downloadTitle'), t('contentDetail.urlUnavailable'));
          return;
        }
        await downloadContent({
          contentId: cid,
          url: signedUrl,
          format: content.format || 'epub',
          title: content.title || t('contentDetail.fallbackTitle'),
          author: content.author || '',
          cover_url: content.cover_url || '',
          type: 'ebook',
          onProgress: (pct) => setDownloadProgress(pct / 100),
        });
      }

      // Get file size + expiry from stored metadata
      const allDownloads = await getDownloadedContents();
      const entry = allDownloads.find((e) => e.contentId === (content.id || contentId));
      if (entry?.fileSize) setDownloadSize(entry.fileSize);
      if (entry?.expiresAt) setDownloadExpiry(new Date(entry.expiresAt));

      setDownloadState('downloaded');
      setDownloadProgress(1);
    } catch (err) {
      console.error('Download error:', err);
      setDownloadState('idle');
      Alert.alert(t('common.error'), t('contentDetail.downloadFailed'));
    }
  };

  const handlePlaylist = () => {
    Alert.alert(t('contentDetail.playlist'), t('contentDetail.playlistAdded'));
  };

  const handleShare = async () => {
    try {
      const title = content?.title || t('contentDetail.shareDefaultTitle');
      const author = content?.author ? t('contentDetail.byAuthor', { author: content.author }) : '';
      const bookUrl = `https://www.papyrihub.net/catalogue/${contentId}`;
      await Share.share({
        title,
        message: t('contentDetail.shareMessage', { title, author, url: bookUrl }),
        url: bookUrl,
      });
    } catch {
      // user dismissed share sheet — no action needed
    }
  };

  const handleReport = () => {
    const subject = encodeURIComponent(t('contentDetail.reportSubject', { title: content?.title || contentId }));
    const body = encodeURIComponent(
      t('contentDetail.reportBody', { title: content?.title || '', id: content?.id || contentId })
    );
    Linking.openURL(`mailto:contact@papyrihub.com?subject=${subject}&body=${body}`).catch(() =>
      Alert.alert(t('common.error'), t('contentDetail.mailClientError'))
    );
  };

  const denialCode = access?.denial?.code;
  // Prefer i18n message based on denial code; fallback to backend message (always FR).
  const denialMessage = denialCode
    ? t(`contentDetail.denial.${denialCode}`, { defaultValue: access?.denial?.message || '' })
    : (access?.denial?.message || null);

  // Usage data
  const activeUsage = usageData?.usage || null;
  const bonuses = usageData?.bonuses || {};
  const usedCount = Number(isAudiobook ? activeUsage?.audio_unlocked_count : activeUsage?.text_unlocked_count);
  const quotaCount = Number(isAudiobook ? activeUsage?.audio_quota : activeUsage?.text_quota);
  const hasQuota = Number.isFinite(quotaCount) && quotaCount > 0;
  const remainingQuota = hasQuota ? Math.max(0, quotaCount - (Number.isFinite(usedCount) ? usedCount : 0)) : 0;
  const bonusRemaining = Math.max(0, Number(isAudiobook ? bonuses?.audio || 0 : bonuses?.text || 0) + Number(bonuses?.flex || 0));

  // Crédits disponibles pour le profil actif (source de vérité backend)
  const availableCredits = Number(usageData?.bonusAvailableTotal ?? usageData?.bonus_available_total ?? bonusRemaining ?? 0);
  const creditsLifetime = Boolean(usageData?.subscription?.plan_snapshot?.creditsGrantLifetimeAccess);

  // ── Access type — mirror web logic exactly ──────────────────────────────
  // Backend returns: 'subscription' | 'paid' | 'subscription_or_paid'
  const accessType = access?.access_type || content?.access_type || 'subscription';
  const isSubscriptionBook = ['subscription', 'subscription_or_paid'].includes(accessType);
  const isPaidBook = accessType === 'paid' || accessType === 'subscription_or_paid' || Number(content?.price_cents || 0) > 0;

  // canOpenContent = user can open reader right now (quota consumed OR paid unlock)
  const isUnlocked = Boolean(access?.unlocked);
  const canOpenContent = Boolean(access?.can_read || isUnlocked);

  // Pricing — source DB (EUR) puis conversion vers la devise de l'utilisateur
  const dbCurrency = access?.pricing?.currency ?? content?.localized_price?.currency ?? content?.price_currency ?? 'EUR';
  const dbBasePriceCents = Number(access?.pricing?.base_price_cents ?? content?.localized_price?.price_cents ?? content?.price_cents ?? 0);
  const discountPercent = Number(access?.pricing?.discount_percent ?? 0);
  const markupPercent = Number(access?.pricing?.markup_percent ?? 0);
  const dbReducedPriceCents = Number(
    access?.pricing?.final_price_cents ?? Math.max(0, Math.round(dbBasePriceCents * (100 - discountPercent) / 100))
  );

  // Devise effective : celle du backend si géo-ajustée, sinon celle de l'utilisateur
  const pricingCurrency = userCurrency ?? dbCurrency;
  // Convertir depuis la devise DB vers la devise utilisateur
  const basePriceCents = convertCents(dbBasePriceCents, dbCurrency, pricingCurrency);
  const reducedPriceCents = convertCents(dbReducedPriceCents, dbCurrency, pricingCurrency);

  // ── Primary action label — mirror web ──────────────────────────────────
  const primaryActionLabel = (() => {
    if (canOpenContent) return isAudiobook ? t('contentDetail.primaryListen') : t('contentDetail.primaryRead');
    if (hasActiveSubscription) {
      if (accessType === 'paid') {
        return basePriceCents > 0
          ? t('contentDetail.primaryBuyWithPrice', { price: formatMoney(reducedPriceCents || basePriceCents, pricingCurrency) })
          : t('contentDetail.primaryBuy');
      }
      return t('contentDetail.primaryUnlock');
    }
    if (isPaidBook) {
      // Non-subscribers pay reducedPriceCents which the backend computes as
      // base + markup (currently +30%). Falling back to base if final missing.
      const priceForNonSub = reducedPriceCents > 0 ? reducedPriceCents : basePriceCents;
      return priceForNonSub > 0
        ? t('contentDetail.primaryBuyWithPrice', { price: formatMoney(priceForNonSub, pricingCurrency) })
        : t('contentDetail.primaryBuy');
    }
    return t('contentDetail.primarySubscribe');
  })();

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#B5651D" />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !content) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#171412" />
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error || t('contentDetail.notFound')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#171412" />
        </TouchableOpacity>

        <View style={styles.topRight}>
          {hasActiveSubscription && (
            <View style={styles.premiumPill}>
              <MaterialCommunityIcons name="check-decagram" size={13} color="#B5651D" />
              <Text style={styles.premiumPillText}>{t('contentDetail.subscribed')}</Text>
            </View>
          )}
          <TouchableOpacity style={styles.iconButton} onPress={toggleFavorite} disabled={favoriteLoading}>
            <MaterialCommunityIcons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={22}
              color={isFavorite ? '#B5651D' : '#171412'}
            />
          </TouchableOpacity>
          {!isLocked && (
            <TouchableOpacity style={styles.iconButton} onPress={handleShare}>
              <MaterialCommunityIcons name="share-variant-outline" size={22} color="#171412" />
            </TouchableOpacity>
          )}
          {!isLocked && (
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => Alert.alert(
                t('contentDetail.options'),
                null,
                [
                  { text: t('contentDetail.reportProblem'), onPress: handleReport },
                  { text: t('common.cancel'), style: 'cancel' },
                ]
              )}
            >
              <MaterialCommunityIcons name="dots-horizontal" size={22} color="#171412" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.coverArea}>
          <View style={styles.coverShadow} />
          <View style={styles.coverBox}>
            <BookCover
              uri={content.cover_url}
              title={content.title}
              style={styles.coverImage}
              resizeMode="cover"
            />
            {isAudiobook && !isLocked && (
              <View style={styles.playOverlay}>
                <View style={styles.playCircle}>
                  <MaterialCommunityIcons name="play" size={42} color="#fff" />
                </View>
              </View>
            )}
            {isLocked && (
              <View style={styles.lockOverlay}>
                <MaterialCommunityIcons name="lock" size={38} color="rgba(255,255,255,0.55)" />
              </View>
            )}
          </View>
        </View>

        <View style={styles.identityArea}>
          <Text style={styles.title}>{content.title || t('common.unknownTitle')}</Text>
          <Text style={styles.author}>{content.author || t('common.unknownAuthor')}</Text>

          {!isAudiobook && ratingValue > 0 && (
            <View style={styles.ratingRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <MaterialCommunityIcons
                  key={star}
                  name={star <= Math.floor(ratingValue) ? 'star' : 'star-outline'}
                  size={16}
                  color="#D4A017"
                />
              ))}
              <Text style={styles.ratingText}>{ratingValue.toFixed(1)}</Text>
            </View>
          )}
        </View>

        <View style={styles.chipsRow}>
          {!!content.language && (
            <View style={styles.chip}>
              <MaterialCommunityIcons name="translate" size={14} color="#B5651D" />
              <Text style={styles.chipText}>{String(content.language).toUpperCase()}</Text>
            </View>
          )}
          {!!content.categories?.[0]?.name && (
            <View style={styles.chip}>
              <MaterialCommunityIcons name="book-open-variant" size={14} color="#B5651D" />
              <Text style={styles.chipText}>{String(content.categories[0].name).toUpperCase()}</Text>
            </View>
          )}
          {isAudiobook && !!content.duration_seconds && (
            <View style={styles.chip}>
              <MaterialCommunityIcons name="clock-outline" size={14} color="#B5651D" />
              <Text style={styles.chipText}>{formatDuration(content.duration_seconds)}</Text>
            </View>
          )}
          {!isAudiobook && !!content.page_count && (
            <View style={styles.chip}>
              <MaterialCommunityIcons name="file-document-outline" size={14} color="#B5651D" />
              <Text style={styles.chipText}>{content.page_count} PAGES</Text>
            </View>
          )}
          {(() => {
            const priceCents = content.localized_price?.price_cents ?? content.price_cents;
            const currency = content.localized_price?.currency || content.price_currency || 'USD';
            if (!priceCents || Number(priceCents) <= 0) return null;
            return (
              <View style={[styles.chip, { backgroundColor: '#D4A01722', borderColor: '#D4A017' }]}>
                <MaterialCommunityIcons name="tag-outline" size={14} color="#D4A017" />
                <Text style={[styles.chipText, { color: '#D4A017', fontWeight: 'bold' }]}>
                  {formatMoney(priceCents, currency)}
                </Text>
              </View>
            );
          })()}
        </View>

        {/* ── Access info card — même logique que la page web ── */}
        <View style={styles.accessCard}>
          {canOpenContent ? (
            <View style={styles.accessCardHeader}>
              <MaterialCommunityIcons name="check-decagram" size={15} color="#1F7A39" />
              <Text style={[styles.accessCardTitle, { color: '#1F7A39' }]}>
                {isPaidBook && !isSubscriptionBook ? t('contentDetail.purchasedContent') : t('contentDetail.accessGranted')}
              </Text>
            </View>
          ) : hasActiveSubscription ? (
            <>
              <View style={styles.accessCardHeader}>
                <MaterialCommunityIcons name="check-decagram" size={15} color="#B5651D" />
                <Text style={styles.accessCardTitle}>{t('contentDetail.activeSubscription')}</Text>
              </View>
              <Text style={styles.accessCardBody}>
                {isSubscriptionBook
                  ? t('contentDetail.readingIncluded')
                  : t('contentDetail.creditOrBuyDiscount')}
              </Text>
              {isPaidBook && basePriceCents > 0 ? (
                markupPercent > 0 && reducedPriceCents > basePriceCents ? (
                  <View style={styles.priceRow}>
                    <Text style={styles.priceReduced}>{formatMoney(reducedPriceCents, pricingCurrency)}</Text>
                    <Text style={styles.priceBase}>({formatMoney(basePriceCents, pricingCurrency)} {t('contentDetail.subscriberPrice', { defaultValue: 'abonné' })})</Text>
                    <View style={[styles.discountPill, { backgroundColor: '#fbe9e7' }]}>
                      <Text style={[styles.discountPillText, { color: '#c84315' }]}>+{markupPercent}%</Text>
                    </View>
                  </View>
                ) : discountPercent > 0 && reducedPriceCents < basePriceCents ? (
                  <View style={styles.priceRow}>
                    <Text style={styles.priceBase}>{formatMoney(basePriceCents, pricingCurrency)}</Text>
                    <Text style={styles.priceReduced}>{formatMoney(reducedPriceCents, pricingCurrency)}</Text>
                    <View style={styles.discountPill}>
                      <Text style={styles.discountPillText}>-{discountPercent}%</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.accessCardMeta}>
                    {t('contentDetail.priceLabel')}<Text style={{ fontWeight: '700' }}>{formatMoney(reducedPriceCents || basePriceCents, pricingCurrency)}</Text>
                  </Text>
                )
              ) : null}
            </>
          ) : (
            <>
              <View style={styles.accessCardHeader}>
                <MaterialCommunityIcons name="crown-outline" size={15} color="#B5651D" />
                <Text style={styles.accessCardTitle}>
                  {subscription ? t('contentDetail.inactiveSubscription') : t('contentDetail.notSubscribed')}
                </Text>
              </View>
              <Text style={styles.accessCardBody}>
                {isSubscriptionBook
                  ? t('contentDetail.subscribePromptSubscription')
                  : t('contentDetail.subscribePromptPaid')}
              </Text>
              {isPaidBook && basePriceCents > 0 ? (
                <Text style={styles.accessCardMeta}>
                  {t('contentDetail.buyWithoutDiscount')}
                  <Text style={{ fontWeight: '700' }}>{formatMoney(basePriceCents, pricingCurrency)}</Text>
                </Text>
              ) : null}
            </>
          )}
        </View>

        <View style={styles.actionsArea}>
          <TouchableOpacity
            style={[styles.primaryButton, unlocking ? styles.primaryButtonDisabled : null]}
            onPress={handlePrimaryAction}
            disabled={unlocking}
          >
            <MaterialCommunityIcons
              name={canOpenContent
                ? (isAudiobook ? 'play-circle' : 'book-open-variant')
                : (accessType === 'paid' || (isPaidBook && !hasActiveSubscription)) ? 'tag'
                  : hasActiveSubscription ? 'lock-open-outline'
                  : 'crown-outline'}
              size={20}
              color="#fff"
            />
            <Text style={styles.primaryButtonText}>
              {unlocking ? t('contentDetail.primaryUnlocking') : primaryActionLabel}
            </Text>
          </TouchableOpacity>

          {canOpenContent && (
            <View>
              <View style={styles.secondaryRow}>
                <TouchableOpacity
                  style={[
                    styles.secondaryButton,
                    downloadState === 'downloaded' && styles.secondaryButtonDone,
                    downloadState === 'downloading' && styles.secondaryButtonDisabled,
                  ]}
                  onPress={handleDownload}
                  disabled={downloadState === 'downloading'}
                >
                  <MaterialCommunityIcons
                    name={downloadState === 'downloaded' ? 'check-circle' : 'download'}
                    size={18}
                    color={downloadState === 'downloaded' ? '#4caf50' : '#B5651D'}
                  />
                  <Text style={[
                    styles.secondaryButtonText,
                    downloadState === 'downloaded' && { color: '#4caf50' },
                  ]}>
                    {downloadState === 'downloading'
                      ? `${Math.round(downloadProgress * 100)}%`
                      : downloadState === 'downloaded'
                        ? [
                            downloadSize ? t('contentDetail.downloadOfflineSize', { size: formatBytes(downloadSize) }) : t('contentDetail.downloadOffline'),
                            downloadExpiry
                              ? t('contentDetail.downloadExpiry', { date: downloadExpiry.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) })
                              : '',
                          ].join('')
                        : t('contentDetail.downloadAction')}
                  </Text>
                </TouchableOpacity>

                {isAudiobook && (
                  <TouchableOpacity style={styles.secondaryButton} onPress={handlePlaylist}>
                    <MaterialCommunityIcons name="playlist-plus" size={18} color="#B5651D" />
                    <Text style={styles.secondaryButtonText}>{t('contentDetail.playlist')}</Text>
                  </TouchableOpacity>
                )}
              </View>

              {downloadState === 'downloading' && (
                <ProgressBar
                  progress={downloadProgress}
                  color="#B5651D"
                  style={styles.downloadProgressBar}
                />
              )}
            </View>
          )}
        </View>

        {isLocked && !!denialMessage && (
          <View style={styles.lockedLabelWrap}>
            <Text style={styles.lockedHintText}>{denialMessage}</Text>
          </View>
        )}

        {!canOpenContent && bonusRemaining > 0 && hasActiveSubscription && (
          <View style={styles.card}>
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>{t('contentDetail.bonusAvailable')}</Text>
              <Text style={styles.metaValue}>{bonusRemaining}</Text>
            </View>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{isAudiobook ? t('contentDetail.synopsis') : t('contentDetail.aboutBook')}</Text>
          <View>
            <Text
              style={[styles.description, isLocked && !descriptionExpanded ? styles.descriptionLocked : null]}
              numberOfLines={descriptionExpanded ? undefined : (isLocked ? 5 : 4)}
            >
              {content.description || t('contentDetail.noDescription')}
            </Text>
            {isLocked && !descriptionExpanded && (
              <LinearGradient
                pointerEvents="none"
                colors={['rgba(255,253,245,0)', '#FFFDF5']}
                style={styles.descriptionFade}
              />
            )}
          </View>
          <TouchableOpacity onPress={() => setDescriptionExpanded((v) => !v)}>
            <Text style={styles.linkText}>{descriptionExpanded ? t('contentDetail.seeLess') : t('contentDetail.seeMore')}</Text>
          </TouchableOpacity>
        </View>

        {isAudiobook && !isLocked && (
          <View style={styles.card}>
            <View style={styles.narrationHead}>
              <View style={styles.narratorAvatar}>
                <MaterialCommunityIcons name="account-voice" size={24} color="#867465" />
              </View>
              <View style={styles.narratorMeta}>
                <Text style={styles.narratorLabel}>{t('contentDetail.narration')}</Text>
                <Text style={styles.narratorName}>{content.narrator || t('contentDetail.unknownNarrator')}</Text>
              </View>
            </View>
            <Text style={styles.narratorQuote}>
              {content.narrator_bio || t('contentDetail.narratorDefaultBio')}
            </Text>
          </View>
        )}

        {isAudiobook && !isLocked && (
          <View style={styles.card}>
            <View style={styles.chaptersHeader}>
              <Text style={styles.sectionTitle}>{t('contentDetail.chapters')}</Text>
              <Text style={styles.chapterCount}>{t('contentDetail.chaptersCount', { n: chapterItems.length })}</Text>
            </View>
            {chapterItems.map((chapter, index) => (
              <TouchableOpacity
                key={chapter.id}
                style={styles.chapterRow}
                onPress={() => navigation.navigate('AudioPlayer', { contentId: content.id || contentId })}
              >
                <Text style={styles.chapterIndex}>{String(index + 1).padStart(2, '0')}</Text>
                <View style={styles.chapterBody}>
                  <Text style={styles.chapterTitle}>{chapter.title}</Text>
                  {!!chapter.duration && <Text style={styles.chapterDuration}>{formatDuration(chapter.duration)}</Text>}
                </View>
                <MaterialCommunityIcons name="play-circle-outline" size={20} color="#B5651D" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {!isAudiobook && !isLocked && (content.publisher || content.published_at || content.isbn) && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('contentDetail.technicalInfo')}</Text>
            {!!content.publisher && (
              <View style={styles.metaRow}>
                <Text style={styles.metaKey}>{t('contentDetail.publisher')}</Text>
                <Text style={styles.metaValue}>{content.publisher}</Text>
              </View>
            )}
            {!!content.published_at && (
              <View style={styles.metaRow}>
                <Text style={styles.metaKey}>{t('contentDetail.publishDate')}</Text>
                <Text style={styles.metaValue}>{formatYear(content.published_at)}</Text>
              </View>
            )}
            {!!content.isbn && (
              <View style={styles.metaRow}>
                <Text style={styles.metaKey}>{t('contentDetail.isbn')}</Text>
                <Text style={styles.metaValue}>{content.isbn}</Text>
              </View>
            )}
          </View>
        )}

        {isLocked && (
          <View style={styles.lockedStatsCard}>
            {!!content.page_count && (
              <View style={styles.lockedStatCell}>
                <Text style={styles.lockedStatLabel}>{t('contentDetail.pages')}</Text>
                <Text style={styles.lockedStatValue}>{content.page_count}</Text>
              </View>
            )}
            {!!content.duration_seconds && (
              <View style={styles.lockedStatCell}>
                <Text style={styles.lockedStatLabel}>{t('contentDetail.duration')}</Text>
                <Text style={styles.lockedStatValue}>{formatDuration(content.duration_seconds)}</Text>
              </View>
            )}
            {!!content.language && (
              <View style={styles.lockedStatCell}>
                <Text style={styles.lockedStatLabel}>{t('contentDetail.language')}</Text>
                <Text style={styles.lockedStatValue}>{String(content.language).toUpperCase()}</Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('contentDetail.options')}</Text>
          <TouchableOpacity style={styles.optionRow} onPress={handleShare}>
            <MaterialCommunityIcons name="share-variant-outline" size={18} color="#B5651D" />
            <Text style={styles.optionText}>{t('contentDetail.share')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.optionRow} onPress={handleReport}>
            <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#c44" />
            <Text style={[styles.optionText, { color: '#c44' }]}>{t('contentDetail.reportProblem')}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Dans le même genre ── */}
        {recommendations.sameGenre.length > 0 && (
          <View style={styles.recSection}>
            <Text style={styles.recTitle}>{t('contentDetail.recSameGenre')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recRow}>
              {recommendations.sameGenre.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.recCard}
                  activeOpacity={0.8}
                  onPress={() => navigation.push('ContentDetail', { contentId: item.id })}
                >
                  <BookCover
                    uri={item.cover_url}
                    title={item.title}
                    style={styles.recCover}
                    resizeMode="cover"
                  />
                  <Text style={styles.recCardTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.recCardAuthor} numberOfLines={1}>{item.author}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Vous aimerez aussi (même auteur) ── */}
        {recommendations.youllLike.length > 0 && (
          <View style={styles.recSection}>
            <Text style={styles.recTitle}>{t('contentDetail.recYoullLike')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recRow}>
              {recommendations.youllLike.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.recCard}
                  activeOpacity={0.8}
                  onPress={() => navigation.push('ContentDetail', { contentId: item.id })}
                >
                  <BookCover
                    uri={item.cover_url}
                    title={item.title}
                    style={styles.recCover}
                    resizeMode="cover"
                  />
                  <Text style={styles.recCardTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.recCardAuthor} numberOfLines={1}>{item.author}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* Modal de choix : crédit / Stripe / Flutterwave */}
      <Modal
        visible={paymentModal.open}
        transparent
        animationType="slide"
        onRequestClose={() => !paymentModal.busy && setPaymentModal({ open: false, busy: '' })}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => !paymentModal.busy && setPaymentModal({ open: false, busy: '' })}
          />
          <View style={styles.modalSheet}>
            <View style={styles.sheetHandle} />

            <Text style={styles.modalTitle}>
              {access?.has_active_subscription && availableCredits > 0 ? t('contentDetail.modalUnlockBook') : t('contentDetail.modalChoosePayment')}
            </Text>
            <Text style={styles.modalSubtitle}>
              {access?.has_active_subscription && availableCredits > 0
                ? (availableCredits > 1
                    ? t('contentDetail.modalCreditsHintMany', { n: availableCredits })
                    : t('contentDetail.modalCreditsHintOne', { n: availableCredits }))
                : t('contentDetail.modalChooseMethod')}
            </Text>

            {/* Bouton crédit (vert) — uniquement si abo actif et crédits dispo */}
            {access?.has_active_subscription && availableCredits > 0 ? (
              <TouchableOpacity
                style={[styles.providerBtn, styles.providerBtnCredit, !!paymentModal.busy && styles.providerBtnDisabled]}
                onPress={handleUseCredit}
                disabled={!!paymentModal.busy}
                activeOpacity={0.8}
              >
                {paymentModal.busy === 'credit'
                  ? <ActivityIndicator size="small" color="#fff" style={styles.providerIcon} />
                  : <Text style={[styles.providerIcon, { fontSize: 26 }]}>🎟️</Text>}
                <View style={styles.providerInfo}>
                  <Text style={styles.providerNameCredit}>
                    {t('contentDetail.modalUseCredit', { n: availableCredits })}
                  </Text>
                  <Text style={styles.providerSubCredit}>
                    {creditsLifetime ? t('contentDetail.modalCreditLifetime') : t('contentDetail.modalCreditSubscription')}
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#fff" />
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={[styles.providerBtn, styles.providerBtnStripe, !!paymentModal.busy && styles.providerBtnDisabled]}
              onPress={() => handleChooseProvider('stripe')}
              disabled={!!paymentModal.busy}
              activeOpacity={0.8}
            >
              {paymentModal.busy === 'stripe'
                ? <ActivityIndicator size="small" color="#5469d4" style={styles.providerIcon} />
                : <Text style={[styles.providerIcon, { fontSize: 26 }]}>💳</Text>}
              <View style={styles.providerInfo}>
                <Text style={styles.providerName}>{t('contentDetail.modalCard')}</Text>
                <Text style={styles.providerSub}>{t('contentDetail.modalCardSub')}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#c8c4c0" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.providerBtn, styles.providerBtnFw, !!paymentModal.busy && styles.providerBtnDisabled]}
              onPress={() => handleChooseProvider('flutterwave')}
              disabled={!!paymentModal.busy}
              activeOpacity={0.8}
            >
              {paymentModal.busy === 'flutterwave'
                ? <ActivityIndicator size="small" color="#f9a825" style={styles.providerIcon} />
                : <Text style={[styles.providerIcon, { fontSize: 26 }]}>📱</Text>}
              <View style={styles.providerInfo}>
                <Text style={styles.providerName}>{t('contentDetail.modalMobileMoney')}</Text>
                <Text style={styles.providerSub}>{t('contentDetail.modalMobileMoneySub')}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#c8c4c0" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => !paymentModal.busy && setPaymentModal({ open: false, busy: '' })}
              disabled={!!paymentModal.busy}
            >
              <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBF7F2',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#867465',
    textAlign: 'center',
  },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#FBF7F2',
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  premiumPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E6',
    borderWidth: 1,
    borderColor: '#f2dfc8',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 8,
  },
  premiumPillText: {
    marginLeft: 4,
    fontSize: 10,
    fontWeight: '700',
    color: '#B5651D',
    letterSpacing: 0.7,
  },

  scrollContent: {
    paddingBottom: 34,
  },
  coverArea: {
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 18,
  },
  coverShadow: {
    position: 'absolute',
    top: 36,
    width: COVER_WIDTH,
    height: COVER_WIDTH * 1.35,
    borderRadius: 16,
    backgroundColor: '#000',
    opacity: 0.08,
    transform: [{ scale: 0.96 }, { translateY: 14 }],
  },
  coverBox: {
    width: COVER_WIDTH,
    aspectRatio: 2 / 3,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#dcd6d0',
    elevation: 12,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },

  identityArea: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700',
    color: '#171412',
    textAlign: 'center',
  },
  author: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: '500',
    color: '#B5651D',
    textAlign: 'center',
  },
  ratingRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    marginLeft: 6,
    fontSize: 13,
    color: '#6a5d50',
    fontWeight: '700',
  },

  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: 18,
    marginBottom: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ee',
    borderColor: '#f2dfc8',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginHorizontal: 4,
    marginVertical: 4,
  },
  chipText: {
    marginLeft: 6,
    fontSize: 11,
    fontWeight: '700',
    color: '#B5651D',
    letterSpacing: 0.6,
  },

  actionsArea: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#B5651D',
    borderRadius: 999,
    paddingVertical: 14,
  },
  primaryButtonDisabled: {
    opacity: 0.75,
  },
  primaryButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#fff',
    fontWeight: '700',
  },
  secondaryRow: {
    marginTop: 10,
    flexDirection: 'row',
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#f2dfc8',
    backgroundColor: '#fff',
    paddingVertical: 12,
    marginHorizontal: 4,
  },

  accessCard: {
    marginHorizontal: 20,
    marginBottom: 14,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#f0e7d8',
    backgroundColor: '#FFFDFA',
  },
  accessCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 5,
  },
  accessCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#171412',
  },
  accessCardBody: {
    fontSize: 13,
    lineHeight: 19,
    color: '#5f513d',
  },
  accessCardMeta: {
    marginTop: 6,
    fontSize: 13,
    color: '#5f513d',
  },
  priceRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  priceBase: {
    fontSize: 13,
    color: '#9c7e49',
    textDecorationLine: 'line-through',
  },
  priceReduced: {
    fontSize: 15,
    fontWeight: '700',
    color: '#B5651D',
  },
  discountPill: {
    backgroundColor: '#B5651D',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  discountPillText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  secondaryButtonText: {
    marginLeft: 6,
    color: '#B5651D',
    fontSize: 13,
    fontWeight: '700',
  },

  lockedLabelWrap: {
    alignItems: 'center',
    marginBottom: 12,
  },
  lockedLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E6',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  lockedLabelText: {
    marginLeft: 6,
    fontSize: 11,
    color: '#D4A017',
    fontWeight: '800',
    letterSpacing: 1,
  },
  lockedHintText: {
    marginTop: 8,
    paddingHorizontal: 20,
    fontSize: 13,
    lineHeight: 18,
    color: '#867465',
    textAlign: 'center',
  },

  card: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e8ddcf',
    backgroundColor: '#FFFDF5',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#171412',
    marginBottom: 10,
  },
  description: {
    fontSize: 15,
    lineHeight: 23,
    color: '#3d3530',
  },
  descriptionLocked: {
    color: '#867465',
  },
  descriptionFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 42,
  },
  linkText: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '700',
    color: '#B5651D',
  },

  narrationHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  narratorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#efe6dc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  narratorMeta: {
    marginLeft: 10,
    flex: 1,
  },
  narratorLabel: {
    fontSize: 11,
    letterSpacing: 1,
    color: '#B5651D',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  narratorName: {
    fontSize: 17,
    color: '#171412',
    fontWeight: '700',
  },
  narratorQuote: {
    fontSize: 14,
    lineHeight: 21,
    color: '#6d6155',
    fontStyle: 'italic',
  },

  chaptersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  chapterCount: {
    fontSize: 12,
    color: '#8c7f72',
    fontWeight: '600',
  },
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0e7db',
  },
  chapterIndex: {
    width: 28,
    fontSize: 13,
    color: '#B5651D',
    fontWeight: '700',
  },
  chapterBody: {
    flex: 1,
    paddingRight: 6,
  },
  chapterTitle: {
    fontSize: 15,
    color: '#1f1915',
    fontWeight: '600',
  },
  chapterDuration: {
    fontSize: 12,
    color: '#8c7f72',
    marginTop: 2,
  },

  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0e7db',
  },
  metaKey: {
    fontSize: 14,
    color: '#8c7f72',
    fontWeight: '500',
  },
  metaValue: {
    fontSize: 14,
    color: '#1f1915',
    fontWeight: '700',
  },

  lockedStatsCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e8ddcf',
    backgroundColor: '#fff',
    flexDirection: 'row',
    paddingVertical: 14,
  },
  lockedStatCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#f0e7db',
  },
  lockedStatLabel: {
    fontSize: 12,
    color: '#8c7f72',
    fontWeight: '500',
    marginBottom: 6,
  },
  lockedStatValue: {
    fontSize: 15,
    color: '#171412',
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 6,
  },

  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0e7db',
  },
  optionText: {
    marginLeft: 10,
    fontSize: 15,
    color: '#2d2722',
    fontWeight: '600',
  },

  secondaryButtonDone: {
    borderColor: '#c8e6c9',
    backgroundColor: '#f1f8f1',
  },
  secondaryButtonDisabled: {
    opacity: 0.7,
  },
  downloadProgressBar: {
    marginTop: 8,
    marginHorizontal: 4,
    borderRadius: 4,
    height: 4,
  },

  // Recommendations
  recSection: {
    marginTop: 24,
    paddingBottom: 8,
  },
  recTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2E4057',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  recRow: {
    paddingHorizontal: 16,
    gap: 12,
  },
  recCard: {
    width: 110,
  },
  recCover: {
    width: 110,
    height: 154,
    borderRadius: 10,
    backgroundColor: '#ece4d7',
  },
  recCardTitle: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
    color: '#2E4057',
    lineHeight: 16,
  },
  recCardAuthor: {
    marginTop: 2,
    fontSize: 11,
    color: '#9c7e49',
  },

  // Modal de paiement (crédit / Stripe / Flutterwave)
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingBottom: 34, paddingTop: 12,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#DDD', alignSelf: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#171412', marginBottom: 4 },
  modalSubtitle: { fontSize: 13, color: '#8a7d73', marginBottom: 16 },

  providerBtn: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, borderWidth: 1.5,
    padding: 14, marginTop: 10, gap: 12,
  },
  providerBtnCredit: { borderColor: '#1F7A39', backgroundColor: '#1F7A39' },
  providerBtnStripe: { borderColor: '#5469d4', backgroundColor: '#f5f5ff' },
  providerBtnFw: { borderColor: '#f9a825', backgroundColor: '#fffbf0' },
  providerBtnDisabled: { opacity: 0.5 },
  providerIcon: { width: 36, textAlign: 'center' },
  providerInfo: { flex: 1 },
  providerName: { fontSize: 15, fontWeight: '700', color: '#171412' },
  providerNameCredit: { fontSize: 15, fontWeight: '700', color: '#fff' },
  providerSub: { fontSize: 12, color: '#8a7d73', marginTop: 2 },
  providerSubCredit: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 },

  cancelBtn: {
    marginTop: 12, height: 44, alignItems: 'center', justifyContent: 'center',
  },
  cancelBtnText: { color: '#8a7d73', fontWeight: '600', fontSize: 14 },
});
