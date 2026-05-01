/**
 * ProfileSelectorScreen — Sélection du profil famille au démarrage
 * Affiché après login si l'abonnement famille a plusieurs profils.
 */
import React, { useEffect, useState, useRef } from 'react';
import {
  View, StyleSheet, TouchableOpacity, FlatList,
  TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  listProfiles, selectProfile, AVATAR_COLORS,
} from '../services/family.service';
import { useProfile } from '../context/ProfileContext';

export default function ProfileSelectorScreen({ navigation, route }) {
  const fromSettings = route?.params?.fromSettings === true;
  const { switchProfile } = useProfile();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(null); // profileId being selected
  const [pinProfile, setPinProfile] = useState(null); // profile requiring PIN
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const pinInputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    // Safety timeout — redirect to Home if API hangs > 6s
    const fallback = setTimeout(() => {
      if (!cancelled) navigation.replace('Home');
    }, 6000);

    listProfiles()
      .then((data) => {
        if (cancelled) return;
        clearTimeout(fallback);
        // If only 1 profile (owner alone) or no family sub → skip selector
        if (!data || data.length <= 1) {
          navigation.replace('Home');
          return;
        }
        setProfiles(data);
        setLoading(false);
      })
      .catch(() => {
        clearTimeout(fallback);
        if (!cancelled) navigation.replace('Home');
      });

    return () => { cancelled = true; clearTimeout(fallback); };
  }, []);

  const handleSelect = async (profile) => {
    if (profile.has_pin) {
      setPinProfile(profile);
      setPin('');
      setPinError('');
      setTimeout(() => pinInputRef.current?.focus(), 100);
      return;
    }
    try {
      setSelecting(profile.id);
      const selected = await selectProfile(profile.id);
      await switchProfile(selected);
      navigation.replace('Home');
    } catch (e) {
      Alert.alert('Erreur', e.message || 'Impossible de sélectionner ce profil.');
    } finally {
      setSelecting(null);
    }
  };

  const handlePinSubmit = async () => {
    if (!pin || pin.length < 4) { setPinError('PIN invalide (4-6 chiffres)'); return; }
    try {
      setSelecting(pinProfile.id);
      const selected = await selectProfile(pinProfile.id, pin);
      await switchProfile(selected);
      setPinProfile(null);
      navigation.replace('Home');
    } catch (e) {
      setPinError('PIN incorrect. Réessayez.');
      setPin('');
    } finally {
      setSelecting(null);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#f4a825" />
      </SafeAreaView>
    );
  }

  // PIN modal overlay
  if (pinProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView style={styles.pinWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <MaterialCommunityIcons name="lock" size={48} color="#f4a825" style={{ marginBottom: 16 }} />
          <Text style={styles.pinTitle}>Code PIN</Text>
          <Text style={styles.pinSubtitle}>Profil « {pinProfile.name} »</Text>
          <View style={styles.pinRow}>
            {[0,1,2,3,4,5].slice(0, 6).map((_, i) => (
              <View key={i} style={[styles.pinDot, pin.length > i && styles.pinDotFilled]} />
            ))}
          </View>
          <TextInput
            ref={pinInputRef}
            style={styles.pinHiddenInput}
            value={pin}
            onChangeText={(v) => { setPin(v.replace(/\D/g, '').slice(0, 6)); setPinError(''); }}
            keyboardType="number-pad"
            maxLength={6}
            secureTextEntry
            onSubmitEditing={handlePinSubmit}
          />
          {!!pinError && <Text style={styles.pinError}>{pinError}</Text>}
          <TouchableOpacity
            style={[styles.pinBtn, { opacity: pin.length >= 4 ? 1 : 0.5 }]}
            onPress={handlePinSubmit}
            disabled={pin.length < 4 || !!selecting}
          >
            {selecting ? <ActivityIndicator color="#111" size="small" /> : <Text style={styles.pinBtnText}>Continuer</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setPinProfile(null); setPin(''); }} style={{ marginTop: 16 }}>
            <Text style={styles.cancelText}>Annuler</Text>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {fromSettings && (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>Qui regarde ?</Text>
        <Text style={styles.headerSub}>Choisissez votre profil</Text>
      </View>

      <FlatList
        data={profiles}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => {
          const color = item.avatar_color || AVATAR_COLORS[0];
          const isLoading = selecting === item.id;
          return (
            <TouchableOpacity
              style={styles.profileCard}
              onPress={() => handleSelect(item)}
              disabled={!!selecting}
              activeOpacity={0.7}
            >
              <View style={[styles.avatar, { backgroundColor: color }]}>
                {isLoading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.avatarLetter}>{item.name?.[0]?.toUpperCase() || '?'}</Text>
                }
                {item.has_pin && (
                  <View style={styles.pinBadge}>
                    <MaterialCommunityIcons name="lock" size={10} color="#fff" />
                  </View>
                )}
                {item.is_child && (
                  <View style={[styles.pinBadge, { backgroundColor: '#4CAF50', right: 20 }]}>
                    <MaterialCommunityIcons name="star" size={10} color="#fff" />
                  </View>
                )}
              </View>
              <Text style={styles.profileName} numberOfLines={1}>{item.name}</Text>
              {item.is_owner && <Text style={styles.ownerBadge}>Principal</Text>}
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e' },
  header: { alignItems: 'center', paddingTop: 40, paddingBottom: 24, position: 'relative' },
  backBtn: { position: 'absolute', left: 16, top: 40 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  headerSub: { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 6 },
  grid: { paddingHorizontal: 24, paddingBottom: 40 },
  row: { justifyContent: 'space-between', marginBottom: 24 },
  profileCard: { width: '46%', alignItems: 'center' },
  avatar: {
    width: 90, height: 90, borderRadius: 45,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10, elevation: 4,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8,
  },
  avatarLetter: { fontSize: 36, fontWeight: '800', color: '#fff' },
  pinBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#f4a825',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#1a1a2e',
  },
  profileName: { fontSize: 15, fontWeight: '700', color: '#fff', textAlign: 'center' },
  ownerBadge: { fontSize: 11, color: '#f4a825', fontWeight: '600', marginTop: 2 },

  // PIN screen
  pinWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  pinTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 4 },
  pinSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 32 },
  pinRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  pinDot: {
    width: 14, height: 14, borderRadius: 7,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
  },
  pinDotFilled: { backgroundColor: '#f4a825', borderColor: '#f4a825' },
  pinHiddenInput: { position: 'absolute', opacity: 0, width: 1, height: 1 },
  pinError: { color: '#ef5350', fontSize: 13, marginBottom: 12 },
  pinBtn: {
    backgroundColor: '#f4a825', borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 48, marginTop: 8,
  },
  pinBtnText: { color: '#111', fontWeight: '800', fontSize: 16 },
  cancelText: { color: 'rgba(255,255,255,0.4)', fontSize: 14 },
});
