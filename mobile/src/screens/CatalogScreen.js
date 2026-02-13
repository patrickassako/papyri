import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  Dimensions
} from 'react-native';
import { Text, IconButton, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { contentsService } from '../services/contents.service';
import BottomNavBar from '../components/BottomNavBar';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2; // 2 columns with padding

export default function CatalogScreen({ navigation }) {
  const [contents, setContents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const limit = 20;

  useEffect(() => {
    loadCategories();
    loadContents(true);
  }, []);

  useEffect(() => {
    if (selectedCategory !== '') {
      loadContents(true);
    }
  }, [selectedCategory]);

  const loadCategories = async () => {
    try {
      const data = await contentsService.getCategories();
      setCategories(data);
    } catch (err) {
      console.error('Error loading categories:', err);
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
        sort: 'published_at',
        order: 'desc'
      };

      if (selectedCategory) params.category = selectedCategory;

      const response = await contentsService.getContents(params);

      if (reset) {
        setContents(response.data);
      } else {
        setContents([...contents, ...response.data]);
      }

      setHasMore(currentPage < response.meta.totalPages);
    } catch (err) {
      console.error('Error loading contents:', err);
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

  const renderCategoryChip = ({ item, index }) => {
    const isAll = index === 0;
    const isSelected = isAll ? !selectedCategory : selectedCategory === item.slug;

    return (
      <TouchableOpacity
        onPress={() => setSelectedCategory(isAll ? '' : item.slug)}
        style={[
          styles.categoryChip,
          isSelected && styles.categoryChipSelected
        ]}
        activeOpacity={0.7}
      >
        <Text style={[
          styles.categoryChipText,
          isSelected && styles.categoryChipTextSelected
        ]}>
          {isAll ? 'Tout' : item.name}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderFeaturedBanner = () => (
    <View style={styles.featuredContainer}>
      <LinearGradient
        colors={['#D4A017', 'rgba(212, 160, 23, 0.8)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.featuredGradient}
      >
        {/* Pattern overlay */}
        <View style={styles.patternOverlay} />
        
        {/* Content */}
        <View style={styles.featuredContent}>
          <View style={styles.featuredBadge}>
            <Text style={styles.featuredBadgeText}>AUTEUR À L'HONNEUR</Text>
          </View>
          <Text style={styles.featuredTitle}>Chinua Achebe</Text>
          <Text style={styles.featuredDescription} numberOfLines={2}>
            Redécouvrez les classiques de la littérature africaine moderne
          </Text>
          <TouchableOpacity style={styles.featuredButton}>
            <Text style={styles.featuredButtonText}>Explorer</Text>
          </TouchableOpacity>
        </View>

        {/* Background icon */}
        <View style={styles.featuredIconContainer}>
          <MaterialCommunityIcons 
            name="book-open-page-variant" 
            size={150} 
            color="rgba(255,255,255,0.15)" 
          />
        </View>
      </LinearGradient>
    </View>
  );

  const renderBookCard = ({ item }) => {
    const isAudiobook = item.content_type === 'audiobook';
    const isLocked = false; // TODO: Check user subscription

    return (
      <TouchableOpacity
        style={styles.bookCard}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('ContentDetail', { contentId: item.id })}
      >
        {/* Cover Image */}
        <View style={styles.coverContainer}>
          <Image
            source={{ uri: item.cover_url }}
            style={styles.coverImage}
            resizeMode="cover"
          />
          
          {/* Type Badge */}
          <View style={styles.typeBadge}>
            <MaterialCommunityIcons
              name={isAudiobook ? 'headphones' : 'book'}
              size={12}
              color="#171412"
            />
            <Text style={styles.typeBadgeText}>
              {isAudiobook ? 'AUDIO' : 'EBOOK'}
            </Text>
          </View>

          {/* Action Button */}
          {isLocked ? (
            <View style={styles.lockButton}>
              <MaterialCommunityIcons name="lock" size={16} color="#fff" />
            </View>
          ) : (
            <TouchableOpacity style={styles.downloadButton}>
              <MaterialCommunityIcons name="download" size={18} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        {/* Book Info */}
        <View style={styles.bookInfo}>
          <Text style={styles.bookTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.bookAuthor} numberOfLines={1}>
            {item.author}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSkeletonCard = () => (
    <View style={styles.bookCard}>
      <View style={[styles.coverContainer, styles.skeleton]} />
      <View style={styles.bookInfo}>
        <View style={[styles.skeletonLine, { width: '75%' }]} />
        <View style={[styles.skeletonLine, { width: '50%', height: 14 }]} />
      </View>
    </View>
  );

  const renderFooter = () => {
    // Show loader while loading more
    if (loading && !refreshing && contents.length > 0) {
      return (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="small" color="#b4641d" />
        </View>
      );
    }

    // Show "Load More" button if there's more content
    if (hasMore && !loading && contents.length > 0) {
      return (
        <View style={styles.loadMoreContainer}>
          <TouchableOpacity
            style={styles.loadMoreButton}
            onPress={handleLoadMore}
          >
            <Text style={styles.loadMoreText}>Charger plus</Text>
            <MaterialCommunityIcons name="chevron-down" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      );
    }

    return null;
  };

  const ListHeaderComponent = () => (
    <>
      {/* Featured Banner */}
      {renderFeaturedBanner()}
      
      {/* Content Grid Starts Here - just a spacer */}
      <View style={styles.gridSpacer} />
    </>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Catalogue</Text>
        <View style={styles.headerActions}>
          <IconButton
            icon="tune"
            size={24}
            iconColor="#171412"
            onPress={() => {/* TODO: Open filters */}}
          />
          <IconButton
            icon="magnify"
            size={28}
            iconColor="#171412"
            onPress={() => {/* TODO: Open search */}}
          />
        </View>
      </View>

      {/* Category Filters */}
      <View style={styles.categoriesContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[{ id: 'all', name: 'Tout' }, ...categories]}
          renderItem={renderCategoryChip}
          keyExtractor={(item) => item.id || item.slug}
          contentContainerStyle={styles.categoriesList}
        />
      </View>

      {/* Content Grid */}
      <FlatList
        data={contents}
        renderItem={renderBookCard}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        ListHeaderComponent={ListHeaderComponent}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        contentContainerStyle={styles.gridContent}
      />

      {/* Bottom Navigation */}
      <BottomNavBar navigation={navigation} activeTab="Catalog" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBF7F2'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  headerTitle: {
    fontFamily: 'Playfair Display',
    fontSize: 30,
    fontWeight: '700',
    color: '#171412',
    letterSpacing: -0.5
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: -8
  },
  categoriesContainer: {
    paddingBottom: 16
  },
  categoriesList: {
    paddingHorizontal: 16,
    gap: 8
  },
  categoryChip: {
    height: 36,
    paddingHorizontal: 20,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e0dc',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8
  },
  categoryChipSelected: {
    backgroundColor: '#b4641d',
    borderColor: '#b4641d'
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#171412'
  },
  categoryChipTextSelected: {
    color: '#fff',
    fontWeight: '600'
  },
  gridContent: {
    paddingBottom: 100
  },
  gridSpacer: {
    height: 8
  },
  row: {
    paddingHorizontal: 16,
    marginBottom: 32,
    justifyContent: 'space-between'
  },
  featuredContainer: {
    marginHorizontal: 16,
    marginBottom: 40,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#D4A017',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6
  },
  featuredGradient: {
    minHeight: 180,
    position: 'relative',
    overflow: 'hidden'
  },
  patternOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    opacity: 0.1
  },
  featuredContent: {
    padding: 24,
    zIndex: 10,
    maxWidth: '70%'
  },
  featuredBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 12
  },
  featuredBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2
  },
  featuredTitle: {
    fontFamily: 'Playfair Display',
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8
  },
  featuredDescription: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
    marginBottom: 16,
    lineHeight: 20
  },
  featuredButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start'
  },
  featuredButtonText: {
    color: '#D4A017',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase'
  },
  featuredIconContainer: {
    position: 'absolute',
    right: -20,
    top: -20,
    opacity: 0.2
  },
  bookCard: {
    width: CARD_WIDTH,
    marginBottom: 8
  },
  coverContainer: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#e5e0dc',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2
  },
  coverImage: {
    width: '100%',
    height: '100%'
  },
  typeBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#171412',
    letterSpacing: 0.5
  },
  downloadButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#b4641d',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#b4641d',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4
  },
  lockButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  bookInfo: {
    marginTop: 8,
    gap: 4
  },
  bookTitle: {
    fontFamily: 'Playfair Display',
    fontSize: 16,
    fontWeight: '700',
    color: '#171412',
    lineHeight: 20
  },
  bookAuthor: {
    fontSize: 14,
    fontWeight: '500',
    color: '#867465'
  },
  skeleton: {
    backgroundColor: '#e5e0dc'
  },
  skeletonLine: {
    height: 16,
    backgroundColor: '#e5e0dc',
    borderRadius: 4,
    marginBottom: 8
  },
  loaderContainer: {
    paddingVertical: 24,
    alignItems: 'center'
  },
  loadMoreContainer: {
    paddingVertical: 24,
    alignItems: 'center'
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#b4641d',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#b4641d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6
  },
  loadMoreText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5
  }
});
