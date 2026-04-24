import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  Dimensions,
  Modal,
  TextInput,
  Keyboard,
  Pressable,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { contentsService } from '../services/contents.service';
import BottomNavBar from '../components/BottomNavBar';
import BookCover from '../components/BookCover';

const tokens = require('../config/tokens');
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2;

const SORT_OPTIONS = [
  { key: 'newest', label: 'Plus récents', icon: 'clock-outline' },
  { key: 'oldest', label: 'Plus anciens', icon: 'clock-check-outline' },
  { key: 'title', label: 'Titre A→Z', icon: 'sort-alphabetical-ascending' },
  { key: 'popular', label: 'Populaires', icon: 'trending-up' },
];

const TYPE_OPTIONS = [
  { key: '', label: 'Tous', icon: 'bookshelf' },
  { key: 'ebook', label: 'Ebooks', icon: 'book-open-variant' },
  { key: 'audiobook', label: 'Audiobooks', icon: 'headphones' },
];

export default function CatalogScreen({ navigation, route }) {
  const initialCategory = route?.params?.initialCategory || '';

  const [contents, setContents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [selectedType, setSelectedType] = useState('');
  const [selectedSort, setSelectedSort] = useState('newest');

  // Search
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimer = useRef(null);

  // Filter modal
  const [filterVisible, setFilterVisible] = useState(false);
  // draft state inside modal
  const [draftType, setDraftType] = useState('');
  const [draftSort, setDraftSort] = useState('newest');

  // Recommandation dynamique — change à chaque ouverture de la page
  const [recommendation, setRecommendation] = useState(null);

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadContents(true);
  }, [selectedCategory, selectedType, selectedSort]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tire une recommandation aléatoire à chaque ouverture de la page
  useFocusEffect(
    useCallback(() => {
      const pick = async () => {
        try {
          const result = await contentsService.getContents({ page: 1, limit: 50, sort: 'published_at', order: 'desc' });
          const items = result?.data || [];
          if (items.length > 0) {
            setRecommendation(items[Math.floor(Math.random() * items.length)]);
          }
        } catch (_) {}
      };
      pick();
    }, [])
  );

  const loadCategories = async () => {
    try {
      const data = await contentsService.getCategories();
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Categories error:', err);
    }
  };

  const loadContents = useCallback(async (reset = false) => {
    try {
      const currentPage = reset ? 1 : page + 1;
      if (reset) {
        setLoading(true);
        setPage(1);
      } else {
        setLoadingMore(true);
      }

      const params = {
        page: currentPage,
        limit: 20,
        sort: selectedSort,
      };
      if (selectedCategory) params.category = selectedCategory;
      if (selectedType) params.type = selectedType;

      const response = await contentsService.getContents(params);
      const newItems = response.data || [];
      const meta = response.meta || {};

      if (reset) {
        setContents(newItems);
      } else {
        setContents((prev) => [...prev, ...newItems]);
      }

      setTotalPages(meta.totalPages || 1);
      setTotal(meta.total || 0);
      if (!reset) setPage(currentPage);
    } catch (err) {
      console.error('Contents error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [selectedCategory, selectedType, selectedSort, page]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadContents(true);
  };

  const handleLoadMore = () => {
    if (!loadingMore && !loading && page < totalPages) {
      loadContents(false);
    }
  };

  // ── Search ─────────────────────────────────────────────
  useEffect(() => {
    if (!searchVisible) return;
    clearTimeout(searchTimer.current);
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const result = await contentsService.search(q, { limit: 30 });
        setSearchResults(result.hits || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(searchTimer.current);
  }, [searchQuery, searchVisible]);

  const openSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchVisible(true);
  };

  const closeSearch = () => {
    setSearchVisible(false);
    setSearchQuery('');
    setSearchResults([]);
    Keyboard.dismiss();
  };

  // ── Filter modal ──────────────────────────────────────
  const openFilter = () => {
    setDraftType(selectedType);
    setDraftSort(selectedSort);
    setFilterVisible(true);
  };

  const applyFilter = () => {
    setSelectedType(draftType);
    setSelectedSort(draftSort);
    setFilterVisible(false);
  };

  const activeFilterCount = (selectedType ? 1 : 0) + (selectedSort !== 'newest' ? 1 : 0);

  // ── Renderers ─────────────────────────────────────────
  const renderCategoryChip = ({ item, index }) => {
    const isAll = index === 0;
    const isSelected = isAll ? !selectedCategory : selectedCategory === item.slug;
    return (
      <TouchableOpacity
        onPress={() => setSelectedCategory(isAll ? '' : item.slug)}
        style={[styles.chip, isSelected && styles.chipSelected]}
        activeOpacity={0.7}
      >
        <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
          {isAll ? 'Tout' : item.name}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderBookCard = ({ item }) => {
    const isAudio = item.content_type === 'audiobook';
    return (
      <TouchableOpacity
        style={styles.bookCard}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('ContentDetail', { contentId: item.id })}
      >
        <View style={styles.coverWrap}>
          <BookCover uri={item.cover_url} title={item.title} style={styles.coverImage} />
          <View style={styles.typeBadge}>
            <MaterialCommunityIcons name={isAudio ? 'headphones' : 'book'} size={11} color="#171412" />
            <Text style={styles.typeBadgeText}>{isAudio ? 'Audio' : 'E-book'}</Text>
          </View>
        </View>
        <View style={styles.bookInfo}>
          <Text style={styles.bookTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.bookAuthor} numberOfLines={1}>{item.author}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSearchResult = (item) => (
    <TouchableOpacity
      key={item.id}
      style={styles.searchResultCard}
      onPress={() => {
        closeSearch();
        navigation.navigate('ContentDetail', { contentId: item.id });
      }}
    >
      <BookCover uri={item.cover_url} title={item.title} style={styles.searchResultCover} />
      <View style={styles.searchResultBody}>
        <Text style={styles.searchResultTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.searchResultAuthor} numberOfLines={1}>{item.author}</Text>
        <View style={styles.searchResultType}>
          <MaterialCommunityIcons
            name={item.content_type === 'audiobook' ? 'headphones' : 'book-open-variant'}
            size={12}
            color="#867465"
          />
          <Text style={styles.searchResultTypeText}>
            {item.content_type === 'audiobook' ? 'Audio' : 'E-book'}
          </Text>
        </View>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color="#ccc" />
    </TouchableOpacity>
  );

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🔍</Text>
        <Text style={styles.emptyTitle}>Aucun contenu trouvé</Text>
        <Text style={styles.emptyText}>
          {selectedCategory || selectedType
            ? 'Essaie un autre filtre ou catégorie'
            : 'Le catalogue sera bientôt disponible'}
        </Text>
        {(selectedCategory || selectedType) && (
          <TouchableOpacity
            style={styles.emptyReset}
            onPress={() => { setSelectedCategory(''); setSelectedType(''); }}
          >
            <Text style={styles.emptyResetText}>Réinitialiser les filtres</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderFooter = () => {
    if (loadingMore) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color={tokens.colors.primary} />
        </View>
      );
    }
    return null;
  };

  const renderFeatured = () => {
    if (!recommendation) return null;
    const coverUri = recommendation.cover_url || recommendation.thumbnail_url || null;
    const title = recommendation.title || '';
    const author = recommendation.author || recommendation.author_name || '';
    const desc = recommendation.description || recommendation.excerpt || '';
    return (
      <View style={styles.featuredWrap}>
        <LinearGradient
          colors={['#b4641d', 'rgba(180,100,29,0.85)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.featuredGradient}
        >
          <View style={styles.featuredContent}>
            <View style={styles.featuredBadge}>
              <MaterialCommunityIcons name="star-four-points" size={10} color="#fff" style={{ marginRight: 4 }} />
              <Text style={styles.featuredBadgeText}>RECOMMANDATION</Text>
            </View>
            <Text style={styles.featuredTitle} numberOfLines={2}>{title}</Text>
            {!!author && (
              <Text style={styles.featuredAuthor} numberOfLines={1}>{author}</Text>
            )}
            {!!desc && (
              <Text style={styles.featuredDesc} numberOfLines={2}>{desc}</Text>
            )}
            <TouchableOpacity
              style={styles.featuredBtn}
              onPress={() => navigation.navigate('ContentDetail', { contentId: recommendation.id })}
            >
              <Text style={styles.featuredBtnText}>Découvrir</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.featuredIconBg}>
            {coverUri ? (
              <Image source={{ uri: coverUri }} style={styles.featuredCover} resizeMode="cover" />
            ) : (
              <MaterialCommunityIcons name="book-open-page-variant" size={120} color="rgba(255,255,255,0.2)" />
            )}
          </View>
        </LinearGradient>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Catalogue</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerBtn} onPress={openFilter}>
            <MaterialCommunityIcons name="tune" size={22} color="#171412" />
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={openSearch}>
            <MaterialCommunityIcons name="magnify" size={24} color="#171412" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Category chips */}
      <View style={styles.chipsWrap}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[{ id: 'all', name: 'Tout', slug: '' }, ...categories]}
          renderItem={renderCategoryChip}
          keyExtractor={(item) => item.id || item.slug}
          contentContainerStyle={styles.chipsList}
          style={{ flexGrow: 0 }}
        />
      </View>

      {/* Active filter indicator */}
      {(selectedType || selectedSort !== 'published_at:desc') && (
        <View style={styles.activeFilters}>
          {selectedType ? (
            <View style={styles.activeFilterTag}>
              <Text style={styles.activeFilterTagText}>
                {TYPE_OPTIONS.find(t => t.key === selectedType)?.label}
              </Text>
              <TouchableOpacity onPress={() => setSelectedType('')}>
                <MaterialCommunityIcons name="close-circle" size={14} color={tokens.colors.primary} />
              </TouchableOpacity>
            </View>
          ) : null}
          {selectedSort !== 'newest' ? (
            <View style={styles.activeFilterTag}>
              <Text style={styles.activeFilterTagText}>
                {SORT_OPTIONS.find(s => s.key === selectedSort)?.label}
              </Text>
              <TouchableOpacity onPress={() => setSelectedSort('newest')}>
                <MaterialCommunityIcons name="close-circle" size={14} color={tokens.colors.primary} />
              </TouchableOpacity>
            </View>
          ) : null}
          <Text style={styles.totalCount}>{total} résultat{total > 1 ? 's' : ''}</Text>
        </View>
      )}

      {/* Grid */}
      {loading && contents.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={tokens.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={contents}
          renderItem={renderBookCard}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          ListHeaderComponent={renderFeatured}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[tokens.colors.primary]}
              tintColor={tokens.colors.primary}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          contentContainerStyle={styles.gridContent}
        />
      )}

      <BottomNavBar navigation={navigation} activeTab="Catalog" />

      {/* ── Search Modal ── */}
      <Modal visible={searchVisible} animationType="slide" onRequestClose={closeSearch}>
        <SafeAreaView style={styles.searchModal} edges={['top', 'bottom']}>
          <View style={styles.searchHeader}>
            <TouchableOpacity onPress={closeSearch} style={styles.searchBackBtn}>
              <MaterialCommunityIcons name="arrow-left" size={22} color="#171412" />
            </TouchableOpacity>
            <View style={styles.searchInputWrap}>
              <MaterialCommunityIcons name="magnify" size={18} color="#867465" />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Titre, auteur, catégorie..."
                placeholderTextColor="#9a8f86"
                style={styles.searchInput}
                autoFocus
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <MaterialCommunityIcons name="close-circle" size={16} color="#aaa" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <FlatList
            data={searchQuery.trim().length >= 2 ? searchResults : []}
            keyExtractor={(item, index) => item.id || String(index)}
            renderItem={({ item }) => renderSearchResult(item)}
            contentContainerStyle={styles.searchResults}
            ListEmptyComponent={
              <View style={styles.searchHintWrap}>
                {searchLoading ? (
                  <ActivityIndicator size="small" color={tokens.colors.primary} />
                ) : searchQuery.trim().length < 2 ? (
                  <Text style={styles.searchHint}>Tape au moins 2 caractères...</Text>
                ) : (
                  <Text style={styles.searchHint}>Aucun résultat pour "{searchQuery}"</Text>
                )}
              </View>
            }
          />
        </SafeAreaView>
      </Modal>

      {/* ── Filter Modal ── */}
      <Modal visible={filterVisible} transparent animationType="slide" onRequestClose={() => setFilterVisible(false)}>
        <View style={styles.filterModalRoot}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setFilterVisible(false)} />
          <View style={styles.filterSheet}>
          <View style={styles.filterHandle} />
          <Text style={styles.filterSheetTitle}>Filtres & Tri</Text>

          <Text style={styles.filterSectionLabel}>Type de contenu</Text>
          <View style={styles.filterOptions}>
            {TYPE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.filterOption, draftType === opt.key && styles.filterOptionSelected]}
                onPress={() => setDraftType(opt.key)}
              >
                <MaterialCommunityIcons
                  name={opt.icon}
                  size={18}
                  color={draftType === opt.key ? '#fff' : tokens.colors.onSurface.light}
                />
                <Text style={[styles.filterOptionText, draftType === opt.key && styles.filterOptionTextSelected]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.filterSectionLabel}>Trier par</Text>
          <View style={styles.filterSortList}>
            {SORT_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={styles.filterSortRow}
                onPress={() => setDraftSort(opt.key)}
              >
                <View style={styles.filterSortLeft}>
                  <MaterialCommunityIcons name={opt.icon} size={18} color="#867465" />
                  <Text style={styles.filterSortText}>{opt.label}</Text>
                </View>
                <View style={[styles.filterRadio, draftSort === opt.key && styles.filterRadioSelected]}>
                  {draftSort === opt.key && <View style={styles.filterRadioDot} />}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.filterActions}>
            <TouchableOpacity
              style={styles.filterResetBtn}
              onPress={() => { setDraftType(''); setDraftSort('newest'); }}
            >
              <Text style={styles.filterResetText}>Réinitialiser</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.filterApplyBtn} onPress={applyFilter}>
              <Text style={styles.filterApplyText}>Appliquer</Text>
            </TouchableOpacity>
          </View>
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
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontFamily: 'Playfair Display',
    fontSize: 28,
    fontWeight: '700',
    color: '#171412',
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: tokens.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },

  // Chips
  chipsWrap: {
    paddingBottom: 8,
  },
  chipsList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    height: 34,
    paddingHorizontal: 18,
    borderRadius: 17,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e0dc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipSelected: {
    backgroundColor: tokens.colors.primary,
    borderColor: tokens.colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#171412',
  },
  chipTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },

  // Active filters bar
  activeFilters: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
    flexWrap: 'wrap',
  },
  activeFilterTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${tokens.colors.primary}15`,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  activeFilterTagText: {
    fontSize: 12,
    color: tokens.colors.primary,
    fontWeight: '600',
  },
  totalCount: {
    fontSize: 12,
    color: '#867465',
    marginLeft: 'auto',
  },

  // Grid
  gridContent: {
    paddingBottom: 100,
  },
  row: {
    paddingHorizontal: 16,
    marginBottom: 24,
    justifyContent: 'space-between',
  },

  // Featured
  featuredWrap: {
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#D4A017',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  featuredGradient: {
    minHeight: 160,
    overflow: 'hidden',
  },
  featuredContent: {
    padding: 20,
    zIndex: 10,
    maxWidth: '70%',
  },
  featuredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  featuredBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  featuredTitle: {
    fontFamily: 'Playfair Display',
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  featuredAuthor: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  featuredDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 14,
    lineHeight: 18,
  },
  featuredBtn: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 7,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  featuredIconBg: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '35%',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  featuredCover: {
    width: '100%',
    height: '100%',
    opacity: 0.35,
  },
  featuredBtnText: {
    color: '#b4641d',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Book card
  bookCard: {
    width: CARD_WIDTH,
    marginBottom: 4,
  },
  coverWrap: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#e5e0dc',
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  typeBadge: {
    position: 'absolute',
    top: 7,
    left: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#171412',
    letterSpacing: 0.3,
  },
  bookInfo: {
    marginTop: 8,
    gap: 3,
  },
  bookTitle: {
    fontFamily: 'Playfair Display',
    fontSize: 14,
    fontWeight: '700',
    color: '#171412',
    lineHeight: 18,
  },
  bookAuthor: {
    fontSize: 12,
    fontWeight: '500',
    color: '#867465',
  },

  // Empty state
  emptyContainer: {
    paddingTop: 60,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#171412',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#867465',
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyReset: {
    backgroundColor: tokens.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  emptyResetText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },

  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },

  // Search modal
  searchModal: {
    flex: 1,
    backgroundColor: '#FBF7F2',
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchBackBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ded6d0',
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#171412',
    height: 44,
  },
  searchResults: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },
  searchHintWrap: {
    paddingTop: 40,
    alignItems: 'center',
  },
  searchHint: {
    color: '#867465',
    fontSize: 14,
  },
  searchResultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e7dfd8',
    padding: 10,
    marginBottom: 10,
  },
  searchResultCover: {
    width: 52,
    height: 76,
    borderRadius: 6,
    backgroundColor: '#eee',
  },
  searchResultBody: {
    flex: 1,
  },
  searchResultTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#171412',
    lineHeight: 18,
    marginBottom: 3,
  },
  searchResultAuthor: {
    fontSize: 12,
    color: '#867465',
    marginBottom: 5,
  },
  searchResultType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  searchResultTypeText: {
    fontSize: 11,
    color: '#867465',
    fontWeight: '600',
  },

  // Filter sheet
  filterModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  filterSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 12,
  },
  filterHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ddd',
    alignSelf: 'center',
    marginBottom: 16,
  },
  filterSheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#171412',
    marginBottom: 20,
  },
  filterSectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#867465',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  filterOptions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  filterOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e5e0dc',
    backgroundColor: '#faf7f4',
  },
  filterOptionSelected: {
    backgroundColor: tokens.colors.primary,
    borderColor: tokens.colors.primary,
  },
  filterOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.onSurface.light,
  },
  filterOptionTextSelected: {
    color: '#fff',
  },
  filterSortList: {
    gap: 4,
    marginBottom: 28,
  },
  filterSortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0ece8',
  },
  filterSortLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  filterSortText: {
    fontSize: 15,
    color: '#171412',
    fontWeight: '500',
  },
  filterRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterRadioSelected: {
    borderColor: tokens.colors.primary,
  },
  filterRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: tokens.colors.primary,
  },
  filterActions: {
    flexDirection: 'row',
    gap: 12,
  },
  filterResetBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#e5e0dc',
    alignItems: 'center',
  },
  filterResetText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#867465',
  },
  filterApplyBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: tokens.colors.primary,
    alignItems: 'center',
  },
  filterApplyText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
