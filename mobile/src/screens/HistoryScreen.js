import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import {
  Text,
  ActivityIndicator,
  Banner,
  Button,
  SegmentedButtons,
} from 'react-native-paper';
import API_BASE_URL from '../config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ContentCardWithProgress from '../components/ContentCardWithProgress';

// Import shared design tokens
const tokens = require('../config/tokens');

const HistoryScreen = ({ navigation }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all', 'ebook', 'audiobook', 'completed'
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    total_pages: 0,
  });

  // Fetch reading history
  const fetchHistory = async (page = 1, append = false) => {
    try {
      if (!append) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        navigation.replace('Login');
        return;
      }

      const response = await fetch(
        `${API_BASE_URL}/reading-history?page=${page}&limit=20`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          await AsyncStorage.removeItem('access_token');
          await AsyncStorage.removeItem('refresh_token');
          navigation.replace('Login');
          return;
        }
        throw new Error(data.error?.message || 'Erreur lors du chargement de l\'historique.');
      }

      if (append) {
        setHistory((prev) => [...prev, ...(data.data || [])]);
      } else {
        setHistory(data.data || []);
      }
      setPagination(data.pagination);
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    } catch (err) {
      console.error('Fetch history error:', err);
      setError(err.message);
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchHistory(1);
  }, []);

  // Handle refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchHistory(1);
  }, []);

  // Handle load more (pagination)
  const handleLoadMore = () => {
    if (!loadingMore && pagination.page < pagination.total_pages) {
      fetchHistory(pagination.page + 1, true);
    }
  };

  // Filter history items
  const filteredHistory = history.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'ebook') return item.content_type === 'ebook';
    if (filter === 'audiobook') return item.content_type === 'audiobook';
    if (filter === 'completed') return item.is_completed;
    return true;
  });

  // Handle continue reading
  const handleContinue = (contentId, lastPosition) => {
    // Navigate to reader with saved position
    navigation.navigate('Reader', {
      contentId,
      position: lastPosition,
    });
  };

  // Handle card press (navigate to content detail)
  const handleCardPress = (contentId) => {
    navigation.navigate('ContentDetail', { contentId });
  };

  // Render item
  const renderItem = ({ item }) => (
    <ContentCardWithProgress
      content_id={item.content_id}
      title={item.title}
      author={item.author}
      content_type={item.content_type}
      cover_url={item.cover_url}
      progress_percent={item.progress_percent}
      last_read_at={item.last_read_at}
      is_completed={item.is_completed}
      last_position={item.last_position}
      variant="list"
      onContinue={handleContinue}
      onPress={() => handleCardPress(item.content_id)}
    />
  );

  // Render footer
  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.loadingMore}>
        <ActivityIndicator size="small" color={tokens.colors.primary} />
      </View>
    );
  };

  // Render empty
  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text variant="titleMedium" style={styles.emptyTitle}>
          Aucun contenu dans votre historique
        </Text>
        <Text variant="bodyMedium" style={styles.emptyText}>
          Commencez à lire ou écouter des contenus pour les voir apparaître ici
        </Text>
        <Button
          mode="contained"
          onPress={() => navigation.navigate('Catalogue')}
          style={styles.emptyButton}
          buttonColor={tokens.colors.primary}
        >
          Découvrir le catalogue
        </Button>
      </View>
    );
  };

  if (loading && history.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={tokens.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Error Banner */}
      {error && (
        <Banner
          visible={!!error}
          icon="alert-circle"
          style={styles.errorBanner}
          actions={[
            {
              label: 'Fermer',
              onPress: () => setError(null),
            },
          ]}
        >
          {error}
        </Banner>
      )}

      {/* Header */}
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.title}>
          Mon Historique
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Retrouvez tous les contenus que vous avez lus ou écoutés
        </Text>
      </View>

      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        <SegmentedButtons
          value={filter}
          onValueChange={setFilter}
          buttons={[
            {
              value: 'all',
              label: 'Tous',
            },
            {
              value: 'ebook',
              label: 'Ebooks',
            },
            {
              value: 'audiobook',
              label: 'Audio',
            },
            {
              value: 'completed',
              label: 'Terminés',
            },
          ]}
          style={styles.segmentedButtons}
        />
      </View>

      {/* History List */}
      <FlatList
        data={filteredHistory}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[tokens.colors.primary]}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
      />

      {/* Stats Footer */}
      {filteredHistory.length > 0 && (
        <View style={styles.statsFooter}>
          <Text variant="bodySmall" style={styles.statsText}>
            Total : {pagination.total} contenus dans votre historique
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.backgrounds.light,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: tokens.colors.backgrounds.light,
  },
  errorBanner: {
    backgroundColor: '#FFEBEE',
  },
  header: {
    padding: 24,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: tokens.colors.onSurface.light,
    marginBottom: 4,
  },
  subtitle: {
    color: tokens.colors.onSurface.light,
  },
  filterContainer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  segmentedButtons: {
    backgroundColor: 'white',
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  loadingMore: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyTitle: {
    color: tokens.colors.onSurface.light,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    color: tokens.colors.onSurface.light,
    marginBottom: 24,
    textAlign: 'center',
  },
  emptyButton: {
    marginTop: 8,
  },
  statsFooter: {
    padding: 16,
    paddingHorizontal: 24,
    backgroundColor: tokens.colors.backgrounds.surface,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.neutral[200],
  },
  statsText: {
    color: tokens.colors.onSurface.light,
  },
});

export default HistoryScreen;
