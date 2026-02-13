import React from 'react';
import { View, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, ProgressBar, Chip, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Import shared design tokens
const tokens = require('../config/tokens');

/**
 * ContentCardWithProgress Component
 * Displays a content card with progress bar (Mobile)
 *
 * @param {Object} props
 * @param {string} props.content_id - Content ID
 * @param {string} props.title - Content title
 * @param {string} props.author - Content author
 * @param {string} props.content_type - Content type (ebook, audiobook)
 * @param {string} props.cover_url - Cover image URL
 * @param {number} props.progress_percent - Progress percentage (0-100)
 * @param {string} props.last_read_at - Last read timestamp
 * @param {boolean} props.is_completed - Completion status
 * @param {Object} props.last_position - Last reading position
 * @param {string} props.variant - Layout variant (horizontal, vertical, list)
 * @param {function} props.onContinue - Continue reading handler
 * @param {function} props.onPress - Card press handler
 */
const ContentCardWithProgress = ({
  content_id,
  title,
  author,
  content_type,
  cover_url,
  progress_percent = 0,
  last_read_at,
  is_completed = false,
  last_position,
  variant = 'list',
  onContinue,
  onPress,
}) => {
  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  // Get content type info
  const getTypeInfo = () => {
    if (content_type === 'audiobook') {
      return {
        icon: 'headphones',
        label: 'Audio',
        color: tokens.colors.secondary,
      };
    }
    return {
      icon: 'book-open-variant',
      label: 'Ebook',
      color: tokens.colors.primary,
    };
  };

  const typeInfo = getTypeInfo();

  // Variant: Horizontal (200 width, for carousels)
  if (variant === 'horizontal') {
    return (
      <TouchableOpacity
        style={styles.horizontalCard}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <Image
          source={{ uri: cover_url || 'https://via.placeholder.com/200x300?text=No+Cover' }}
          style={styles.horizontalCover}
          resizeMode="cover"
        />
        <View style={styles.horizontalContent}>
          <Text variant="titleSmall" numberOfLines={2} style={styles.horizontalTitle}>
            {title}
          </Text>
          <Text variant="bodySmall" numberOfLines={1} style={styles.author}>
            {author}
          </Text>

          <View style={styles.progressContainer}>
            <ProgressBar
              progress={progress_percent / 100}
              color={tokens.colors.primary}
              style={styles.progressBar}
            />
            <Text variant="labelSmall" style={styles.progressText}>
              {Math.round(progress_percent)}%
            </Text>
          </View>

          {onContinue && (
            <Button
              mode="contained"
              compact
              onPress={() => onContinue(content_id, last_position)}
              style={styles.continueButton}
              buttonColor={tokens.colors.primary}
            >
              Reprendre
            </Button>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  // Variant: Vertical (120 width, for grids)
  if (variant === 'vertical') {
    return (
      <TouchableOpacity
        style={styles.verticalCard}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <Image
          source={{ uri: cover_url || 'https://via.placeholder.com/120x180?text=No+Cover' }}
          style={styles.verticalCover}
          resizeMode="cover"
        />
        <View style={styles.verticalContent}>
          <Text variant="bodySmall" numberOfLines={2} style={styles.verticalTitle}>
            {title}
          </Text>
          <View style={styles.verticalProgress}>
            <ProgressBar
              progress={progress_percent / 100}
              color={tokens.colors.primary}
              style={styles.verticalProgressBar}
            />
            <Text variant="labelSmall" style={styles.verticalProgressText}>
              {Math.round(progress_percent)}%
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  // Variant: List (full width, for history page)
  return (
    <TouchableOpacity
      style={styles.listCard}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Image
        source={{ uri: cover_url || 'https://via.placeholder.com/120x180?text=No+Cover' }}
        style={styles.listCover}
        resizeMode="cover"
      />
      <View style={styles.listContent}>
        <View style={styles.listHeader}>
          <View style={styles.listTitleContainer}>
            <Text variant="titleMedium" numberOfLines={2} style={styles.listTitle}>
              {title}
            </Text>
            <Text variant="bodySmall" numberOfLines={1} style={styles.author}>
              {author}
            </Text>
          </View>
          <Chip
            icon={() => (
              <MaterialCommunityIcons
                name={typeInfo.icon}
                size={14}
                color={typeInfo.color}
              />
            )}
            style={[styles.typeChip, { backgroundColor: `${typeInfo.color}20` }]}
            textStyle={{ color: typeInfo.color, fontSize: 12 }}
          >
            {typeInfo.label}
          </Chip>
        </View>

        <View style={styles.listProgressContainer}>
          <View style={styles.progressHeader}>
            <Text variant="labelSmall" style={styles.progressLabel}>
              Progression
            </Text>
            <Text variant="labelSmall" style={[styles.progressValue, { color: tokens.colors.primary }]}>
              {Math.round(progress_percent)}%
            </Text>
          </View>
          <ProgressBar
            progress={progress_percent / 100}
            color={tokens.colors.primary}
            style={styles.listProgressBar}
          />
        </View>

        <View style={styles.listFooter}>
          <Text variant="labelSmall" style={styles.lastReadText}>
            Dernière lecture : {formatDate(last_read_at)}
          </Text>
          {is_completed && (
            <Chip
              style={[styles.completedChip, { backgroundColor: tokens.colors.semantic.success }]}
              textStyle={{ color: 'white', fontSize: 10 }}
            >
              Terminé
            </Chip>
          )}
        </View>

        {onContinue && !is_completed && (
          <Button
            mode="contained"
            onPress={() => onContinue(content_id, last_position)}
            style={styles.listContinueButton}
            buttonColor={tokens.colors.primary}
          >
            Reprendre la lecture
          </Button>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  // Horizontal variant
  horizontalCard: {
    width: 200,
    backgroundColor: 'white',
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginRight: 16,
  },
  horizontalCover: {
    width: '100%',
    height: 300,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  horizontalContent: {
    padding: 12,
  },
  horizontalTitle: {
    fontWeight: '600',
    marginBottom: 4,
  },
  author: {
    color: tokens.colors.onSurface.light,
    marginBottom: 8,
  },
  progressContainer: {
    marginBottom: 8,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: tokens.colors.neutral[200],
  },
  progressText: {
    marginTop: 4,
    color: tokens.colors.onSurface.light,
  },
  continueButton: {
    marginTop: 4,
  },

  // Vertical variant
  verticalCard: {
    width: 120,
    backgroundColor: 'white',
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginRight: 12,
    marginBottom: 12,
  },
  verticalCover: {
    width: '100%',
    height: 180,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  verticalContent: {
    padding: 8,
  },
  verticalTitle: {
    fontWeight: '600',
    marginBottom: 4,
  },
  verticalProgress: {
    marginTop: 4,
  },
  verticalProgressBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: tokens.colors.neutral[200],
  },
  verticalProgressText: {
    marginTop: 2,
    fontSize: 10,
    color: tokens.colors.onSurface.light,
  },

  // List variant
  listCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 16,
    overflow: 'hidden',
  },
  listCover: {
    width: 120,
    minHeight: 180,
  },
  listContent: {
    flex: 1,
    padding: 12,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  listTitleContainer: {
    flex: 1,
    marginRight: 8,
  },
  listTitle: {
    fontWeight: '600',
    marginBottom: 4,
  },
  typeChip: {
    height: 24,
    alignSelf: 'flex-start',
  },
  listProgressContainer: {
    marginBottom: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  progressLabel: {
    color: tokens.colors.onSurface.light,
  },
  progressValue: {
    fontWeight: '600',
  },
  listProgressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: tokens.colors.neutral[200],
  },
  listFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  lastReadText: {
    color: tokens.colors.onSurface.light,
  },
  completedChip: {
    height: 20,
  },
  listContinueButton: {
    marginTop: 4,
  },
});

export default ContentCardWithProgress;
