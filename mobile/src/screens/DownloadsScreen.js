/**
 * DownloadsScreen — Gestion des contenus téléchargés (hors-ligne)
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  getDownloadedContents,
  deleteDownloadedContent,
  getStorageUsage,
  formatBytes,
  purgeExpiredContent,
  isOnline,
} from '../services/offline.service';

const tokens = require('../config/tokens');

function formatExpiry(dateString) {
  if (!dateString) return null;
  const d = new Date(dateString);
  const diff = Math.ceil((d - Date.now()) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return 'Expiré';
  if (diff === 1) return 'Expire demain';
  if (diff <= 7) return `Expire dans ${diff} j`;
  return `Expire le ${d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}`;
}

export default function DownloadsScreen({ navigation }) {
  const [downloads, setDownloads] = useState([]);
  const [storageUsed, setStorageUsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [online, setOnline] = useState(true);

  const loadDownloads = useCallback(async () => {
    try {
      await purgeExpiredContent();
      const [contents, usage, networkState] = await Promise.all([
        getDownloadedContents(),
        getStorageUsage(),
        isOnline(),
      ]);
      setDownloads(contents);
      setStorageUsed(usage);
      setOnline(networkState);
    } catch (err) {
      console.error('DownloadsScreen load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDownloads();
  }, [loadDownloads]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDownloads();
  }, [loadDownloads]);

  const handleDelete = (item) => {
    Alert.alert(
      'Supprimer le téléchargement',
      `Supprimer "${item.title}" du stockage hors-ligne ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            await deleteDownloadedContent(item.contentId);
            loadDownloads();
          },
        },
      ]
    );
  };

  const handleOpen = (item) => {
    const isAudio = item.type === 'audiobook';
    if (isAudio) {
      navigation.navigate('AudioPlayer', { contentId: item.contentId });
    } else {
      navigation.navigate('BookReader', { contentId: item.contentId, title: item.title });
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={tokens.colors.onSurface.light} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Téléchargements</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator color={tokens.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={tokens.colors.onSurface.light} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Téléchargements</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Offline banner */}
      {!online && (
        <View style={styles.offlineBanner}>
          <MaterialCommunityIcons name="wifi-off" size={16} color="#fff" />
          <Text style={styles.offlineBannerText}>Mode hors-ligne — lectures disponibles ci-dessous</Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[tokens.colors.primary]} />}
      >
        {/* Stockage utilisé */}
        {downloads.length > 0 && (
          <View style={styles.storageRow}>
            <MaterialCommunityIcons name="harddisk" size={16} color={tokens.colors.primary} />
            <Text style={styles.storageText}>
              {formatBytes(storageUsed)} utilisés · {downloads.length} fichier{downloads.length > 1 ? 's' : ''}
            </Text>
          </View>
        )}

        {/* Liste */}
        {downloads.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="download-off-outline" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>Aucun contenu téléchargé</Text>
            <Text style={styles.emptySubtitle}>
              Téléchargez des livres ou livres audio depuis la page détail pour les lire sans connexion.
            </Text>
            <TouchableOpacity style={styles.catalogBtn} onPress={() => navigation.navigate('Catalog')}>
              <Text style={styles.catalogBtnText}>Parcourir le catalogue</Text>
            </TouchableOpacity>
          </View>
        ) : (
          downloads.map((item) => {
            const isAudio = item.type === 'audiobook';
            const expiryLabel = formatExpiry(item.expiresAt);
            const expiryColor = expiryLabel === 'Expiré' ? '#ef5350'
              : expiryLabel?.includes('demain') || expiryLabel?.includes('dans 1') ? '#FF8F00'
              : '#9E9E9E';

            return (
              <TouchableOpacity
                key={item.contentId}
                style={styles.card}
                activeOpacity={0.8}
                onPress={() => handleOpen(item)}
              >
                {/* Cover */}
                <View style={styles.coverWrap}>
                  {item.cover_url ? (
                    <Image source={{ uri: item.cover_url }} style={styles.cover} resizeMode="cover" />
                  ) : (
                    <View style={[styles.cover, styles.coverPlaceholder]}>
                      <MaterialCommunityIcons
                        name={isAudio ? 'headphones' : 'book-open-variant'}
                        size={28}
                        color={tokens.colors.primary}
                      />
                    </View>
                  )}
                  {/* Type badge */}
                  <View style={[styles.typeBadge, isAudio && styles.typeBadgeAudio]}>
                    <MaterialCommunityIcons
                      name={isAudio ? 'headphones' : 'book-open-page-variant'}
                      size={10}
                      color="#fff"
                    />
                  </View>
                </View>

                {/* Info */}
                <View style={styles.cardInfo}>
                  <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                  {!!item.author && (
                    <Text style={styles.cardAuthor} numberOfLines={1}>{item.author}</Text>
                  )}
                  <Text style={styles.cardMeta}>{isAudio ? 'Livre audio' : 'Ebook'} · {formatBytes(item.fileSize || 0)}</Text>
                  {expiryLabel && (
                    <Text style={[styles.cardExpiry, { color: expiryColor }]}>{expiryLabel}</Text>
                  )}
                  <Text style={styles.cardDate}>
                    Téléchargé le {new Date(item.downloadedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                  </Text>
                </View>

                {/* Actions */}
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.playBtn}
                    onPress={() => handleOpen(item)}
                  >
                    <MaterialCommunityIcons
                      name={isAudio ? 'play-circle' : 'book-open'}
                      size={26}
                      color={tokens.colors.primary}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDelete(item)}
                  >
                    <MaterialCommunityIcons name="delete-outline" size={22} color="#ef5350" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fcfaf8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0ebe3',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2E4057',
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#B5651D',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  offlineBannerText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  scroll: {
    padding: 16,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  storageText: {
    fontSize: 13,
    color: '#9E9E9E',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2E4057',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9E9E9E',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  catalogBtn: {
    backgroundColor: tokens.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  catalogBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f0ebe3',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  coverWrap: {
    position: 'relative',
    marginRight: 12,
  },
  cover: {
    width: 56,
    height: 78,
    borderRadius: 6,
    backgroundColor: '#f0ebe3',
  },
  coverPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#2E4057',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeBadgeAudio: {
    backgroundColor: tokens.colors.primary,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2E4057',
    marginBottom: 2,
    lineHeight: 19,
  },
  cardAuthor: {
    fontSize: 12,
    color: '#B5651D',
    fontWeight: '600',
    marginBottom: 4,
  },
  cardMeta: {
    fontSize: 12,
    color: '#9E9E9E',
    marginBottom: 2,
  },
  cardExpiry: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  cardDate: {
    fontSize: 11,
    color: '#BDBDBD',
  },
  cardActions: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 8,
    height: 78,
  },
  playBtn: {
    padding: 4,
  },
  deleteBtn: {
    padding: 4,
  },
});
