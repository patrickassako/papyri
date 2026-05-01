import React, { useState } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getProxiedImageUrl } from '../utils/imageProxy';

const PALETTE = ['#B5651D', '#2E4057', '#4CAF50', '#9C27B0', '#2196F3', '#FF9800', '#009688', '#E91E63'];

/**
 * BookCover — image de couverture avec fallback local.
 * Si l'URL est absente ou échoue, affiche un bloc coloré avec lettre + icône.
 *
 * Props:
 *   uri        : string | null
 *   title      : string  (pour lettre + couleur du fallback)
 *   style      : ViewStyle appliqué au conteneur
 *   resizeMode : 'cover' | 'contain' (défaut: 'cover')
 */
export default function BookCover({ uri, title = '', style, resizeMode = 'cover' }) {
  const [error, setError] = useState(false);

  const bgColor = PALETTE[(title?.charCodeAt(0) || 0) % PALETTE.length];
  const letter = title?.[0]?.toUpperCase() || '?';

  const proxiedUri = getProxiedImageUrl(uri);

  if (!proxiedUri || error) {
    return (
      <View style={[styles.fallback, { backgroundColor: bgColor }, style]}>
        <MaterialCommunityIcons name="book-open-variant" size={28} color="rgba(255,255,255,0.35)" />
        <Text style={styles.letter}>{letter}</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: proxiedUri }}
      style={style}
      resizeMode={resizeMode}
      onError={() => setError(true)}
    />
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  letter: {
    fontSize: 22,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.9)',
  },
});
