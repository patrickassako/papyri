import React, { useState, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, ActivityIndicator, Snackbar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { deviceService } from '../services/device.service';
import BottomNavBar from '../components/BottomNavBar';

const tokens = require('../config/tokens');

const DEVICE_ICONS = {
  mobile: 'cellphone',
  tablet: 'tablet',
  desktop: 'monitor',
  web: 'web',
};

function formatLastSeen(dateStr) {
  if (!dateStr) return 'Jamais vu';
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 2) return 'À l\'instant';
  if (minutes < 60) return `Il y a ${minutes} min`;
  if (hours < 24) return `Il y a ${hours}h`;
  if (days === 1) return 'Hier';
  return `Il y a ${days} jours`;
}

function DeviceCard({ device, onRemove, removing }) {
  const icon = DEVICE_ICONS[device.device_type] || 'devices';
  const isCurrent = device.is_current;
  const isReading = device.is_reading;

  return (
    <View style={[styles.card, isCurrent && styles.cardCurrent]}>
      {/* Icône + infos */}
      <View style={styles.cardLeft}>
        <View style={[styles.iconWrap, isCurrent && styles.iconWrapCurrent]}>
          <MaterialCommunityIcons
            name={icon}
            size={26}
            color={isCurrent ? '#fff' : tokens.colors.primary}
          />
        </View>
        <View style={styles.cardInfo}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardName} numberOfLines={1}>{device.device_name}</Text>
            {isCurrent && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Cet appareil</Text>
              </View>
            )}
          </View>
          {isReading && (
            <View style={styles.readingRow}>
              <MaterialCommunityIcons name="book-open-variant" size={12} color={tokens.colors.semantic?.success || '#4CAF50'} />
              <Text style={styles.readingText}>En lecture actuellement</Text>
            </View>
          )}
          <Text style={styles.cardDate}>{formatLastSeen(device.last_seen_at)}</Text>
        </View>
      </View>

      {/* Bouton supprimer — masqué pour l'appareil courant */}
      {!isCurrent && (
        <TouchableOpacity
          style={styles.removeBtn}
          onPress={() => onRemove(device)}
          disabled={removing}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {removing ? (
            <ActivityIndicator size={16} color={tokens.colors.primary} />
          ) : (
            <MaterialCommunityIcons name="trash-can-outline" size={20} color="#e53935" />
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function DevicesScreen({ navigation }) {
  const [devices, setDevices] = useState([]);
  const [meta, setMeta] = useState({ limit: 3, count: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [snack, setSnack] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await deviceService.list();
      if (res?.data) {
        setDevices(res.data);
        setMeta(res.meta || { limit: 3, count: res.data.length });
      }
    } catch (err) {
      setSnack('Impossible de charger les appareils');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load();
  }, [load]));

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleRemove = (device) => {
    Alert.alert(
      'Supprimer cet appareil',
      `Voulez-vous déconnecter "${device.device_name}" de votre compte ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              setRemovingId(device.device_id);
              await deviceService.remove(device.device_id);
              setDevices((prev) => prev.filter((d) => d.device_id !== device.device_id));
              setMeta((prev) => ({ ...prev, count: prev.count - 1 }));
              setSnack('Appareil supprimé');
            } catch {
              setSnack('Erreur lors de la suppression');
            } finally {
              setRemovingId(null);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={tokens.colors.onBackground.light} />
          </TouchableOpacity>
          <Text style={styles.title}>Mes appareils</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={tokens.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={tokens.colors.onBackground.light} />
        </TouchableOpacity>
        <Text style={styles.title}>Mes appareils</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Compteur */}
      <View style={styles.counterRow}>
        <Text style={styles.counterText}>
          {meta.count} / {meta.limit} appareil{meta.count > 1 ? 's' : ''} connecté{meta.count > 1 ? 's' : ''}
        </Text>
        {meta.count >= meta.limit && (
          <View style={styles.limitBadge}>
            <MaterialCommunityIcons name="alert-circle-outline" size={13} color="#e53935" />
            <Text style={styles.limitText}>Limite atteinte</Text>
          </View>
        )}
      </View>

      {/* Info limite */}
      <View style={styles.infoBox}>
        <MaterialCommunityIcons name="information-outline" size={16} color={tokens.colors.primary} />
        <Text style={styles.infoText}>
          Votre abonnement autorise jusqu'à {meta.limit} appareils simultanés. Supprimez un appareil pour en ajouter un nouveau.
        </Text>
      </View>

      <FlatList
        data={devices}
        keyExtractor={(d) => d.device_id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[tokens.colors.primary]}
            tintColor={tokens.colors.primary}
          />
        }
        renderItem={({ item }) => (
          <DeviceCard
            device={item}
            onRemove={handleRemove}
            removing={removingId === item.device_id}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="devices" size={52} color={tokens.colors.primaryLight} />
            <Text style={styles.emptyText}>Aucun appareil enregistré</Text>
          </View>
        }
      />

      <Snackbar
        visible={!!snack}
        onDismiss={() => setSnack(null)}
        duration={3000}
      >
        {snack}
      </Snackbar>

      <BottomNavBar navigation={navigation} activeTab="Profile" />
    </SafeAreaView>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: tokens.colors.onBackground.light,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  counterText: {
    fontSize: 13,
    color: tokens.colors.onSurface.light,
    fontWeight: '500',
  },
  limitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ffebee',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  limitText: {
    fontSize: 11,
    color: '#e53935',
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
    backgroundColor: `${tokens.colors.primary}12`,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: tokens.colors.primary,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: tokens.colors.onSurface.light,
    lineHeight: 17,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  cardCurrent: {
    borderWidth: 1.5,
    borderColor: tokens.colors.primary,
  },
  cardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: `${tokens.colors.primary}18`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapCurrent: {
    backgroundColor: tokens.colors.primary,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  cardName: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.onBackground.light,
  },
  badge: {
    backgroundColor: tokens.colors.primary,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '700',
  },
  readingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  readingText: {
    fontSize: 11,
    color: '#4CAF50',
    fontWeight: '500',
  },
  cardDate: {
    fontSize: 12,
    color: tokens.colors.onSurface.light,
    marginTop: 3,
    opacity: 0.7,
  },
  removeBtn: {
    padding: 8,
    marginLeft: 8,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: tokens.colors.onSurface.light,
    opacity: 0.6,
  },
});
