import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {
  Text,
  ActivityIndicator,
  Button,
  Snackbar,
  Surface,
} from 'react-native-paper';
import { readingService } from '../services/reading.service';
import { authFetch } from '../services/auth.service';
import API_URL from '../config/api';
import ContentCardWithProgress from '../components/ContentCardWithProgress';

const tokens = require('../config/tokens');

const FILTERS = [
  { key: 'all', label: 'Tous' },
  { key: 'ebook', label: 'Ebooks' },
  { key: 'audiobook', label: 'Audio' },
  { key: 'completed', label: 'Terminés' },
];

function formatTime(seconds) {
  if (!seconds || seconds <= 0) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${m > 0 ? ` ${m}m` : ''}`;
  return `${m}m`;
}

function StatsBar({ stats, loading }) {
  const cards = [
    { label: 'Livres lus', value: loading ? '…' : String(stats?.total_books ?? 0), icon: '📚' },
    { label: 'Temps total', value: loading ? '…' : formatTime(stats?.total_time_seconds), icon: '⏱️' },
    { label: 'Série', value: loading ? '…' : `${stats?.streak_days ?? 0}j`, icon: '🔥' },
    { label: 'Terminés', value: loading ? '…' : String(stats?.completed ?? 0), icon: '✅' },
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.statsBar}
      style={{ flexGrow: 0 }}
    >
      {cards.map((s) => (
        <Surface key={s.label} style={styles.statCard} elevation={0}>
          <Text style={styles.statIcon}>{s.icon}</Text>
          <Text style={styles.statValue}>{s.value}</Text>
          <Text style={styles.statLabel}>{s.label}</Text>
        </Surface>
      ))}
    </ScrollView>
  );
}

function FilterTabs({ active, onChange }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterRow}
      style={{ flexGrow: 0 }}
    >
      {FILTERS.map((f) => {
        const isActive = active === f.key;
        return (
          <TouchableOpacity
            key={f.key}
            onPress={() => onChange(f.key)}
            style={[styles.filterChip, isActive && styles.filterChipActive]}
          >
            <Text style={[styles.filterLabel, isActive && styles.filterLabelActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

export default function HistoryScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, total_pages: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const res = await authFetch(`${API_URL}/reading-history/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data?.data || null);
      }
    } catch (_) {}
    finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async (page = 1, append = false) => {
    try {
      if (page === 1 && !append) setLoading(true);
      else if (append) setLoadingMore(true);
      setError(null);

      const result = await readingService.getHistory({ page });

      if (append) {
        setItems((prev) => [...prev, ...result.items]);
      } else {
        setItems(result.items);
      }
      setPagination(result.pagination);
    } catch (err) {
      if (err?.response?.status === 401) {
        navigation.replace('Login');
        return;
      }
      setError(err.message || 'Erreur lors du chargement');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [navigation]);

  useEffect(() => {
    fetchHistory(1);
    fetchStats();
  }, [fetchHistory, fetchStats]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchHistory(1);
    fetchStats();
  }, [fetchHistory, fetchStats]);

  const handleLoadMore = () => {
    if (!loadingMore && pagination.page < pagination.total_pages) {
      fetchHistory(pagination.page + 1, true);
    }
  };

  const handleContinue = (contentId, lastPosition, item) => {
    const type = String(item?.content_type || '').toLowerCase();
    if (type === 'audiobook') {
      navigation.navigate('AudioPlayer', { contentId });
    } else {
      navigation.navigate('BookReader', { contentId });
    }
  };

  const filtered = items.filter((item) => {
    if (filter === 'ebook') return item.content_type === 'ebook';
    if (filter === 'audiobook') return item.content_type === 'audiobook';
    if (filter === 'completed') return item.is_completed;
    return true;
  });

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
      onContinue={(id, pos) => handleContinue(id, pos, item)}
      onPress={() => navigation.navigate('ContentDetail', { contentId: item.content_id })}
    />
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.loadingMore}>
        <ActivityIndicator size="small" color={tokens.colors.primary} />
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📭</Text>
        <Text variant="titleMedium" style={styles.emptyTitle}>
          {filter === 'all'
            ? 'Aucun contenu dans votre historique'
            : `Aucun contenu "${FILTERS.find(f => f.key === filter)?.label}" trouvé`}
        </Text>
        <Text variant="bodyMedium" style={styles.emptyText}>
          {filter === 'all'
            ? 'Commencez à lire ou écouter pour que vos contenus apparaissent ici'
            : 'Essayez un autre filtre'}
        </Text>
        {filter === 'all' && (
          <Button
            mode="contained"
            onPress={() => navigation.navigate('Catalog')}
            style={styles.emptyButton}
            buttonColor={tokens.colors.primary}
          >
            Découvrir le catalogue
          </Button>
        )}
      </View>
    );
  };

  if (loading && items.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={tokens.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.title}>Mon Historique</Text>
        <Text variant="bodySmall" style={styles.subtitle}>
          {pagination.total > 0
            ? `${pagination.total} contenu${pagination.total > 1 ? 's' : ''} lu${pagination.total > 1 ? 's' : ''}`
            : 'Vos lectures et écoutes récentes'}
        </Text>
      </View>

      {/* Stats */}
      <StatsBar stats={stats} loading={statsLoading} />

      {/* Filters */}
      <FilterTabs active={filter} onChange={setFilter} />

      {/* List */}
      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={(item) => item.id || item.content_id}
        contentContainerStyle={[styles.list, filtered.length === 0 && { flex: 1 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[tokens.colors.primary]}
            tintColor={tokens.colors.primary}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
      />

      <Snackbar
        visible={!!error}
        onDismiss={() => setError(null)}
        duration={4000}
        action={{ label: 'Réessayer', onPress: () => fetchHistory(1) }}
      >
        {error}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.backgrounds.light,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: tokens.colors.backgrounds.light,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: tokens.colors.onBackground.light,
    marginBottom: 2,
  },
  subtitle: {
    color: tokens.colors.primaryLight,
    fontSize: 13,
  },
  // Stats
  statsBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 10,
  },
  statCard: {
    width: 90,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: tokens.colors.surfaces.light.variant,
  },
  statIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: tokens.colors.primary,
    lineHeight: 24,
  },
  statLabel: {
    fontSize: 11,
    color: tokens.colors.onSurface.light,
    opacity: 0.7,
    marginTop: 1,
  },
  // Filters
  filterRow: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    backgroundColor: tokens.colors.surfaces.light.variant,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterChipActive: {
    backgroundColor: tokens.colors.primary,
    borderColor: tokens.colors.primary,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: tokens.colors.onSurface.light,
  },
  filterLabelActive: {
    color: '#fff',
    fontWeight: '700',
  },
  // List
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  loadingMore: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  // Empty
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    color: tokens.colors.onBackground.light,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    color: tokens.colors.onSurface.light,
    textAlign: 'center',
    opacity: 0.7,
    marginBottom: 24,
  },
  emptyButton: {
    borderRadius: 24,
  },
});
