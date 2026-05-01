import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAudioPlayer } from '../hooks/useAudioPlayer';

const tokens = require('../config/tokens');

export default function GlobalMiniPlayer({ navigationRef }) {
  const { content, contentId, isPlaying, progress, togglePlayPause, dismiss } = useAudioPlayer();

  if (!content || !contentId) return null;

  const coverUri = content.cover_url || content.thumbnail || content.coverUrl || null;

  return (
    <TouchableOpacity
      style={styles.container}
      activeOpacity={0.9}
      onPress={() => navigationRef?.navigate('AudioPlayer', { contentId })}
    >
      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${Math.min(100, progress || 0)}%` }]} />
      </View>

      <View style={styles.content}>
        {/* Cover */}
        {coverUri ? (
          <Image source={{ uri: coverUri }} style={styles.cover} />
        ) : (
          <View style={[styles.cover, styles.coverPlaceholder]}>
            <MaterialCommunityIcons name="music" size={20} color="rgba(255,255,255,0.4)" />
          </View>
        )}

        {/* Info */}
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>{content.title}</Text>
          <Text style={styles.author} numberOfLines={1}>{content.author || content.authors || ''}</Text>
        </View>

        {/* Play/Pause */}
        <TouchableOpacity
          style={styles.playButton}
          onPress={(e) => { e.stopPropagation?.(); togglePlayPause(); }}
        >
          <MaterialCommunityIcons
            name={isPlaying ? 'pause' : 'play'}
            size={22}
            color="#fff"
          />
        </TouchableOpacity>

        {/* Close */}
        <TouchableOpacity
          style={styles.closeButton}
          onPress={(e) => { e.stopPropagation?.(); dismiss(); }}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <MaterialCommunityIcons name="close" size={16} color="rgba(255,255,255,0.5)" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 80,
    left: 12,
    right: 12,
    height: 64,
    backgroundColor: 'rgba(29, 24, 18, 0.95)',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  progressBar: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  progressFill: {
    height: '100%',
    backgroundColor: tokens.colors.primary,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 10,
  },
  cover: {
    width: 40,
    height: 40,
    borderRadius: 6,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  author: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tokens.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  coverPlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
