import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  ScrollView
} from 'react-native';
import {
  Appbar,
  Text,
  Chip,
  Menu,
  Button,
  Portal,
  Modal,
  Divider,
  ActivityIndicator
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import ContentCard from '../components/ContentCard';
import { contentsService } from '../services/contents.service';
import { COLORS } from '../theme/colors';

/**
 * Screen du catalogue de contenus (mobile)
 */
export default function CatalogScreen({ navigation }) {
  const [contents, setContents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filtres
  const [selectedCategory, setSelectedCategory] = useState('');
  const [contentType, setContentType] = useState('');
  const [language, setLanguage] = useState('');
  const [sortBy, setSortBy] = useState('published_at');

  // Pagination
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const limit = 10;

  // Menus
  const [filterMenuVisible, setFilterMenuVisible] = useState(false);
  const [sortMenuVisible, setSortMenuVisible] = useState(false);

  // Charger les catégories au montage
  useEffect(() => {
    loadCategories();
  }, []);

  // Charger les contenus quand les filtres changent
  useEffect(() => {
    loadContents(true);
  }, [selectedCategory, contentType, language, sortBy]);

  const loadCategories = async () => {
    try {
      const data = await contentsService.getCategories();
      setCategories(data);
    } catch (err) {
      console.error('Erreur chargement catégories:', err);
    }
  };

  const loadContents = async (reset = false) => {
    if (loading && !reset) return;

    try {
      const currentPage = reset ? 1 : page;
      if (reset) {
        setLoading(true);
        setPage(1);
      }

      const params = {
        page: currentPage,
        limit,
        sort: sortBy,
        order: 'desc'
      };

      if (contentType) params.content_type = contentType;
      if (language) params.language = language;
      if (selectedCategory) params.category = selectedCategory;

      const response = await contentsService.getContents(params);
      console.log('📚 [CatalogScreen] Response received:', {
        dataCount: response.data?.length || 0,
        meta: response.meta,
        firstItem: response.data?.[0]?.title
      });

      if (reset) {
        setContents(response.data);
      } else {
        setContents([...contents, ...response.data]);
      }

      setTotalItems(response.meta.total);
      setHasMore(currentPage < response.meta.totalPages);
      setError(null);
      console.log('✅ [CatalogScreen] State updated - totalItems:', response.meta.total);
    } catch (err) {
      console.error('Erreur chargement contenus:', err);
      setError('Impossible de charger le catalogue');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadContents(true);
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      setPage(page + 1);
      loadContents(false);
    }
  };

  const handleCategorySelect = (categorySlug) => {
    setSelectedCategory(categorySlug);
  };

  const handleResetFilters = () => {
    setSelectedCategory('');
    setContentType('');
    setLanguage('');
    setSortBy('published_at');
  };

  const activeFiltersCount = [contentType, language, selectedCategory].filter(Boolean).length;

  const renderHeader = () => (
    <View style={styles.header}>
      <Text variant="headlineMedium" style={styles.title}>
        Catalogue
      </Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        {totalItems} livre{totalItems > 1 ? 's' : ''} disponible{totalItems > 1 ? 's' : ''}
      </Text>

      {/* Catégories horizontales */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesScroll}
        contentContainerStyle={styles.categoriesContent}
      >
        <Chip
          selected={!selectedCategory}
          onPress={() => handleCategorySelect('')}
          style={styles.categoryChip}
          selectedColor="#fff"
          mode={!selectedCategory ? 'flat' : 'outlined'}
        >
          Tous
        </Chip>
        {categories.map((cat) => (
          <Chip
            key={cat.id}
            selected={selectedCategory === cat.slug}
            onPress={() => handleCategorySelect(cat.slug)}
            style={styles.categoryChip}
            selectedColor="#fff"
            mode={selectedCategory === cat.slug ? 'flat' : 'outlined'}
          >
            {cat.name}
          </Chip>
        ))}
      </ScrollView>

      {/* Filtres */}
      <View style={styles.filtersRow}>
        <Button
          mode="outlined"
          compact
          onPress={() => setFilterMenuVisible(true)}
          style={styles.filterButton}
        >
          Filtres {activeFiltersCount > 0 && `(${activeFiltersCount})`}
        </Button>

        <Button
          mode="outlined"
          compact
          onPress={() => setSortMenuVisible(true)}
          style={styles.filterButton}
        >
          Trier
        </Button>

        {activeFiltersCount > 0 && (
          <Button
            mode="text"
            compact
            onPress={handleResetFilters}
            textColor={COLORS.primary}
          >
            Réinitialiser
          </Button>
        )}
      </View>
    </View>
  );

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text variant="titleMedium" style={styles.emptyTitle}>
          Aucun contenu trouvé
        </Text>
        <Text variant="bodyMedium" style={styles.emptyText}>
          Essayez de modifier vos critères de recherche
        </Text>
      </View>
    );
  };

  const renderFooter = () => {
    if (!loading || refreshing) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={COLORS.primary} />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Catalogue" />
      </Appbar.Header>

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Button mode="contained" onPress={() => loadContents(true)}>
            Réessayer
          </Button>
        </View>
      ) : (
        <FlatList
          data={contents}
          renderItem={({ item }) => (
            <View style={styles.cardContainer}>
              <ContentCard content={item} />
            </View>
          )}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Modal Filtres */}
      <Portal>
        <Modal
          visible={filterMenuVisible}
          onDismiss={() => setFilterMenuVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <Text variant="titleLarge" style={styles.modalTitle}>
            Filtres
          </Text>

          <Divider style={styles.divider} />

          <Text variant="labelLarge" style={styles.filterLabel}>
            Type
          </Text>
          <View style={styles.chipGroup}>
            <Chip
              selected={!contentType}
              onPress={() => setContentType('')}
              style={styles.filterChip}
            >
              Tous
            </Chip>
            <Chip
              selected={contentType === 'ebook'}
              onPress={() => setContentType('ebook')}
              style={styles.filterChip}
            >
              Ebooks
            </Chip>
            <Chip
              selected={contentType === 'audiobook'}
              onPress={() => setContentType('audiobook')}
              style={styles.filterChip}
            >
              Livres audio
            </Chip>
          </View>

          <Text variant="labelLarge" style={styles.filterLabel}>
            Langue
          </Text>
          <View style={styles.chipGroup}>
            <Chip
              selected={!language}
              onPress={() => setLanguage('')}
              style={styles.filterChip}
            >
              Toutes
            </Chip>
            <Chip
              selected={language === 'fr'}
              onPress={() => setLanguage('fr')}
              style={styles.filterChip}
            >
              Français
            </Chip>
            <Chip
              selected={language === 'en'}
              onPress={() => setLanguage('en')}
              style={styles.filterChip}
            >
              Anglais
            </Chip>
          </View>

          <Button
            mode="contained"
            onPress={() => setFilterMenuVisible(false)}
            style={styles.applyButton}
          >
            Appliquer
          </Button>
        </Modal>

        {/* Modal Tri */}
        <Modal
          visible={sortMenuVisible}
          onDismiss={() => setSortMenuVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <Text variant="titleLarge" style={styles.modalTitle}>
            Trier par
          </Text>

          <Divider style={styles.divider} />

          <View style={styles.sortOptions}>
            <Chip
              selected={sortBy === 'published_at'}
              onPress={() => {
                setSortBy('published_at');
                setSortMenuVisible(false);
              }}
              style={styles.sortChip}
            >
              Plus récents
            </Chip>
            <Chip
              selected={sortBy === 'title'}
              onPress={() => {
                setSortBy('title');
                setSortMenuVisible(false);
              }}
              style={styles.sortChip}
            >
              Titre (A-Z)
            </Chip>
            <Chip
              selected={sortBy === 'created_at'}
              onPress={() => {
                setSortBy('created_at');
                setSortMenuVisible(false);
              }}
              style={styles.sortChip}
            >
              Date d'ajout
            </Chip>
          </View>
        </Modal>
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  listContent: {
    paddingBottom: 20
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    marginBottom: 8
  },
  title: {
    fontFamily: 'Playfair Display',
    color: COLORS.primary,
    fontWeight: '700'
  },
  subtitle: {
    color: COLORS.textSecondary,
    marginTop: 4,
    marginBottom: 16
  },
  categoriesScroll: {
    marginBottom: 16
  },
  categoriesContent: {
    paddingRight: 16
  },
  categoryChip: {
    marginRight: 8
  },
  filtersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  filterButton: {
    borderRadius: 8
  },
  cardContainer: {
    paddingHorizontal: 16
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center'
  },
  emptyTitle: {
    marginBottom: 8,
    textAlign: 'center'
  },
  emptyText: {
    color: COLORS.textSecondary,
    textAlign: 'center'
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  errorText: {
    color: 'red',
    marginBottom: 16,
    textAlign: 'center'
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center'
  },
  modal: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 12
  },
  modalTitle: {
    fontWeight: '700',
    marginBottom: 16
  },
  divider: {
    marginBottom: 16
  },
  filterLabel: {
    marginBottom: 12,
    marginTop: 8
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16
  },
  filterChip: {
    marginRight: 8,
    marginBottom: 8
  },
  sortOptions: {
    gap: 12
  },
  sortChip: {
    alignSelf: 'flex-start'
  },
  applyButton: {
    marginTop: 8
  }
});
