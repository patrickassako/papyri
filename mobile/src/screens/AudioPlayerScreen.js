import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import Slider from '@react-native-community/slider';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAudioPlayer } from '../hooks/useAudioPlayer';

const tokens = require('../config/tokens');
const { width } = Dimensions.get('window');
const COVER_SIZE = Math.min(width - 80, 360);
const SPEEDS = [0.5, 1, 1.25, 1.5, 2];

function formatDuration(seconds) {
  if (!Number.isFinite(Number(seconds)) || Number(seconds) <= 0) return '0:00';
  const total = Math.floor(Number(seconds));
  const hours = Math.floor(total / 3600);
  const min = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  if (hours > 0) {
    return `${hours}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  return `${min}:${String(sec).padStart(2, '0')}`;
}

export default function AudioPlayerScreen({ route, navigation }) {
  const contentId = route?.params?.contentId;
  const [chaptersVisible, setChaptersVisible] = useState(false);

  const {
    content,
    contentId: loadedId,
    loading,
    error,
    canRead,
    accessHint,
    chapters,
    isPlaying,
    isBuffering,
    progress,
    duration,
    currentTime,
    playbackRate,
    currentChapterIndex,
    loadContent,
    togglePlayPause,
    seekToPercent,
    shiftTime,
    goToChapter,
    goPrevChapter,
    goNextChapter,
    setPlaybackRate,
  } = useAudioPlayer();

  useEffect(() => {
    if (contentId && loadedId !== contentId) {
      loadContent(contentId);
    }
  }, [contentId, loadedId, loadContent]);

  const chapterItems = useMemo(() => {
    if (Array.isArray(chapters) && chapters.length > 0) {
      return chapters.map((item, idx) => ({
        key: item.id || `${idx}`,
        index: idx,
        title: item.title || `Chapitre ${idx + 1}`,
        active: idx === currentChapterIndex,
      }));
    }
    return [{ key: 'intro', index: 0, title: 'Introduction', active: true }];
  }, [chapters, currentChapterIndex]);

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={tokens.colors.primary} />
        <Text style={styles.loadingText}>Chargement...</Text>
      </SafeAreaView>
    );
  }

  if (error || !content) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#867465" />
        <Text style={styles.errorText}>{error || 'Contenu introuvable.'}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!canRead) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <MaterialCommunityIcons name="lock-outline" size={48} color="#867465" />
        <Text style={styles.errorText}>{accessHint || 'Accès non autorisé.'}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <MaterialCommunityIcons name="chevron-down" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Lecture audio</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Cover */}
        <View style={styles.coverContainer}>
          <Image
            source={{ uri: content.cover_url || 'https://placehold.co/400x400/222/ddd?text=Cover' }}
            style={styles.cover}
          />
        </View>

        {/* Title & Author */}
        <View style={styles.infoContainer}>
          <Text style={styles.title} numberOfLines={2}>{content.title}</Text>
          <Text style={styles.author}>
            {content.author}
            {content.narrator ? ` · Narré par ${content.narrator}` : ''}
          </Text>
          <Text style={styles.chapterName}>
            {chapterItems.find((c) => c.active)?.title || `Chapitre ${currentChapterIndex + 1}`}
          </Text>
        </View>

        {/* Progress Slider */}
        <View style={styles.progressContainer}>
          <Slider
            value={progress}
            minimumValue={0}
            maximumValue={100}
            onSlidingComplete={(val) => seekToPercent(val)}
            minimumTrackTintColor={tokens.colors.primary}
            maximumTrackTintColor="rgba(255,255,255,0.2)"
            thumbTintColor={tokens.colors.primary}
            style={styles.slider}
          />
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{formatDuration(currentTime)}</Text>
            <Text style={styles.timeText}>{formatDuration(duration || content.duration_seconds || 0)}</Text>
          </View>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity onPress={goPrevChapter} style={styles.controlButton}>
            <MaterialCommunityIcons name="skip-previous" size={32} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => shiftTime(-15)} style={styles.controlButton}>
            <MaterialCommunityIcons name="rewind-15" size={32} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
          <TouchableOpacity onPress={togglePlayPause} style={styles.playButton}>
            {isBuffering ? (
              <ActivityIndicator size="small" color="#111827" />
            ) : (
              <MaterialCommunityIcons
                name={isPlaying ? 'pause' : 'play'}
                size={36}
                color="#111827"
              />
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => shiftTime(30)} style={styles.controlButton}>
            <MaterialCommunityIcons name="fast-forward-30" size={32} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
          <TouchableOpacity onPress={goNextChapter} style={styles.controlButton}>
            <MaterialCommunityIcons name="skip-next" size={32} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>

        {/* Speed Chips */}
        <View style={styles.secondaryActions}>
          <TouchableOpacity
            style={styles.chaptersButton}
            onPress={() => setChaptersVisible(true)}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="format-list-bulleted" size={18} color="#fff" />
            <Text style={styles.chaptersButtonText}>Chapitres ({chapterItems.length})</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.speedContainer}>
          {SPEEDS.map((speed) => (
            <TouchableOpacity
              key={speed}
              onPress={() => setPlaybackRate(speed)}
              style={[
                styles.speedChip,
                playbackRate === speed && styles.speedChipActive,
              ]}
            >
              <Text style={[
                styles.speedChipText,
                playbackRate === speed && styles.speedChipTextActive,
              ]}>
                {speed}x
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Chapters */}
        {chapterItems.length > 1 && (
          <View style={styles.chaptersSection}>
            <Text style={styles.chaptersTitle}>Chapitres</Text>
            {chapterItems.map((ch) => (
              <TouchableOpacity
                key={ch.key}
                style={[styles.chapterItem, ch.active && styles.chapterItemActive]}
                onPress={() => goToChapter(ch.index)}
              >
                <Text style={[styles.chapterItemText, ch.active && styles.chapterItemTextActive]}>
                  {String(ch.index + 1).padStart(2, '0')} · {ch.title}
                </Text>
                {ch.active && (
                  <MaterialCommunityIcons name="volume-high" size={16} color={tokens.colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={chaptersVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setChaptersVisible(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setChaptersVisible(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chapitres</Text>
              <TouchableOpacity onPress={() => setChaptersVisible(false)}>
                <MaterialCommunityIcons name="close" size={22} color="rgba(255,255,255,0.8)" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {chapterItems.map((ch) => (
                <TouchableOpacity
                  key={`modal-${ch.key}`}
                  style={[styles.chapterItem, ch.active && styles.chapterItemActive]}
                  onPress={() => {
                    goToChapter(ch.index);
                    setChaptersVisible(false);
                  }}
                >
                  <Text style={[styles.chapterItemText, ch.active && styles.chapterItemTextActive]}>
                    {String(ch.index + 1).padStart(2, '0')} · {ch.title}
                  </Text>
                  {ch.active && (
                    <MaterialCommunityIcons name="volume-high" size={16} color={tokens.colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
  },
  backButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '600',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },

  // Cover
  coverContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  cover: {
    width: COVER_SIZE,
    height: COVER_SIZE,
    borderRadius: 12,
    backgroundColor: '#1f2937',
  },

  // Info
  infoContainer: {
    alignItems: 'center',
    marginTop: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    fontFamily: 'Playfair Display',
  },
  author: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 8,
  },
  chapterName: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 4,
  },

  // Progress
  progressContainer: {
    marginTop: 24,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -4,
  },
  timeText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },

  // Controls
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    gap: 16,
  },
  controlButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: tokens.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Speed
  secondaryActions: {
    alignItems: 'center',
    marginTop: 14,
  },
  chaptersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  chaptersButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  speedContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
    gap: 8,
  },
  speedChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  speedChipActive: {
    backgroundColor: tokens.colors.primary,
  },
  speedChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
  },
  speedChipTextActive: {
    color: '#111827',
  },

  // Chapters
  chaptersSection: {
    marginTop: 32,
  },
  chaptersTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 12,
  },
  chapterItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  chapterItemActive: {
    backgroundColor: 'rgba(181, 101, 29, 0.15)',
    borderWidth: 1,
    borderColor: tokens.colors.primary,
  },
  chapterItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    flex: 1,
  },
  chapterItemTextActive: {
    color: '#fff',
    fontWeight: '800',
  },

  // Modal chapters
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalSheet: {
    maxHeight: '70%',
    backgroundColor: '#111827',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 18,
    paddingBottom: 24,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  modalHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginBottom: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
});
