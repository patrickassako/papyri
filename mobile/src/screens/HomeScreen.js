import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  StatusBar,
  RefreshControl,
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
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import * as homeService from '../services/home.service';
import * as userService from '../services/user.service';
import BottomNavBar from '../components/BottomNavBar';

// Import shared design tokens
const tokens = require('../config/tokens');

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.85;

const HomeScreen = ({ navigation }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('Tous');
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  // Données de la page d'accueil
  const [continueReading, setContinueReading] = useState([]);
  const [nouveautes, setNouveautes] = useState([]);
  const [populaires, setPopulaires] = useState([]);
  const [currentAudio, setCurrentAudio] = useState(null);

  const categories = ['Tous', 'Littérature', 'Audiobooks', 'Essais', 'Folklore'];

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Charger le profil utilisateur et les données de la page d'accueil en parallèle
      const [userProfile, homeData] = await Promise.all([
        userService.getUserProfile().catch(err => {
          console.warn('Error loading user profile:', err);
          return null;
        }),
        homeService.getHomeData().catch(err => {
          console.warn('Error loading home data:', err);
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
        const continueReadingData = (homeData.continue_reading || []).map(item => ({
          id: item.content_id || item.id,
          title: item.title,
          author: item.author,
          type: item.content_type === 'audiobook' ? 'audiobook' : 'ebook',
          progress: (item.progress_percent || 0) / 100,
          progressText: `${Math.round(item.progress_percent || 0)}% ${
            item.content_type === 'audiobook' ? 'écoutés' : 'terminés'
          }`,
          remainingText: item.remaining_text || '',
          cover: item.cover_url || 'https://via.placeholder.com/150x200',
        }));
        setContinueReading(continueReadingData);

        // Nouveautés
        const nouveautesData = (homeData.new_releases || []).map(item => ({
          id: item.id,
          title: item.title,
          author: item.author,
          cover: item.cover_url || 'https://via.placeholder.com/150x200',
        }));
        setNouveautes(nouveautesData);

        // Populaires
        const populairesData = (homeData.popular || []).map(item => ({
          id: item.id,
          title: item.title,
          author: item.author,
          cover: item.cover_url || 'https://via.placeholder.com/150x200',
        }));
        setPopulaires(populairesData);

        // Vérifier s'il y a un audiobook en cours
        const currentAudiobook = continueReadingData.find(
          item => item.type === 'audiobook'
        );
        if (currentAudiobook) {
          setCurrentAudio({
            title: currentAudiobook.title,
            author: currentAudiobook.author,
            chapter: 'En cours...', // À améliorer avec les vraies données
            progress: currentAudiobook.progress,
            cover: currentAudiobook.cover,
          });
        }
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
          <TouchableOpacity style={styles.searchButton}>
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

  const renderCategories = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.categoriesContainer}
      contentContainerStyle={styles.categoriesContent}
    >
      {categories.map((category) => (
        <Chip
          key={category}
          selected={selectedCategory === category}
          onPress={() => setSelectedCategory(category)}
          style={[
            styles.categoryChip,
            selectedCategory === category && styles.categoryChipSelected,
          ]}
          textStyle={[
            styles.categoryChipText,
            selectedCategory === category && styles.categoryChipTextSelected,
          ]}
        >
          {category}
        </Chip>
      ))}
    </ScrollView>
  );

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
              size={16}
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

  const renderMiniPlayer = () => (
    <View style={styles.miniPlayer}>
      <View style={styles.miniPlayerContent}>
        <View style={styles.miniPlayerLeft}>
          <Image
            source={{ uri: currentAudio.cover }}
            style={styles.miniPlayerCover}
          />
          <View style={styles.miniPlayerInfo}>
            <Text style={styles.miniPlayerTitle}>{currentAudio.title}</Text>
            <Text style={styles.miniPlayerSubtitle}>
              {currentAudio.author} • {currentAudio.chapter}
            </Text>
          </View>
        </View>
        <View style={styles.miniPlayerControls}>
          <TouchableOpacity style={styles.miniPlayerButton}>
            <MaterialCommunityIcons name="rewind" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.miniPlayerPlayButton}
            onPress={() => setIsAudioPlaying(!isAudioPlaying)}
          >
            <MaterialCommunityIcons
              name={isAudioPlaying ? 'pause' : 'play'}
              size={24}
              color="#FFFFFF"
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.miniPlayerButton}>
            <MaterialCommunityIcons name="fast-forward" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.miniPlayerProgress}>
        <View style={[styles.miniPlayerProgressBar, { width: `${currentAudio.progress * 100}%` }]} />
      </View>
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
        {continueReading.length > 0 && renderContinueReading()}
        {nouveautes.length > 0 && renderNouveautes()}
        {populaires.length > 0 && renderPopulaires()}
        <View style={{ height: 180 }} />
      </ScrollView>
      {currentAudio && renderMiniPlayer()}
      {renderBottomNav()}
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
    gap: 16,
    borderWidth: 1,
    borderColor: '#e5e0dc',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  continueCardCover: {
    width: 96,
    height: 144,
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
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.onSurface.light,
    lineHeight: 20,
  },
  continueCardAuthor: {
    fontSize: 14,
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
    paddingVertical: 8,
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
  bookCover: {
    width: 128,
    height: 192,
    borderRadius: 8,
    backgroundColor: tokens.colors.surfaces.light.default,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
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

  // Mini Player
  miniPlayer: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(29, 24, 18, 0.95)',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  miniPlayerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  miniPlayerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  miniPlayerCover: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  miniPlayerInfo: {
    flex: 1,
  },
  miniPlayerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  miniPlayerSubtitle: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  miniPlayerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  miniPlayerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniPlayerPlayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tokens.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniPlayerProgress: {
    position: 'absolute',
    bottom: 0,
    left: 48,
    right: 48,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 1,
  },
  miniPlayerProgressBar: {
    height: '100%',
    backgroundColor: tokens.colors.primary,
    borderRadius: 1,
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
});

export default HomeScreen;
