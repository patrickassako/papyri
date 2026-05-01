import React, { useState } from 'react';
import { View, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, ProgressBar, Chip, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Import shared design tokens
const tokens = require('../config/tokens');
import { COVER_PLACEHOLDER_PORTRAIT, COVER_PLACEHOLDER_SMALL } from '../config/constants';

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
// Fallback cover : colored block with book icon + first letter of title
function CoverFallback({ title, size = 'small' }) {
  const PALETTE = ['#B5651D', '#2E4057', '#4CAF50', '#9C27B0', '#2196F3', '#FF9800'];
  const color = PALETTE[(title?.charCodeAt(0) || 0) % PALETTE.length];
  const letter = title?.[0]?.toUpperCase() || '?';
  const isSmall = size === 'small';
  return (
    <View style={[styles.coverFallback, { backgroundColor: color, width: isSmall ? 80 : 200, minHeight: isSmall ? 120 : 300 }]}>
      <MaterialCommunityIcons name="book-open-variant" size={isSmall ? 24 : 48} color="rgba(255,255,255,0.4)" />
      <Text style={[styles.coverFallbackLetter, { fontSize: isSmall ? 20 : 36 }]}>{letter}</Text>
    </View>
  );
}

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
  const [imgError, setImgError] = useState(false);

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
        {cover_url && !imgError ? (
          <Image
            source={{ uri: cover_url }}
            style={styles.horizontalCover}
            resizeMode="cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <CoverFallback title={title} size="large" />
        )}
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
        {cover_url && !imgError ? (
          <Image
            source={{ uri: cover_url }}
            style={styles.verticalCover}
            resizeMode="cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <CoverFallback title={title} size="small" />
        )}
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
      {/* Cover */}
      {cover_url && !imgError ? (
        <Image
          source={{ uri: cover_url }}
          style={styles.listCover}
          resizeMode="cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <CoverFallback title={title} size="small" />
      )}

      {/* Content */}
      <View style={styles.listContent}>
        {/* Title + type icon */}
        <View style={styles.listTopRow}>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={2} style={styles.listTitle}>{title}</Text>
            <Text numberOfLines={1} style={styles.listAuthor}>{author}</Text>
          </View>
          <MaterialCommunityIcons
            name={typeInfo.icon}
            size={16}
            color={typeInfo.color}
            style={{ marginLeft: 8, marginTop: 2 }}
          />
        </View>

        {/* Progress */}
        <View style={styles.listProgressContainer}>
          <ProgressBar
            progress={progress_percent / 100}
            color={is_completed ? tokens.colors.semantic.success : tokens.colors.primary}
            style={styles.listProgressBar}
          />
          <View style={styles.listProgressRow}>
            <Text style={styles.listProgressPct}>
              {is_completed ? 'Terminé' : `${Math.round(progress_percent)}%`}
            </Text>
            <Text style={styles.listDate}>{formatDate(last_read_at)}</Text>
          </View>
        </View>

        {/* Continue button — only if not completed */}
        {onContinue && !is_completed && (
          <TouchableOpacity
            style={styles.listContinueBtn}
            onPress={() => onContinue(content_id, last_position)}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name={content_type === 'audiobook' ? 'play-circle' : 'book-open-page-variant'}
              size={14}
              color={tokens.colors.primary}
            />
            <Text style={styles.listContinueTxt}>Reprendre</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  // Cover fallback
  coverFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  coverFallbackLetter: {
    fontWeight: '800',
    color: 'rgba(255,255,255,0.9)',
  },

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
    backgroundColor: tokens.colors.surfaces.light.variant,
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
    backgroundColor: tokens.colors.surfaces.light.variant,
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
    borderRadius: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    marginBottom: 12,
    overflow: 'hidden',
  },
  listCover: {
    width: 80,
    minHeight: 120,
  },
  listContent: {
    flex: 1,
    padding: 10,
    justifyContent: 'space-between',
  },
  listTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.onBackground.light,
    lineHeight: 18,
    marginBottom: 2,
  },
  listAuthor: {
    fontSize: 12,
    color: tokens.colors.onSurface.light,
  },
  listProgressContainer: {
    marginTop: 'auto',
  },
  listProgressBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: tokens.colors.surfaces.light.variant,
    marginBottom: 4,
  },
  listProgressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listProgressPct: {
    fontSize: 11,
    fontWeight: '600',
    color: tokens.colors.primary,
  },
  listDate: {
    fontSize: 10,
    color: tokens.colors.onSurface.light,
    opacity: 0.6,
  },
  listContinueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: `${tokens.colors.primary}15`,
  },
  listContinueTxt: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.primary,
  },
});

export default ContentCardWithProgress;
