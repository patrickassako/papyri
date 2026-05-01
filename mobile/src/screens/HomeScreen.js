import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  StatusBar,
  RefreshControl,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Text,
  Avatar,
  ActivityIndicator,
  Chip,
  ProgressBar,
  Snackbar,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as homeService from '../services/home.service';
import * as userService from '../services/user.service';
import { contentsService } from '../services/contents.service';
import BottomNavBar from '../components/BottomNavBar';
import BookCover from '../components/BookCover';
import { getDownloadedContents, isOnline } from '../services/offline.service';
import { COVER_PLACEHOLDER_SQUARE } from '../config/constants';
import { getProxiedImageUrl } from '../utils/imageProxy';
import { getCategoryName } from '../utils/categoryName';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { useProfile } from '../context/ProfileContext';

// Import shared design tokens
const tokens = require('../config/tokens');

const { width } = Dimensions.get('window');
const CARD_WIDTH = Math.min(width * 0.9, 360);

// Résout le cover_url en essayant tous les champs possibles, puis proxifie
function resolveCover(item) {
  const raw = item?.cover_url || item?.thumbnail || item?.cover_image_url || item?.coverUrl || null;
  return getProxiedImageUrl(raw);
}

// Mélange aléatoire (Fisher-Yates)
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function mapContinueItem(item) {
  const progressPercent = Math.max(0, Math.min(100, Math.round(item.progress_percent || 0)));
  const isAudio = item.content_type === 'audiobook';
  const defaultRemaining = isAudio ? 'restant' : 'p. restantes';

  return {
    id: item.content_id || item.id,
    title: item.title,
    author: item.author,
    type: isAudio ? 'audiobook' : 'ebook',
    progress: progressPercent / 100,
    progressText: `${progressPercent}% ${isAudio ? 'écoutés' : 'terminés'}`,
    remainingText: item.remaining_text || defaultRemaining,
    cover: resolveCover(item),
  };
}

const HomeScreen = ({ navigation }) => {
  const { t, i18n } = useTranslation();
  const { activeProfile } = useProfile();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null); // null = Tous
  // Données de la page d'accueil
  const [continueReading, setContinueReading] = useState([]);
  const [nouveautes, setNouveautes] = useState([]);
  const [populaires, setPopulaires] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  // Catégories réelles depuis l'API
  const [apiCategories, setApiCategories] = useState([]);
  // Contenu filtré par catégorie
  const [filteredContents, setFilteredContents] = useState([]);
  const [filterLoading, setFilterLoading] = useState(false);
  // Search
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchError, setSearchError] = useState(null);
  // Offline
  const [offlineContents, setOfflineContents] = useState([]);
  const [isOffline, setIsOffline] = useState(false);
  // Quote — random index, changes on each page focus
  const [quoteIndex, setQuoteIndex] = useState(() => Math.floor(Math.random() * 5));

  useFocusEffect(
    useCallback(() => {
      setQuoteIndex(Math.floor(Math.random() * 5));
    }, [])
  );

  // Reload on mount AND when active profile changes (family profile switch)
  useEffect(() => {
    loadInitialData();
    loadApiCategories();
  }, [activeProfile?.id]);

  // Reload offline contents every time screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadOfflineContents();
    }, [])
  );

  useEffect(() => {
    if (selectedCategory) {
      loadFilteredContents(selectedCategory);
    }
  }, [selectedCategory]);

  const loadOfflineContents = async () => {
    try {
      const [contents, online] = await Promise.all([getDownloadedContents(), isOnline()]);
      setOfflineContents(contents.slice(0, 6));
      setIsOffline(!online);
    } catch {
      setOfflineContents([]);
    }
  };

  const loadApiCategories = async () => {
    try {
      const data = await contentsService.getCategories();
      setApiCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Categories error:', err);
    }
  };

  const loadFilteredContents = useCallback(async (categorySlug) => {
    try {
      setFilterLoading(true);
      const response = await contentsService.getContents({
        page: 1,
        limit: 40,
        category: categorySlug,
        sort: 'newest',
      });
      setFilteredContents(response.data || []);
    } catch (err) {
      console.error('Filter error:', err);
      setFilteredContents([]);
    } finally {
      setFilterLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!searchVisible) return;

    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchResults([]);
      setSearchError(null);
      setSearchLoading(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setSearchLoading(true);
        setSearchError(null);
        const payload = await contentsService.search(query, { limit: 20 });
        if (cancelled) return;
        const hits = Array.isArray(payload?.hits) ? payload.hits : [];
        const mapped = hits.map((item) => ({
          id: item.id || item.content_id,
          title: item.title || 'Sans titre',
          author: item.author || 'Auteur inconnu',
          cover: item.cover_url || null,
          type: item.content_type || 'ebook',
        })).filter((item) => !!item.id);
        setSearchResults(mapped);
      } catch (e) {
        if (cancelled) return;
        setSearchError('Erreur recherche. Réessaie.');
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    }, 320);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, searchVisible]);

  const applyHomeData = (homeData) => {
    if (!homeData) return;
    setContinueReading((homeData.continue_reading || []).map(mapContinueItem));
    setNouveautes((homeData.new_releases || []).map(item => ({
      id: item.id, title: item.title, author: item.author || item.author_name,
      cover: resolveCover(item),
    })));
    setPopulaires((homeData.popular || []).map(item => ({
      id: item.id, title: item.title, author: item.author || item.author_name,
      cover: resolveCover(item),
    })));
    setRecommendations(shuffle((homeData.recommended || []).map(item => ({
      id: item.id, title: item.title, author: item.author || item.author_name,
      cover: resolveCover(item), type: item.content_type || 'ebook',
    }))));
  };

  const loadInitialData = async () => {
    setError(null);
    setLoading(true);
    try {
      const [userProfile, homeData] = await Promise.all([
        userService.getUserProfile().catch(() => null),
        homeService.getHomeData().catch(() => null),
      ]);
      if (userProfile) setUser(userProfile);
      applyHomeData(homeData);

      // Si pas de "reprendre" dans /home, charger l'historique en arrière-plan
      if (!homeData?.continue_reading?.length) {
        homeService.getReadingHistory(1, 20).then((historyData) => {
          if (Array.isArray(historyData?.data)) {
            const inProgress = historyData.data
              .filter((item) => !item?.is_completed && Number(item?.progress_percent || 0) > 0)
              .slice(0, 8)
              .map(mapContinueItem);
            setContinueReading(inProgress);
          }
        }).catch(() => {});
      }

      // Fallback Nouveautés — si home ne retourne rien
      if (!homeData?.new_releases?.length) {
        contentsService.getContents({ sort: 'newest', limit: 10 }).then((res) => {
          const items = (res?.data || []).map(item => ({
            id: item.id, title: item.title, author: item.author || item.author_name,
            cover: resolveCover(item),
          }));
          if (items.length > 0) setNouveautes(items);
        }).catch(() => {});
      }

      // Fallback Recommandations — si home ne retourne pas assez
      if (!homeData?.recommended?.length) {
        contentsService.getContents({ sort: 'popular', limit: 20 }).then((res) => {
          const items = shuffle((res?.data || []).map(item => ({
            id: item.id, title: item.title, author: item.author || item.author_name,
            cover: resolveCover(item), type: item.content_type || 'ebook',
          })));
          if (items.length > 0) setRecommendations(items.slice(0, 10));
        }).catch(() => {});
      }
    } catch (err) {
      setError('Impossible de charger les données. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadInitialData();
    setRefreshing(false);
  };

  // Pas de blocage total — le contenu s'affiche progressivement

  const DAILY_QUOTES_FR = [
    { text: "Un livre ouvert, c'est un cerveau qui parle.", author: "Victor Hugo" },
    { text: "La lecture est à l'esprit ce que l'exercice est au corps.", author: "Addison" },
    { text: "Lire, c'est voyager ; voyager, c'est lire.", author: "Hugo" },
    { text: "Une maison sans livre est une maison sans âme.", author: "Cicéron" },
    { text: "Les livres sont les abeilles qui portent le pollen d'un esprit à l'autre.", author: "Lowell" },
  ];
  const DAILY_QUOTES_EN = [
    { text: "A book is a dream that you hold in your hand.", author: "Neil Gaiman" },
    { text: "Reading is to the mind what exercise is to the body.", author: "Addison" },
    { text: "A room without books is like a body without a soul.", author: "Cicero" },
    { text: "Not all those who wander are lost.", author: "Tolkien" },
    { text: "Books are the bees which carry pollen from one mind to another.", author: "Lowell" },
  ];
  const DAILY_QUOTES = i18n.language === 'en' ? DAILY_QUOTES_EN : DAILY_QUOTES_FR;
  const dailyQuote = DAILY_QUOTES[quoteIndex % DAILY_QUOTES.length];

  const getTimeGreeting = (firstName) => {
    const h = new Date().getHours();
    const name = firstName || (i18n.language === 'en' ? 'Reader' : 'Lecteur');
    if (h < 12) return t('home.greeting_morning', { name });
    if (h < 18) return t('home.greeting_afternoon', { name });
    return t('home.greeting_evening', { name });
  };

  const renderHeader = () => {
    const firstName = user?.full_name?.split(' ')[0] || '';
    return (
      <View>
        {/* Barre supérieure */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>{getTimeGreeting(firstName)}</Text>
            <Text style={styles.subGreeting}>{t('home.subtitle')}</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.searchButton} onPress={() => setSearchVisible(true)}>
              <MaterialCommunityIcons name="magnify" size={22} color={tokens.colors.onSurface.light} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
              {user?.avatar_url ? (
                <Avatar.Image size={40} source={{ uri: user.avatar_url }} style={styles.avatar} />
              ) : (
                <Avatar.Text
                  size={40}
                  label={firstName.substring(0, 2).toUpperCase()}
                  style={styles.avatar}
                  color="#FFFFFF"
                />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Citation du jour */}
        <View style={styles.quoteCard}>
          <MaterialCommunityIcons name="format-quote-open" size={20} color={tokens.colors.primary} style={{ marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.quoteText}>« {dailyQuote.text} »</Text>
            <Text style={styles.quoteAuthor}>— {dailyQuote.author}</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderCategories = () => {
    const allCategories = [{ id: '__all__', name: t('common.all'), slug: null }, ...apiCategories];
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.categoriesContainer, { flexGrow: 0 }]}
        contentContainerStyle={styles.categoriesContent}
      >
        {allCategories.map((cat) => {
          const isSelected = cat.slug === selectedCategory;
          const displayName = cat.slug ? getCategoryName(cat.slug, t, cat.name) : cat.name;
          return (
            <Chip
              key={cat.id || cat.slug}
              selected={isSelected}
              onPress={() => setSelectedCategory(cat.slug)}
              style={[
                styles.categoryChip,
                isSelected && styles.categoryChipSelected,
              ]}
              textStyle={[
                styles.categoryChipText,
                isSelected && styles.categoryChipTextSelected,
              ]}
            >
              {displayName}
            </Chip>
          );
        })}
      </ScrollView>
    );
  };

  const renderContinueCard = (item) => (
    <View key={item.id} style={styles.continueCard}>
      <BookCover uri={item.cover} title={item.title} style={styles.continueCardCover} resizeMode="cover" />
      <View style={styles.continueCardContent}>
        <View style={styles.continueCardTop}>
          <View style={styles.typeContainer}>
            <MaterialCommunityIcons
              name={item.type === 'audiobook' ? 'headphones' : 'book-open-variant'}
              size={16}
              color={tokens.colors.primary}
            />
            <Text style={styles.typeText}>
              {item.type === 'audiobook' ? 'AUDIOBOOK' : 'E-BOOK'}
            </Text>
          </View>
          <Text style={styles.continueCardTitle}>{item.title}</Text>
          <Text style={styles.continueCardAuthor}>{item.author}</Text>
        </View>

        <View style={styles.continueCardBottom}>
          <View style={styles.progressContainer}>
            <View style={styles.progressTextRow}>
              <Text style={styles.progressText}>{item.progressText}</Text>
              <Text style={styles.remainingText}>{item.remainingText}</Text>
            </View>
            <ProgressBar
              progress={item.progress}
              color={tokens.colors.primary}
              style={styles.progressBar}
            />
          </View>
          <TouchableOpacity
            style={[
              styles.resumeButton,
              item.type === 'audiobook' && styles.resumeButtonAudiobook,
            ]}
            onPress={() => navigation.navigate('ContentDetail', { contentId: item.id })}
          >
            <MaterialCommunityIcons
              name={item.type === 'audiobook' ? 'headphones' : 'play'}
              color={item.type === 'audiobook' ? '#FFFFFF' : tokens.colors.primary}
            />
            <Text
              style={[
                styles.resumeButtonText,
                item.type === 'audiobook' && styles.resumeButtonTextAudiobook,
              ]}
            >
              {item.type === 'audiobook' ? t('common.listen') : t('common.resume')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderContinueReading = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('home.continueReading')}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.continueScrollContent}
        snapToInterval={CARD_WIDTH + 16}
        decelerationRate="fast"
      >
        {continueReading.map(renderContinueCard)}
      </ScrollView>
    </View>
  );

  const renderBookCard = (item) => (
    <TouchableOpacity
      key={item.id}
      style={styles.bookCard}
      onPress={() => navigation.navigate('ContentDetail', { contentId: item.id })}
    >
      <BookCover uri={item.cover} title={item.title} style={styles.bookCover} />
      <Text style={styles.bookTitle} numberOfLines={1}>
        {item.title}
      </Text>
      <Text style={styles.bookAuthor} numberOfLines={1}>
        {item.author}
      </Text>
    </TouchableOpacity>
  );

  const renderSkeletonCards = (count = 4) => (
    Array.from({ length: count }).map((_, i) => (
      <View key={i} style={styles.skeletonCard}>
        <View style={styles.skeletonCover} />
        <View style={styles.skeletonTitle} />
        <View style={styles.skeletonAuthor} />
      </View>
    ))
  );

  const renderNouveautes = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t('home.newReleases')}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Catalog', { initialSort: 'newest' })}>
          <Text style={styles.seeAllButton}>{t('common.seeAll')}</Text>
        </TouchableOpacity>
      </View>
      {isOffline ? (
        <View style={styles.offlineSectionMsg}>
          <MaterialCommunityIcons name="wifi-off" size={20} color="#b4a090" />
          <Text style={styles.offlineSectionMsgText}>Non disponible hors ligne</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.booksScrollContent}
        >
          {nouveautes.length > 0 ? nouveautes.map(renderBookCard) : renderSkeletonCards(4)}
        </ScrollView>
      )}
    </View>
  );

  const renderPopulaires = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t('home.popular')}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Catalog')}>
          <Text style={styles.seeAllButton}>{t('common.seeAll')}</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.booksScrollContent}
      >
        {populaires.map(renderBookCard)}
      </ScrollView>
    </View>
  );

  const renderRecommendations = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t('home.recommended')}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Catalog', { initialSort: 'popular' })}>
          <Text style={styles.seeAllButton}>{t('common.seeAll')}</Text>
        </TouchableOpacity>
      </View>
      {isOffline ? (
        <View style={styles.offlineSectionMsg}>
          <MaterialCommunityIcons name="wifi-off" size={20} color="#b4a090" />
          <Text style={styles.offlineSectionMsgText}>Non disponible hors ligne</Text>
        </View>
      ) : (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.booksScrollContent}
      >
        {recommendations.length > 0 ? recommendations.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.bookCard}
            onPress={() => navigation.navigate('ContentDetail', { contentId: item.id })}
          >
            <View style={styles.bookCoverWrapper}>
              <BookCover uri={item.cover} title={item.title} style={styles.bookCover} />
              <View style={[styles.typeBadge, item.type === 'audiobook' && styles.typeBadgeAudio]}>
                <MaterialCommunityIcons
                  name={item.type === 'audiobook' ? 'headphones' : 'book-open-variant'}
                  size={10}
                  color="#fff"
                />
              </View>
            </View>
            <Text style={styles.bookTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.bookAuthor} numberOfLines={1}>{item.author}</Text>
          </TouchableOpacity>
        )) : renderSkeletonCards(4)}
      </ScrollView>
      )}
    </View>
  );

  const renderBottomNav = () => (
    <View style={styles.bottomNav}>
      <TouchableOpacity style={styles.navItem}>
        <MaterialCommunityIcons name="home" size={24} color={tokens.colors.primary} />
        <Text style={[styles.navLabel, styles.navLabelActive]}>Accueil</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.navItem}>
        <MaterialCommunityIcons name="compass-outline" size={24} color="#867465" />
        <Text style={styles.navLabel}>Découvrir</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.navItem}>
        <MaterialCommunityIcons name="book-multiple" size={24} color="#867465" />
        <Text style={styles.navLabel}>Ma Biblio</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.navItem}>
        <MaterialCommunityIcons name="cog-outline" size={24} color="#867465" />
        <Text style={styles.navLabel}>Paramètres</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={tokens.colors.backgrounds.light} />
      {loading && (
        <View style={{ height: 3, backgroundColor: tokens.colors.primary, opacity: 0.7 }} />
      )}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[tokens.colors.primary]}
            tintColor={tokens.colors.primary}
          />
        }
      >
        {renderHeader()}
        {renderCategories()}
        {selectedCategory ? (
          // ── Vue filtrée par catégorie ──
          filterLoading ? (
            <View style={styles.filterLoadingWrap}>
              <ActivityIndicator size="large" color={tokens.colors.primary} />
            </View>
          ) : filteredContents.length === 0 ? (
            <View style={styles.filterEmptyWrap}>
              <Text style={styles.filterEmptyIcon}>📭</Text>
              <Text style={styles.filterEmptyText}>{t('home.noContentsCategory')}</Text>
            </View>
          ) : (
            <View style={styles.filteredGrid}>
              <View style={styles.filteredGridHeader}>
                <Text style={styles.filteredGridCount}>
                  {t('home.allContentsCount', { count: filteredContents.length })}
                </Text>
                <TouchableOpacity onPress={() => navigation.navigate('Catalog', { initialCategory: selectedCategory })}>
                  <Text style={styles.filteredGridAll}>Voir tout →</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.filteredGridRow}>
                {filteredContents.slice(0, 6).map((item) => {
                  const isAudio = item.content_type === 'audiobook';
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.filteredCard}
                      activeOpacity={0.85}
                      onPress={() => navigation.navigate('ContentDetail', { contentId: item.id })}
                    >
                      <BookCover
                        uri={item.cover_url}
                        title={item.title}
                        style={styles.filteredCardCover}
                        resizeMode="cover"
                      />
                      <Text style={styles.filteredCardTitle} numberOfLines={2}>{item.title}</Text>
                      <Text style={styles.filteredCardAuthor} numberOfLines={1}>{item.author}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )
        ) : (
          // ── Vue accueil normale ──
          <>
            {/* Bannière hors-ligne */}
            {isOffline && (
              <View style={styles.offlineBanner}>
                <MaterialCommunityIcons name="wifi-off" size={16} color="#fff" />
                <Text style={styles.offlineBannerText}>{t('home.offlineBanner')}</Text>
              </View>
            )}

            {/* Bannière featured — premier livre populaire */}
            {populaires.length > 0 && (() => {
              const featured = populaires[0];
              return (
                <TouchableOpacity
                  key={`featured-${featured.id}`}
                  style={styles.featuredCard}
                  activeOpacity={0.88}
                  onPress={() => navigation.navigate('ContentDetail', { contentId: featured.id })}
                >
                  {featured.cover ? (
                    <Image source={{ uri: featured.cover }} style={styles.featuredBg} blurRadius={14} />
                  ) : (
                    <View style={[styles.featuredBg, { backgroundColor: '#B5651D' }]} />
                  )}
                  <View style={styles.featuredOverlay} />
                  <View style={styles.featuredContent}>
                    <View style={styles.featuredBadge}>
                      <MaterialCommunityIcons name="fire" size={12} color="#fff" />
                      <Text style={styles.featuredBadgeText}>{t('home.popularBadge')}</Text>
                    </View>
                    <Text style={styles.featuredTitle} numberOfLines={2}>{featured.title}</Text>
                    <Text style={styles.featuredAuthor} numberOfLines={1}>{featured.author}</Text>
                    <View style={styles.featuredCta}>
                      <MaterialCommunityIcons name="book-open-variant" size={14} color="#111" />
                      <Text style={styles.featuredCtaText}>{t('home.discover')}</Text>
                    </View>
                  </View>
                  {featured.cover && (
                    <Image source={{ uri: featured.cover }} style={styles.featuredCover} />
                  )}
                </TouchableOpacity>
              );
            })()}

            {/* Section téléchargements */}
            {offlineContents.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.offlineSectionTitle}>
                    <MaterialCommunityIcons name="download-circle" size={18} color={tokens.colors.primary} />
                    <Text style={styles.sectionTitle}>{t('home.downloads')}</Text>
                  </View>
                  <TouchableOpacity onPress={() => navigation.navigate('Downloads')}>
                    <Text style={styles.seeAll}>{t('home.manageDownloads')}</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.offlineGrid}>
                  {offlineContents.map((item) => {
                    const isAudio = item.type === 'audiobook';
                    return (
                      <TouchableOpacity
                        key={item.contentId}
                        style={styles.offlineCard}
                        activeOpacity={0.8}
                        onPress={() => {
                          if (isAudio) {
                            navigation.navigate('AudioPlayer', { contentId: item.contentId });
                          } else {
                            navigation.navigate('BookReader', { contentId: item.contentId, title: item.title });
                          }
                        }}
                      >
                        <BookCover
                          uri={item.cover_url}
                          title={item.title}
                          style={styles.offlineCover}
                          resizeMode="cover"
                        />
                        <View style={styles.offlineBadge}>
                          <MaterialCommunityIcons name="check-circle" size={14} color="#4caf50" />
                        </View>
                        <Text style={styles.offlineCardTitle} numberOfLines={2}>{item.title}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {continueReading.length > 0 && renderContinueReading()}
            {renderNouveautes()}
            {populaires.length > 0 && renderPopulaires()}
            {renderRecommendations()}

            {/* Empty state — shown when no content is available at all */}
            {continueReading.length === 0 && nouveautes.length === 0 && populaires.length === 0 && recommendations.length === 0 && (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="bookshelf" size={64} color="#d4c4b5" />
                <Text style={styles.emptyStateTitle}>{t('home.emptyTitle')}</Text>
                <Text style={styles.emptyStateText}>{t('home.emptyText')}</Text>
                <TouchableOpacity
                  style={styles.emptyStateButton}
                  onPress={() => navigation.navigate('Catalog')}
                >
                  <MaterialCommunityIcons name="compass-outline" size={18} color="#fff" />
                  <Text style={styles.emptyStateButtonText}>{t('home.exploreCatalog')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
        <View style={{ height: 180 }} />
      </ScrollView>
      <Snackbar
        visible={!!error}
        onDismiss={() => setError(null)}
        duration={4000}
        action={{
          label: 'Réessayer',
          onPress: loadInitialData,
        }}
      >
        {error}
      </Snackbar>

      <Modal
        visible={searchVisible}
        animationType="slide"
        onRequestClose={() => setSearchVisible(false)}
      >
        <SafeAreaView style={styles.searchModalContainer} edges={['top']}>
          <View style={styles.searchModalHeader}>
            <TouchableOpacity
              style={styles.searchCloseButton}
              onPress={() => {
                setSearchVisible(false);
                setSearchQuery('');
                setSearchResults([]);
                setSearchError(null);
              }}
            >
              <MaterialCommunityIcons name="arrow-left" size={22} color={tokens.colors.onSurface.light} />
            </TouchableOpacity>
            <Text style={styles.searchModalTitle}>{t('common.search')}</Text>
            <View style={styles.searchCloseButton} />
          </View>

          <View style={styles.searchInputWrap}>
            <MaterialCommunityIcons name="magnify" size={20} color="#867465" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('home.searchPlaceholder')}
              placeholderTextColor="#9a8f86"
              style={styles.searchInput}
              autoFocus
              returnKeyType="search"
            />
          </View>

          <ScrollView contentContainerStyle={styles.searchResultsContent}>
            {searchQuery.trim().length < 2 ? (
              <Text style={styles.searchHint}>{t('home.searchHint')}</Text>
            ) : null}

            {searchLoading ? (
              <View style={styles.searchLoadingWrap}>
                <ActivityIndicator size="small" color={tokens.colors.primary} />
              </View>
            ) : null}

            {!searchLoading && searchError ? (
              <Text style={styles.searchErrorText}>{searchError}</Text>
            ) : null}

            {!searchLoading && !searchError && searchQuery.trim().length >= 2 && searchResults.length === 0 ? (
              <Text style={styles.searchHint}>{t('home.noResults')}</Text>
            ) : null}

            {searchResults.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.searchResultCard}
                onPress={() => {
                  setSearchVisible(false);
                  navigation.navigate('ContentDetail', { contentId: item.id });
                }}
              >
                <BookCover uri={item.cover} title={item.title} style={styles.searchResultCover} />
                <View style={styles.searchResultBody}>
                  <Text style={styles.searchResultTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.searchResultAuthor} numberOfLines={1}>{item.author}</Text>
                  <View style={styles.searchResultType}>
                    <MaterialCommunityIcons
                      name={item.type === 'audiobook' ? 'headphones' : 'book-open-variant'}
                      size={13}
                      color="#867465"
                    />
                    <Text style={styles.searchResultTypeText}>
                      {item.type === 'audiobook' ? 'Audio' : 'E-book'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Bottom Navigation */}
      <BottomNavBar navigation={navigation} activeTab="Home" />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.backgrounds.light,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: tokens.colors.backgrounds.light,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: tokens.colors.backgrounds.light,
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '700',
    color: tokens.colors.onBackground.light,
    fontFamily: 'Playfair Display',
  },
  subGreeting: {
    fontSize: 13,
    color: '#867465',
    marginTop: 2,
  },

  // Citation du jour
  quoteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: `${tokens.colors.primary}12`,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: tokens.colors.primary,
  },
  quoteText: {
    fontSize: 13,
    fontStyle: 'italic',
    color: tokens.colors.onBackground.light,
    lineHeight: 18,
  },
  quoteAuthor: {
    fontSize: 11,
    color: '#9c7e49',
    marginTop: 4,
    fontWeight: '600',
  },

  // Featured card
  featuredCard: {
    marginHorizontal: 16,
    marginTop: 20,
    height: 160,
    borderRadius: 18,
    overflow: 'hidden',
    flexDirection: 'row',
    backgroundColor: '#1a0f05',
  },
  featuredBg: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  featuredOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,5,0,0.65)',
  },
  featuredContent: {
    flex: 1,
    padding: 18,
    justifyContent: 'flex-end',
    zIndex: 2,
  },
  featuredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: tokens.colors.primary,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    marginBottom: 8,
  },
  featuredBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  featuredTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#fff',
    fontFamily: 'Playfair Display',
    lineHeight: 22,
  },
  featuredAuthor: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 3,
  },
  featuredCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
    backgroundColor: tokens.colors.primary,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  featuredCtaText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111',
  },
  featuredCover: {
    width: 100,
    height: '100%',
    zIndex: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  searchButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tokens.colors.surfaces.light.default,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  avatar: {
    borderWidth: 2,
    borderColor: tokens.colors.primary,
  },

  // Categories
  categoriesContainer: {
    marginTop: 8,
    flexShrink: 0,
    minHeight: 44,
  },
  categoriesContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  categoryChip: {
    backgroundColor: tokens.colors.surfaces.light.default,
    borderWidth: 1,
    borderColor: '#e5e0dc',
    marginRight: 8,
  },
  categoryChipSelected: {
    backgroundColor: tokens.colors.primary,
    borderColor: tokens.colors.primary,
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: tokens.colors.onSurface.light,
  },
  categoryChipTextSelected: {
    color: '#FFFFFF',
  },

  // Sections
  section: {
    marginTop: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: tokens.colors.onBackground.light,
  },
  seeAllButton: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.primary,
  },

  // Continue Reading Cards
  continueScrollContent: {
    paddingHorizontal: 16,
    gap: 16,
  },
  continueCard: {
    width: CARD_WIDTH,
    backgroundColor: tokens.colors.surfaces.light.default,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    gap: 12,
    borderWidth: 1,
    borderColor: '#e5e0dc',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  continueCardCover: {
    width: 88,
    height: 132,
    borderRadius: 8,
  },
  continueCardContent: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  continueCardTop: {
    gap: 4,
  },
  typeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  typeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#867465',
    letterSpacing: 1,
  },
  continueCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.onSurface.light,
    lineHeight: 18,
  },
  continueCardAuthor: {
    fontSize: 13,
    color: '#867465',
  },
  continueCardBottom: {
    gap: 8,
  },
  progressContainer: {
    gap: 4,
  },
  progressTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressText: {
    fontSize: 11,
    fontWeight: '600',
    color: tokens.colors.primary,
  },
  remainingText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#867465',
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#f4f2f0',
  },
  resumeButton: {
    backgroundColor: 'rgba(181, 101, 29, 0.1)',
    borderRadius: 20,
    paddingVertical: 7,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  resumeButtonAudiobook: {
    backgroundColor: tokens.colors.primary,
  },
  resumeButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.primary,
  },
  resumeButtonTextAudiobook: {
    color: '#FFFFFF',
  },

  // Book Cards
  booksScrollContent: {
    paddingHorizontal: 16,
    gap: 16,
  },
  bookCard: {
    width: 128,
    marginRight: 0,
  },
  bookCoverWrapper: {
    position: 'relative',
    marginBottom: 8,
  },
  bookCover: {
    width: 128,
    height: 192,
    borderRadius: 8,
    backgroundColor: tokens.colors.surfaces.light.default,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  coverFallback: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e8ddd4',
  },
  typeBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: tokens.colors.primary,
    borderRadius: 5,
    padding: 3,
  },
  typeBadgeAudio: {
    backgroundColor: tokens.colors.secondary,
  },
  bookTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.onSurface.light,
    marginBottom: 2,
  },
  bookAuthor: {
    fontSize: 12,
    color: '#867465',
  },

  // Bottom Navigation
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: tokens.colors.surfaces.light.default,
    borderTopWidth: 1,
    borderTopColor: '#e5e0dc',
    paddingHorizontal: 24,
    paddingVertical: 12,
    paddingBottom: 24,
  },
  navItem: {
    alignItems: 'center',
    gap: 4,
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#867465',
  },
  navLabelActive: {
    fontWeight: '700',
    color: tokens.colors.primary,
  },

  // Filtered grid
  filterLoadingWrap: {
    paddingTop: 60,
    alignItems: 'center',
  },
  filterEmptyWrap: {
    paddingTop: 60,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  filterEmptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  filterEmptyText: {
    fontSize: 15,
    color: '#867465',
    textAlign: 'center',
  },
  filteredGrid: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  filteredGridHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  filteredGridCount: {
    fontSize: 14,
    color: '#867465',
    fontWeight: '500',
  },
  filteredGridAll: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.primary,
  },
  filteredGridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  filteredCard: {
    width: (width - 44) / 3,
  },
  filteredCardCover: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: 10,
    backgroundColor: '#e5e0dc',
    marginBottom: 6,
  },
  filteredCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#171412',
    lineHeight: 16,
  },
  filteredCardAuthor: {
    fontSize: 11,
    color: '#867465',
    marginTop: 2,
  },

  // Search modal
  searchModalContainer: {
    flex: 1,
    backgroundColor: tokens.colors.backgrounds.light,
  },
  searchModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  searchCloseButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: tokens.colors.onBackground.light,
  },
  searchInputWrap: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ded6d0',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 46,
    color: tokens.colors.onBackground.light,
  },
  searchResultsContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  searchHint: {
    marginTop: 10,
    color: '#867465',
  },
  searchLoadingWrap: {
    marginTop: 14,
    alignItems: 'center',
  },
  searchErrorText: {
    marginTop: 10,
    color: '#C54545',
  },
  searchResultCard: {
    marginTop: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e7dfd8',
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    gap: 10,
  },
  searchResultCover: {
    width: 58,
    height: 84,
    borderRadius: 6,
    backgroundColor: '#EFEAE3',
  },
  searchResultBody: {
    flex: 1,
    justifyContent: 'center',
  },
  searchResultTitle: {
    color: tokens.colors.onSurface.light,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  searchResultAuthor: {
    marginTop: 4,
    color: '#867465',
    fontSize: 12,
  },
  searchResultType: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  searchResultTypeText: {
    color: '#867465',
    fontSize: 12,
    fontWeight: '600',
  },

  // Offline section
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#B5651D',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 4,
  },
  offlineBannerText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  offlineSectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.primary,
  },
  offlineGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
  },
  offlineCard: {
    width: (width - 56) / 3,
    position: 'relative',
  },
  offlineCover: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: 8,
    backgroundColor: '#f0ebe3',
  },
  offlineCoverPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 1,
  },
  offlineCardTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: tokens.colors.onSurface.light,
    marginTop: 5,
    lineHeight: 15,
  },

  // Skeleton cards
  skeletonCard: {
    width: 128,
    marginRight: 0,
  },
  skeletonCover: {
    width: 128,
    height: 192,
    borderRadius: 8,
    backgroundColor: '#e8e0d8',
    marginBottom: 8,
  },
  skeletonTitle: {
    height: 12,
    borderRadius: 6,
    backgroundColor: '#e8e0d8',
    marginBottom: 6,
    width: '80%',
  },
  skeletonAuthor: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ede7e0',
    width: '55%',
  },
  offlineSectionMsg: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  offlineSectionMsgText: {
    fontSize: 14,
    color: '#867465',
    fontStyle: 'italic',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 48,
    paddingBottom: 32,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: tokens.colors.onBackground.light,
    marginTop: 20,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#867465',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: tokens.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  emptyStateButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});

export default HomeScreen;
