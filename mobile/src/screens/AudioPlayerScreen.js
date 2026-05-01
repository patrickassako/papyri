import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { useReadingLock } from '../hooks/useReadingLock';

const tokens = require('../config/tokens');
const { width, height } = Dimensions.get('window');
const COVER_SIZE = Math.min(width - 80, height * 0.28, 260);
const SPEEDS = [0.5, 1, 1.25, 1.5, 2];
const SLEEP_OPTIONS = [
  { label: '5 min', minutes: 5 },
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '45 min', minutes: 45 },
  { label: '1h', minutes: 60 },
  { label: 'Fin du chapitre', minutes: null },
];

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
  const [sleepVisible, setSleepVisible] = useState(false);
  const [playlistVisible, setPlaylistVisible] = useState(false);
  const [sleepRemaining, setSleepRemaining] = useState(null); // secondes restantes, null = off
  const sleepIntervalRef = useRef(null);

  const startSleepTimer = (minutes) => {
    setSleepVisible(false);
    if (sleepIntervalRef.current) clearInterval(sleepIntervalRef.current);
    if (minutes === null) {
      // Fin du chapitre — on marque avec -1 comme signal
      setSleepRemaining(-1);
      return;
    }
    let remaining = minutes * 60;
    setSleepRemaining(remaining);
    sleepIntervalRef.current = setInterval(() => {
      remaining -= 1;
      setSleepRemaining(remaining);
      if (remaining <= 0) {
        clearInterval(sleepIntervalRef.current);
        sleepIntervalRef.current = null;
        setSleepRemaining(null);
        pause();
      }
    }, 1000);
  };

  const cancelSleepTimer = () => {
    if (sleepIntervalRef.current) clearInterval(sleepIntervalRef.current);
    sleepIntervalRef.current = null;
    setSleepRemaining(null);
  };

  // Fin du chapitre — déclenche pause quand le chapitre change
  const prevChapterRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sleepIntervalRef.current) clearInterval(sleepIntervalRef.current);
    };
  }, []);

  const {
    content,
    contentId: loadedId,
    loading,
    error,
    canRead,
    accessHint,
    chapters,
    playlist,
    playlistLoading,
    playlistActionLoading,
    isInPlaylist,
    isPlaying,
    isBuffering,
    progress,
    duration,
    currentTime,
    playbackRate,
    currentChapterIndex,
    loadContent,
    pause,
    togglePlayPause,
    seekToPercent,
    shiftTime,
    goToChapter,
    goPrevChapter,
    goNextChapter,
    setPlaybackRate,
    handleAddOrRemovePlaylist,
    movePlaylistItem,
  } = useAudioPlayer();

  // Lock uniquement quand la lecture est active (style Spotify)
  const { lockState, reacquire } = useReadingLock(contentId, isPlaying);

  useEffect(() => {
    if (contentId && loadedId !== contentId) {
      loadContent(contentId);
    }
  }, [contentId, loadedId, loadContent]);

  // Fin du chapitre : pause quand le chapitre change et sleepRemaining === -1
  useEffect(() => {
    if (sleepRemaining !== -1) {
      prevChapterRef.current = currentChapterIndex;
      return;
    }
    if (prevChapterRef.current !== null && prevChapterRef.current !== currentChapterIndex) {
      setSleepRemaining(null);
      pause();
    }
    prevChapterRef.current = currentChapterIndex;
  }, [currentChapterIndex, sleepRemaining, pause]);

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

  {/* Pas de rendu bloqué pour 'displaced' — on affiche une bannière sur le player */}

  if (lockState === 'device_limit') {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <MaterialCommunityIcons name="lock-outline" size={48} color="#867465" />
        <Text style={[styles.errorText, { textAlign: 'center' }]}>
          Limite de 3 appareils atteinte.{'\n'}Supprimez un appareil depuis votre profil.
        </Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Bannière déplacement — un autre device a repris la lecture */}
      {lockState === 'displaced' && (
        <View style={styles.displacedBanner}>
          <MaterialCommunityIcons name="cellphone-arrow-down" size={18} color="#fff" />
          <Text style={styles.displacedText}>Lecture reprise sur un autre appareil</Text>
          <TouchableOpacity onPress={reacquire} style={styles.displacedBtn}>
            <Text style={styles.displacedBtnText}>Reprendre ici</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <MaterialCommunityIcons name="chevron-down" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Lecture audio</Text>
        <View style={styles.headerButton} />
      </View>

      <View style={styles.scrollContent}>
        {/* Cover + bouton chapitres flottant */}
        <View style={styles.coverContainer}>
          <View style={{ position: 'relative' }}>
            {(content.cover_url || content.thumbnail || content.coverUrl) ? (
              <Image
                source={{ uri: content.cover_url || content.thumbnail || content.coverUrl }}
                style={styles.cover}
              />
            ) : (
              <View style={[styles.cover, styles.coverPlaceholder]}>
                <MaterialCommunityIcons name="headphones" size={80} color="rgba(255,255,255,0.15)" />
              </View>
            )}
            {/* Chapitres — icône flottante en haut à gauche */}
            <TouchableOpacity
              style={styles.chaptersFab}
              onPress={() => setChaptersVisible(true)}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="format-list-bulleted" size={16} color="#fff" />
              <Text style={styles.chaptersFabText}>{chapterItems.length}</Text>
            </TouchableOpacity>
          </View>
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

        {/* Secondary actions */}
        <View style={styles.secondaryActions}>
          <TouchableOpacity
            style={[styles.secondaryBtn, sleepRemaining !== null && styles.secondaryBtnActive]}
            onPress={() => sleepRemaining !== null ? cancelSleepTimer() : setSleepVisible(true)}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons
              name="sleep"
              size={18}
              color={sleepRemaining !== null ? '#111827' : '#fff'}
            />
            <Text style={[styles.secondaryBtnText, sleepRemaining !== null && styles.secondaryBtnTextActive]}>
              {sleepRemaining === null
                ? 'Minuteur de sommeil'
                : sleepRemaining === -1
                  ? 'Fin chapitre ✕'
                  : `${Math.floor(sleepRemaining / 60)}:${String(sleepRemaining % 60).padStart(2, '0')} ✕`}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryBtn, isInPlaylist && styles.secondaryBtnActive]}
            onPress={() => setPlaylistVisible(true)}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="playlist-music" size={18} color={isInPlaylist ? '#111827' : '#fff'} />
            <Text style={[styles.secondaryBtnText, isInPlaylist && styles.secondaryBtnTextActive]}>
              Playlist {playlist.length > 0 ? `(${playlist.length})` : ''}
            </Text>
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

      </View>

      {/* Sleep Timer Modal */}
      <Modal
        visible={sleepVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSleepVisible(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setSleepVisible(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>⏱ Minuteur de sommeil</Text>
              <TouchableOpacity onPress={() => setSleepVisible(false)}>
                <MaterialCommunityIcons name="close" size={22} color="rgba(255,255,255,0.8)" />
              </TouchableOpacity>
            </View>
            <Text style={styles.sleepSubtitle}>La lecture s'arrête automatiquement après :</Text>
            {SLEEP_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.label}
                style={styles.sleepOption}
                onPress={() => startSleepTimer(opt.minutes)}
              >
                <MaterialCommunityIcons name="timer-outline" size={18} color={tokens.colors.primary} />
                <Text style={styles.sleepOptionText}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

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
      {/* Playlist Modal */}
      <Modal
        visible={playlistVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPlaylistVisible(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setPlaylistVisible(false)} />
          <View style={[styles.modalSheet, { maxHeight: '75%' }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🎵 Playlist</Text>
              <TouchableOpacity onPress={() => setPlaylistVisible(false)}>
                <MaterialCommunityIcons name="close" size={22} color="rgba(255,255,255,0.8)" />
              </TouchableOpacity>
            </View>

            {/* Ajouter/Retirer bouton */}
            <TouchableOpacity
              style={[styles.playlistActionBtn, isInPlaylist && styles.playlistActionBtnActive]}
              onPress={handleAddOrRemovePlaylist}
              disabled={playlistActionLoading}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons
                name={isInPlaylist ? 'playlist-remove' : 'playlist-plus'}
                size={18}
                color={isInPlaylist ? '#111827' : tokens.colors.primary}
              />
              <Text style={[styles.playlistActionBtnText, isInPlaylist && styles.playlistActionBtnTextActive]}>
                {playlistActionLoading ? '...' : isInPlaylist ? 'Retirer de la playlist' : 'Ajouter à la playlist'}
              </Text>
            </TouchableOpacity>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 8 }}>
              {playlist.length === 0 ? (
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, textAlign: 'center', marginTop: 16 }}>
                  Votre playlist est vide.
                </Text>
              ) : (
                playlist.map((item, idx) => {
                  const isActive = item.content_id === contentId;
                  return (
                    <View
                      key={item.id || item.content_id}
                      style={[styles.chapterItem, isActive && styles.chapterItemActive, { marginBottom: 6 }]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.chapterItemText, isActive && styles.chapterItemTextActive]} numberOfLines={1}>
                          {String(idx + 1).padStart(2, '0')} · {item?.content?.title || 'Titre audio'}
                        </Text>
                        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }} numberOfLines={1}>
                          {item?.content?.author || ''}
                          {item?.progress?.progress_percent ? ` · ${Math.round(item.progress.progress_percent)}%` : ''}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 4 }}>
                        <TouchableOpacity onPress={() => movePlaylistItem(idx, idx - 1)} style={styles.playlistReorderBtn}>
                          <MaterialCommunityIcons name="chevron-up" size={18} color="rgba(255,255,255,0.5)" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => movePlaylistItem(idx, idx + 1)} style={styles.playlistReorderBtn}>
                          <MaterialCommunityIcons name="chevron-down" size={18} color="rgba(255,255,255,0.5)" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
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
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 16,
    justifyContent: 'space-between',
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
  coverPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1f2937',
  },
  chaptersFab: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  chaptersFabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
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
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 14,
    flexWrap: 'wrap',
  },
  secondaryBtn: {
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
  secondaryBtnActive: {
    backgroundColor: tokens.colors.primary,
    borderColor: tokens.colors.primary,
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  secondaryBtnTextActive: {
    color: '#111827',
  },
  sleepSubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    marginBottom: 14,
  },
  sleepOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  sleepOptionText: {
    fontSize: 16,
    fontWeight: '600',
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

  // Playlist action button
  playlistActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: tokens.colors.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 4,
  },
  playlistActionBtnActive: {
    backgroundColor: tokens.colors.primary,
    borderColor: tokens.colors.primary,
  },
  playlistActionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.primary,
  },
  playlistActionBtnTextActive: {
    color: '#111827',
  },
  playlistReorderBtn: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
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

  displacedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2E4057',
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexWrap: 'wrap',
    gap: 8,
  },
  displacedText: {
    flex: 1,
    color: '#fff',
    fontSize: 13,
    marginLeft: 6,
  },
  displacedBtn: {
    backgroundColor: '#B5651D',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  displacedBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
