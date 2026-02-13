import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { contentsService } from '../services/contents.service';
import { subscriptionService } from '../services/subscription.service';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COVER_WIDTH = SCREEN_WIDTH * 0.5;

export default function ContentDetailScreen({ route, navigation }) {
  const { contentId } = route.params;

  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [userSubscription, setUserSubscription] = useState(null);

  useEffect(() => {
    loadData();
  }, [contentId]);

  const loadData = async () => {
    try {
      // Load content and subscription in parallel
      const [contentData, subscriptionData] = await Promise.all([
        contentsService.getContentById(contentId),
        subscriptionService.getCurrentSubscription()
      ]);

      setContent(contentData);
      setUserSubscription(subscriptionData);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Impossible de charger ce contenu');
    } finally {
      setLoading(false);
    }
  };

  const isLocked = () => {
    // Content is locked if user doesn't have an active subscription
    // or if content is marked as premium_only
    if (!userSubscription || userSubscription.status !== 'active') {
      return true;
    }

    // Additional check: if content has a premium_only flag
    if (content?.premium_only === true) {
      return !userSubscription;
    }

    return false;
  };

  const formatDuration = (seconds) => {
    if (!seconds) return null;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatYear = (dateString) => {
    if (!dateString) return null;
    return new Date(dateString).getFullYear();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#B5651D" />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !content) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialCommunityIcons name="chevron-left" size={28} color="#171412" />
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error || 'Contenu introuvable'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isAudiobook = content.content_type === 'audiobook';
  const locked = isLocked();

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
        <MaterialCommunityIcons name="chevron-left" size={28} color="#171412" />
      </TouchableOpacity>

      <View style={styles.headerRight}>
        {!locked && userSubscription?.active && (
          <View style={styles.subscribedBadge}>
            <Text style={styles.subscribedBadgeText}>ABONNÉ</Text>
          </View>
        )}
        <TouchableOpacity style={styles.headerButton}>
          <MaterialCommunityIcons
            name={locked ? "bookmark-outline" : "share-variant-outline"}
            size={24}
            color="#171412"
          />
        </TouchableOpacity>
        {!locked && (
          <TouchableOpacity style={styles.headerButton}>
            <MaterialCommunityIcons name="dots-vertical" size={24} color="#171412" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderCover = () => (
    <View style={styles.coverContainer}>
      <View style={styles.coverWrapper}>
        <Image
          source={{ uri: content.cover_url }}
          style={styles.coverImage}
          resizeMode="cover"
        />
        {locked && (
          <View style={styles.coverOverlay}>
            <MaterialCommunityIcons name="lock" size={40} color="rgba(255,255,255,0.5)" />
          </View>
        )}
      </View>
    </View>
  );

  const renderTitle = () => (
    <View style={styles.titleContainer}>
      <Text style={styles.title}>{content.title}</Text>
      <Text style={styles.author}>{content.author}</Text>
    </View>
  );

  const renderRating = () => {
    // Only show rating for e-books and if rating exists
    if (isAudiobook || !content.rating || content.rating === 0) return null;

    return (
      <View style={styles.ratingContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <MaterialCommunityIcons
            key={star}
            name={star <= Math.floor(content.rating) ? "star" : "star-outline"}
            size={16}
            color="#D4A017"
          />
        ))}
        <Text style={styles.ratingText}>{content.rating.toFixed(1)}</Text>
      </View>
    );
  };

  const renderMetadataBadges = () => (
    <View style={styles.metadataBadges}>
      {content.language && (
        <View style={styles.metadataBadge}>
          <MaterialCommunityIcons name="web" size={14} color="#867465" />
          <Text style={styles.metadataBadgeText}>{content.language.toUpperCase()}</Text>
        </View>
      )}
      {content.categories && content.categories[0] && (
        <View style={styles.metadataBadge}>
          <MaterialCommunityIcons name="folder-outline" size={14} color="#867465" />
          <Text style={styles.metadataBadgeText}>
            {content.categories[0].name.toUpperCase()}
          </Text>
        </View>
      )}
      {isAudiobook && content.duration_seconds && (
        <View style={styles.metadataBadge}>
          <MaterialCommunityIcons name="clock-outline" size={14} color="#867465" />
          <Text style={styles.metadataBadgeText}>
            {formatDuration(content.duration_seconds)}
          </Text>
        </View>
      )}
      {!isAudiobook && content.page_count && (
        <View style={styles.metadataBadge}>
          <MaterialCommunityIcons name="file-outline" size={14} color="#867465" />
          <Text style={styles.metadataBadgeText}>{content.page_count} PAGES</Text>
        </View>
      )}
    </View>
  );

  const renderNarrator = () => {
    if (!isAudiobook || !content.narrator) return null;

    return (
      <View style={styles.narratorContainer}>
        <MaterialCommunityIcons name="account-voice" size={16} color="#867465" />
        <Text style={styles.narratorText}>Lu par {content.narrator}</Text>
      </View>
    );
  };

  const handleSubscribe = () => {
    // Navigate to subscription page
    navigation.navigate('Subscription');
  };

  const handlePrimaryAction = async () => {
    if (isAudiobook) {
      // TODO Epic 4: Navigate to audio player
      navigation.navigate('AudioPlayer', { contentId: content.id });
    } else {
      // TODO Epic 4: Navigate to ebook reader
      navigation.navigate('EbookReader', { contentId: content.id });
    }
  };

  const handleDownload = async () => {
    try {
      // TODO Epic 3: Implement offline download
      const { url } = await contentsService.getContentFileUrl(contentId);
      console.log('Download URL:', url);
      // Show success message
      alert('Téléchargement démarré');
    } catch (err) {
      console.error('Download error:', err);
      alert('Erreur lors du téléchargement');
    }
  };

  const handleAddToPlaylist = () => {
    // TODO Epic 3: Implement playlist functionality
    alert('Ajouté à la playlist');
  };

  const renderActions = () => {
    if (locked) {
      return (
        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.primaryButton} onPress={handleSubscribe}>
            <MaterialCommunityIcons name="lock" size={20} color="#fff" />
            <Text style={styles.primaryButtonText}>S'abonner pour lire</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.actionsContainer}>
        <TouchableOpacity style={styles.primaryButton} onPress={handlePrimaryAction}>
          <MaterialCommunityIcons
            name={isAudiobook ? "play" : "book-open-variant"}
            size={20}
            color="#fff"
          />
          <Text style={styles.primaryButtonText}>
            {isAudiobook ? 'Écouter' : 'Lire maintenant'}
          </Text>
        </TouchableOpacity>

        <View style={styles.secondaryActions}>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleDownload}>
            <MaterialCommunityIcons name="download-outline" size={18} color="#B5651D" />
            <Text style={styles.secondaryButtonText}>Télécharger</Text>
          </TouchableOpacity>

          {isAudiobook && (
            <TouchableOpacity style={styles.secondaryButton} onPress={handleAddToPlaylist}>
              <MaterialCommunityIcons name="playlist-music" size={18} color="#B5651D" />
              <Text style={styles.secondaryButtonText}>Playlist</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderLockedBadge = () => {
    if (!locked) return null;

    return (
      <View style={styles.lockedBadgeContainer}>
        <View style={styles.lockedBadge}>
          <MaterialCommunityIcons name="lock" size={14} color="#D4A017" />
          <Text style={styles.lockedBadgeText}>CONTENU VERROUILLÉ</Text>
        </View>
      </View>
    );
  };

  const renderDescription = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        {isAudiobook ? 'Synopsis' : 'À propos de ce livre'}
      </Text>
      <Text
        style={[styles.description, locked && styles.descriptionLocked]}
        numberOfLines={isDescriptionExpanded ? undefined : 4}
      >
        {content.description}
      </Text>
      <TouchableOpacity onPress={() => setIsDescriptionExpanded(!isDescriptionExpanded)}>
        <Text style={styles.readMoreLink}>
          {isDescriptionExpanded ? 'Voir moins' : 'Lire la suite'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderNarratorSection = () => {
    if (!isAudiobook || !content.narrator) return null;

    // Check if narrator bio is available, otherwise use default text
    const narratorBio = content.narrator_bio ||
      "Écouter l'autrice donner vie à son œuvre apporte une dimension unique à cette expérience littéraire.";

    // Check if narrator is the author
    const isNarratorAuthor = content.narrator === content.author ||
      content.narrator?.toLowerCase().includes('auteur') ||
      content.narrator?.toLowerCase().includes('autrice');

    const sectionTitle = isNarratorAuthor ?
      (content.narrator?.toLowerCase().includes('autrice') ? 'Narratrice' : 'Narrateur') :
      'Narration';

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{sectionTitle}</Text>
        <View style={styles.narratorCard}>
          <View style={styles.narratorAvatar}>
            <MaterialCommunityIcons name="account" size={32} color="#867465" />
          </View>
          <View style={styles.narratorInfo}>
            <Text style={styles.narratorName}>{content.narrator}</Text>
            <Text style={styles.narratorBio} numberOfLines={3}>
              {narratorBio}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderChapters = () => {
    if (!isAudiobook) return null;

    // Check if content has chapters (Epic 4 feature)
    const chapters = content.chapters || [];

    // If no chapters available yet, use mock data for design
    const displayChapters = chapters.length > 0 ? chapters : [
      { id: 1, title: "L'appel du Niodior", duration: 2700 },
      { id: 2, title: "Le retour aux abyssales", duration: 3120 },
      { id: 3, title: "Terre d'accueil, terre d'exil", duration: 2880 }
    ];

    const formatChapterDuration = (seconds) => {
      const mins = Math.floor(seconds / 60);
      return `${mins}m`;
    };

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Chapitres</Text>
        {displayChapters.map((chapter, index) => (
          <TouchableOpacity
            key={chapter.id}
            style={styles.chapterItem}
            onPress={() => {
              // TODO Epic 4: Navigate to audio player at specific chapter
              console.log('Play chapter:', chapter.id);
            }}
          >
            <View style={styles.chapterNumber}>
              <Text style={styles.chapterNumberText}>
                {(index + 1).toString().padStart(2, '0')}
              </Text>
            </View>
            <View style={styles.chapterInfo}>
              <Text style={styles.chapterTitle}>{chapter.title}</Text>
              <Text style={styles.chapterDuration}>
                {chapter.duration ? formatChapterDuration(chapter.duration) : '45m'}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#867465" />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderTechnicalInfo = () => {
    if (isAudiobook) return null;

    // Only show technical info section if at least one field is available
    const hasAnyInfo = content.publisher || content.published_at || content.isbn;
    if (!hasAnyInfo) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Informations techniques</Text>
        <View style={styles.technicalInfoContainer}>
          {content.publisher && (
            <>
              <View style={styles.technicalInfoRow}>
                <Text style={styles.technicalInfoLabel}>Éditeur</Text>
                <Text style={styles.technicalInfoValue}>{content.publisher}</Text>
              </View>
              <View style={styles.technicalInfoDivider} />
            </>
          )}
          {content.published_at && (
            <>
              <View style={styles.technicalInfoRow}>
                <Text style={styles.technicalInfoLabel}>Date de parution</Text>
                <Text style={styles.technicalInfoValue}>{formatYear(content.published_at)}</Text>
              </View>
              <View style={styles.technicalInfoDivider} />
            </>
          )}
          {content.isbn && (
            <View style={styles.technicalInfoRow}>
              <Text style={styles.technicalInfoLabel}>ISBN</Text>
              <Text style={styles.technicalInfoValue}>{content.isbn}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderLockedStats = () => {
    if (!locked) return null;

    return (
      <View style={styles.lockedStatsContainer}>
        {content.page_count && (
          <>
            <View style={styles.lockedStat}>
              <Text style={styles.lockedStatLabel}>Pages</Text>
              <Text style={styles.lockedStatValue}>{content.page_count}</Text>
            </View>
            <View style={styles.lockedStatDivider} />
          </>
        )}
        {content.duration_seconds && (
          <>
            <View style={styles.lockedStat}>
              <Text style={styles.lockedStatLabel}>Durée</Text>
              <Text style={styles.lockedStatValue}>
                {formatDuration(content.duration_seconds)}
              </Text>
            </View>
            <View style={styles.lockedStatDivider} />
          </>
        )}
        <View style={styles.lockedStat}>
          <Text style={styles.lockedStatLabel}>Langue</Text>
          <Text style={styles.lockedStatValue}>
            {content.language ? content.language.charAt(0).toUpperCase() + content.language.slice(1) : 'Français'}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {renderHeader()}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderCover()}
        {renderTitle()}
        {!locked && renderRating()}
        {renderMetadataBadges()}
        {isAudiobook && renderNarrator()}
        {renderActions()}
        {renderLockedBadge()}
        {renderDescription()}
        {!locked && renderNarratorSection()}
        {!locked && renderChapters()}
        {!locked && renderTechnicalInfo()}
        {locked && renderLockedStats()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBF7F2'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  errorText: {
    fontSize: 16,
    color: '#867465',
    textAlign: 'center'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#FBF7F2'
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center'
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  subscribedBadge: {
    backgroundColor: '#FFF3E6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 8
  },
  subscribedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D4A017',
    letterSpacing: 1
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    paddingBottom: 40
  },
  coverContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 40
  },
  coverWrapper: {
    width: COVER_WIDTH,
    aspectRatio: 2 / 3,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#e5e0dc',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12
  },
  coverImage: {
    width: '100%',
    height: '100%'
  },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  titleContainer: {
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 12
  },
  title: {
    fontFamily: 'Playfair Display',
    fontSize: 24,
    fontWeight: '700',
    color: '#171412',
    textAlign: 'center',
    marginBottom: 8
  },
  author: {
    fontSize: 16,
    fontWeight: '500',
    color: '#B5651D',
    textAlign: 'center'
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 12
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#171412',
    marginLeft: 4
  },
  metadataBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
    marginBottom: 16
  },
  metadataBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e0dc'
  },
  metadataBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#867465',
    letterSpacing: 0.5
  },
  narratorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 20
  },
  narratorText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#867465',
    fontStyle: 'italic'
  },
  actionsContainer: {
    paddingHorizontal: 24,
    marginBottom: 24
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#B5651D',
    paddingVertical: 16,
    borderRadius: 28,
    shadowColor: '#B5651D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e0dc'
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#B5651D'
  },
  lockedBadgeContainer: {
    alignItems: 'center',
    marginBottom: 24
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF3E6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16
  },
  lockedBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D4A017',
    letterSpacing: 1
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 32
  },
  sectionTitle: {
    fontFamily: 'Playfair Display',
    fontSize: 20,
    fontWeight: '700',
    color: '#171412',
    marginBottom: 16
  },
  description: {
    fontSize: 15,
    lineHeight: 24,
    color: '#3d3530',
    textAlign: 'justify'
  },
  descriptionLocked: {
    color: '#c4bdb7',
    opacity: 0.6
  },
  readMoreLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#B5651D',
    marginTop: 12
  },
  narratorCard: {
    flexDirection: 'row',
    gap: 16,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e0dc'
  },
  narratorAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f5f2ef',
    justifyContent: 'center',
    alignItems: 'center'
  },
  narratorInfo: {
    flex: 1,
    justifyContent: 'center'
  },
  narratorName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#171412',
    marginBottom: 4
  },
  narratorBio: {
    fontSize: 13,
    lineHeight: 18,
    color: '#867465'
  },
  chapterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0ebe6'
  },
  chapterNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f2ef',
    justifyContent: 'center',
    alignItems: 'center'
  },
  chapterNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#B5651D'
  },
  chapterInfo: {
    flex: 1
  },
  chapterTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#171412',
    marginBottom: 2
  },
  chapterDuration: {
    fontSize: 13,
    color: '#867465'
  },
  technicalInfoContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e0dc',
    overflow: 'hidden'
  },
  technicalInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16
  },
  technicalInfoDivider: {
    height: 1,
    backgroundColor: '#f0ebe6',
    marginHorizontal: 16
  },
  technicalInfoLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#867465'
  },
  technicalInfoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#171412'
  },
  lockedStatsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 24,
    paddingVertical: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e0dc',
    marginBottom: 32
  },
  lockedStat: {
    flex: 1,
    alignItems: 'center'
  },
  lockedStatLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#867465',
    marginBottom: 8
  },
  lockedStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#171412'
  },
  lockedStatDivider: {
    width: 1,
    backgroundColor: '#e5e0dc'
  }
});
