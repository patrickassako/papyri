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
import { getDownloadedContents, isOnline } from '../services/offline.service';
import { COVER_PLACEHOLDER_SQUARE } from '../config/constants';

// Import shared design tokens
const tokens = require('../config/tokens');

const { width } = Dimensions.get('window');
const CARD_WIDTH = Math.min(width * 0.9, 360);

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
    cover: item.cover_url || COVER_PLACEHOLDER_SQUARE,
  };
}

const HomeScreen = ({ navigation }) => {
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

  useEffect(() => {
    loadInitialData();
    loadApiCategories();
    loadOfflineContents();
  }, []);

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
        sort: 'published_at',
        order: 'desc',
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
          cover: item.cover_url || 'https://placehold.co/120x180/EEE/AAA?text=Book',
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

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Charger le profil utilisateur et les données de la page d'accueil en parallèle
      const [userProfile, homeData, historyData] = await Promise.all([
        userService.getUserProfile().catch(err => {
          console.warn('Error loading user profile:', err);
          return null;
        }),
        homeService.getHomeData().catch(err => {
          console.warn('Error loading home data:', err);
          return null;
        }),
        homeService.getReadingHistory(1, 20).catch(err => {
          console.warn('Error loading reading history:', err);
          return null;
        }),
      ]);

      // Mettre à jour le profil utilisateur
      if (userProfile) {
        setUser(userProfile);
      }

      // Mettre à jour les données de la page d'accueil
      if (homeData) {
        // Continue Reading - Transformer les données pour le format attendu
        const continueReadingData = (homeData.continue_reading || []).map(mapContinueItem);
        setContinueReading(continueReadingData);

        // Nouveautés
        const nouveautesData = (homeData.new_releases || []).map(item => ({
          id: item.id,
          title: item.title,
          author: item.author,
          cover: item.cover_url || COVER_PLACEHOLDER_SQUARE,
        }));
        setNouveautes(nouveautesData);

        // Populaires
        const populairesData = (homeData.popular || []).map(item => ({
          id: item.id,
          title: item.title,
          author: item.author || item.author_name,
          cover: item.cover_url || item.cover_image_url || COVER_PLACEHOLDER_SQUARE,
        }));
        setPopulaires(populairesData);

        // Recommandations
        const recoData = (homeData.recommended || []).map(item => ({
          id: item.id,
          title: item.title,
          author: item.author || item.author_name,
          cover: item.cover_url || item.cover_image_url || COVER_PLACEHOLDER_SQUARE,
          type: item.content_type || 'ebook',
        }));
        setRecommendations(recoData);
      }

      // Fallback: si /home ne renvoie rien pour "continue_reading",
      // on utilise l'historique pour alimenter la section "Reprendre".
      if ((!homeData?.continue_reading || homeData.continue_reading.length === 0) && Array.isArray(historyData?.data)) {
        const inProgress = historyData.data
          .filter((item) => !item?.is_completed && Number(item?.progress_percent || 0) > 0)
          .slice(0, 8)
          .map(mapContinueItem);
        setContinueReading(inProgress);
      }
    } catch (err) {
      console.error('Error loading initial data:', err);
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

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={tokens.colors.primary} />
      </View>
    );
  }

  const renderHeader = () => {
    // Extraire le prénom du nom complet
    const firstName = user?.full_name?.split(' ')[0] || 'Utilisateur';

    return (
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>Bonjour, {firstName}</Text>
          <Text style={styles.subGreeting}>Prêt pour une nouvelle histoire ?</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.searchButton} onPress={() => setSearchVisible(true)}>
            <MaterialCommunityIcons name="magnify" size={24} color={tokens.colors.onSurface.light} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
            {user?.avatar_url ? (
              <Avatar.Image
                size={40}
                source={{ uri: user.avatar_url }}
                style={styles.avatar}
              />
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
    );
  };

  const renderCategories = () => {
    const allCategories = [{ id: '__all__', name: 'Tous', slug: null }, ...apiCategories];
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.categoriesContainer, { flexGrow: 0 }]}
        contentContainerStyle={styles.categoriesContent}
      >
        {allCategories.map((cat) => {
          const isSelected = cat.slug === selectedCategory;
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
              {cat.name}
            </Chip>
          );
        })}
      </ScrollView>
    );
  };

  const renderContinueCard = (item) => (
    <View key={item.id} style={styles.continueCard}>
      <Image source={{ uri: item.cover }} style={styles.continueCardCover} />
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
              {item.type === 'audiobook' ? 'Écouter' : 'Reprendre'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderContinueReading = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Reprendre</Text>
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
      <Image
        source={{ uri: item.cover }}
        style={styles.bookCover}
      />
      <Text style={styles.bookTitle} numberOfLines={1}>
        {item.title}
      </Text>
      <Text style={styles.bookAuthor} numberOfLines={1}>
        {item.author}
      </Text>
    </TouchableOpacity>
  );

  const renderNouveautes = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Nouveautés</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Catalog')}>
          <Text style={styles.seeAllButton}>Tout voir</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.booksScrollContent}
      >
        {nouveautes.map(renderBookCard)}
      </ScrollView>
    </View>
  );

  const renderPopulaires = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Populaires en Afrique</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Catalog')}>
          <Text style={styles.seeAllButton}>Tout voir</Text>
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
        <Text style={styles.sectionTitle}>Ça peut vous intéresser</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Catalog')}>
          <Text style={styles.seeAllButton}>Tout voir</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.booksScrollContent}
      >
        {recommendations.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.bookCard}
            onPress={() => navigation.navigate('ContentDetail', { contentId: item.id })}
          >
            <View style={styles.bookCoverWrapper}>
              <Image source={{ uri: item.cover }} style={styles.bookCover} />
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
        ))}
      </ScrollView>
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
              <Text style={styles.filterEmptyText}>Aucun contenu dans cette catégorie</Text>
            </View>
          ) : (
            <View style={styles.filteredGrid}>
              <View style={styles.filteredGridHeader}>
                <Text style={styles.filteredGridCount}>
                  {filteredContents.length} contenu{filteredContents.length > 1 ? 's' : ''}
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
                      <Image
                        source={{ uri: item.cover_url || 'https://placehold.co/200x300/EEE/AAA?text=📚' }}
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
                <Text style={styles.offlineBannerText}>Mode hors-ligne — contenu limité aux téléchargements</Text>
              </View>
            )}

            {/* Section téléchargements */}
            {offlineContents.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.offlineSectionTitle}>
                    <MaterialCommunityIcons name="download-circle" size={18} color={tokens.colors.primary} />
                    <Text style={styles.sectionTitle}>Mes téléchargements</Text>
                  </View>
                  <TouchableOpacity onPress={() => navigation.navigate('Downloads')}>
                    <Text style={styles.seeAll}>Gérer</Text>
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
                        {item.cover_url ? (
                          <Image source={{ uri: item.cover_url }} style={styles.offlineCover} resizeMode="cover" />
                        ) : (
                          <View style={[styles.offlineCover, styles.offlineCoverPlaceholder]}>
                            <MaterialCommunityIcons
                              name={isAudio ? 'headphones' : 'book-open-variant'}
                              size={22}
                              color={tokens.colors.primary}
                            />
                          </View>
                        )}
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
            {nouveautes.length > 0 && renderNouveautes()}
            {populaires.length > 0 && renderPopulaires()}
            {recommendations.length > 0 && renderRecommendations()}

            {/* Empty state — shown when no content is available at all */}
            {continueReading.length === 0 && nouveautes.length === 0 && populaires.length === 0 && recommendations.length === 0 && (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="bookshelf" size={64} color="#d4c4b5" />
                <Text style={styles.emptyStateTitle}>Bibliothèque en préparation</Text>
                <Text style={styles.emptyStateText}>
                  Aucun contenu disponible pour l'instant.{'\n'}
                  Les livres et audiobooks apparaîtront ici dès qu'ils seront publiés.
                </Text>
                <TouchableOpacity
                  style={styles.emptyStateButton}
                  onPress={() => navigation.navigate('Catalog')}
                >
                  <MaterialCommunityIcons name="compass-outline" size={18} color="#fff" />
                  <Text style={styles.emptyStateButtonText}>Explorer le catalogue</Text>
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
            <Text style={styles.searchModalTitle}>Recherche</Text>
            <View style={styles.searchCloseButton} />
          </View>

          <View style={styles.searchInputWrap}>
            <MaterialCommunityIcons name="magnify" size={20} color="#867465" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Titre, auteur..."
              placeholderTextColor="#9a8f86"
              style={styles.searchInput}
              autoFocus
              returnKeyType="search"
            />
          </View>

          <ScrollView contentContainerStyle={styles.searchResultsContent}>
            {searchQuery.trim().length < 2 ? (
              <Text style={styles.searchHint}>Tape au moins 2 caractères.</Text>
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
              <Text style={styles.searchHint}>Aucun résultat.</Text>
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
                <Image source={{ uri: item.cover }} style={styles.searchResultCover} />
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
    fontSize: 24,
    fontWeight: '700',
    color: tokens.colors.onBackground.light,
    fontFamily: 'Playfair Display',
  },
  subGreeting: {
    fontSize: 14,
    color: '#867465',
    marginTop: 2,
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
