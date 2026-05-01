import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Card, Text, Chip } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../theme/colors';
import BookCover from './BookCover';

/**
 * Carte de contenu pour le catalogue mobile
 */
export default function ContentCard({ content }) {
  const navigation = useNavigation();

  const handlePress = () => {
    navigation.navigate('ContentDetail', { contentId: content.id });
  };

  const formatDuration = (seconds) => {
    if (!seconds) return null;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h${minutes.toString().padStart(2, '0')}`;
  };

  const isAudiobook = content.content_type === 'audiobook';

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.7}>
      <Card style={styles.card} elevation={2}>
        <View style={styles.coverContainer}>
          <BookCover uri={content.cover_url} title={content.title} style={styles.cover} />
          <Chip
            style={[
              styles.typeChip,
              { backgroundColor: isAudiobook ? '#2196f3' : COLORS.primary }
            ]}
            textStyle={styles.chipText}
          >
            {isAudiobook ? 'Audio' : 'Livre'}
          </Chip>
        </View>

        <Card.Content style={styles.content}>
          <View style={styles.header}>
            {content.language && (
              <Chip
                compact
                style={styles.languageChip}
                textStyle={styles.languageText}
              >
                {content.language.toUpperCase()}
              </Chip>
            )}
          </View>

          <Text
            variant="titleMedium"
            style={styles.title}
            numberOfLines={2}
          >
            {content.title}
          </Text>

          <Text
            variant="bodyMedium"
            style={styles.author}
            numberOfLines={1}
          >
            {content.author}
          </Text>

          <Text
            variant="bodySmall"
            style={styles.description}
            numberOfLines={3}
          >
            {content.description}
          </Text>

          {isAudiobook && content.duration_seconds && (
            <Text variant="bodySmall" style={styles.duration}>
              Durée : {formatDuration(content.duration_seconds)}
            </Text>
          )}
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden'
  },
  coverContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 2 / 3,
    backgroundColor: '#e0e0e0'
  },
  cover: {
    width: '100%',
    height: '100%'
  },
  typeChip: {
    position: 'absolute',
    top: 12,
    left: 12,
    height: 24
  },
  chipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  content: {
    paddingVertical: 12,
    paddingHorizontal: 12
  },
  header: {
    flexDirection: 'row',
    marginBottom: 8
  },
  languageChip: {
    height: 24,
    backgroundColor: '#f5f5f5'
  },
  languageText: {
    fontSize: 10,
    fontWeight: '600'
  },
  title: {
    fontFamily: 'Playfair Display',
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
    lineHeight: 22
  },
  author: {
    color: COLORS.textSecondary,
    marginBottom: 8,
    fontWeight: '500'
  },
  description: {
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: 8
  },
  duration: {
    color: COLORS.textSecondary,
    marginTop: 4
  }
});
