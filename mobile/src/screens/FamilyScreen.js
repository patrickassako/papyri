/**
 * FamilyScreen — Gestion des profils famille
 * Accessible depuis le profil utilisateur.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, StyleSheet, TouchableOpacity, FlatList,
  TextInput, Alert, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  listProfiles, createProfile, updateProfile, deleteProfile,
  setPin, removePin, AVATAR_COLORS,
} from '../services/family.service';

const tokens = require('../config/tokens');

export default function FamilyScreen({ navigation }) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Create/Edit sheet
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // null = create
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState(AVATAR_COLORS[0]);
  const [formIsChild, setFormIsChild] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  // PIN sheet
  const [pinTarget, setPinTarget] = useState(null);
  const [pinValue, setPinValue] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinLoading, setPinLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await listProfiles();
      setProfiles(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditTarget(null);
    setFormName('');
    setFormColor(AVATAR_COLORS[0]);
    setFormIsChild(false);
    setShowForm(true);
  };

  const openEdit = (profile) => {
    setEditTarget(profile);
    setFormName(profile.name || '');
    setFormColor(profile.avatar_color || AVATAR_COLORS[0]);
    setFormIsChild(!!profile.is_child);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setFormLoading(true);
    try {
      if (editTarget) {
        await updateProfile(editTarget.id, {
          name: formName.trim(),
          avatar_color: formColor,
          is_child: formIsChild,
        });
      } else {
        await createProfile({
          name: formName.trim(),
          avatar_color: formColor,
          is_child: formIsChild,
        });
      }
      setShowForm(false);
      load();
    } catch (e) {
      Alert.alert('Erreur', e.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = (profile) => {
    if (profile.is_owner) {
      Alert.alert('Impossible', 'Le profil principal ne peut pas être supprimé.');
      return;
    }
    Alert.alert(
      'Supprimer le profil',
      `Supprimer « ${profile.name} » définitivement ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer', style: 'destructive',
          onPress: async () => {
            try {
              await deleteProfile(profile.id);
              load();
            } catch (e) { Alert.alert('Erreur', e.message); }
          },
        },
      ]
    );
  };

  const openPin = (profile) => {
    setPinTarget(profile);
    setPinValue('');
    setPinError('');
  };

  const handleSetPin = async () => {
    if (pinValue.length < 4) { setPinError('PIN invalide (4-6 chiffres)'); return; }
    setPinLoading(true);
    try {
      await setPin(pinTarget.id, pinValue);
      setPinTarget(null);
      load();
    } catch (e) {
      setPinError(e.message);
    } finally {
      setPinLoading(false);
    }
  };

  const handleRemovePin = async (profile) => {
    Alert.alert('Supprimer le PIN', `Supprimer le PIN du profil « ${profile.name} » ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          try {
            await removePin(profile.id);
            load();
          } catch (e) { Alert.alert('Erreur', e.message); }
        },
      },
    ]);
  };

  // ── PIN Sheet ─────────────────────────────────────────────────────────────
  if (pinTarget) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setPinTarget(null)} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#2E4057" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Code PIN — {pinTarget.name}</Text>
          <View style={{ width: 40 }} />
        </View>
        <KeyboardAvoidingView style={styles.pinSheet} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <MaterialCommunityIcons name="lock" size={48} color={tokens.colors.primary} style={{ marginBottom: 12 }} />
          <Text style={styles.pinLabel}>Nouveau code PIN (4-6 chiffres)</Text>
          <TextInput
            style={styles.pinInput}
            value={pinValue}
            onChangeText={(v) => { setPinValue(v.replace(/\D/g, '').slice(0, 6)); setPinError(''); }}
            keyboardType="number-pad"
            maxLength={6}
            secureTextEntry
            placeholder="••••"
            placeholderTextColor="#bbb"
          />
          {!!pinError && <Text style={styles.pinError}>{pinError}</Text>}
          <TouchableOpacity
            style={[styles.saveBtn, { opacity: pinValue.length >= 4 ? 1 : 0.5 }]}
            onPress={handleSetPin}
            disabled={pinValue.length < 4 || pinLoading}
          >
            {pinLoading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.saveBtnText}>Enregistrer le PIN</Text>
            }
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Create/Edit Form ──────────────────────────────────────────────────────
  if (showForm) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setShowForm(false)} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#2E4057" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{editTarget ? 'Modifier le profil' : 'Nouveau profil'}</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={styles.formScroll}>
          {/* Preview avatar */}
          <View style={[styles.avatarPreview, { backgroundColor: formColor }]}>
            <Text style={styles.avatarLetter}>{formName?.[0]?.toUpperCase() || '?'}</Text>
          </View>

          {/* Name */}
          <Text style={styles.formLabel}>Nom du profil</Text>
          <TextInput
            style={styles.formInput}
            value={formName}
            onChangeText={setFormName}
            placeholder="Ex: Sophie"
            placeholderTextColor="#bbb"
            maxLength={30}
          />

          {/* Color */}
          <Text style={styles.formLabel}>Couleur de l'avatar</Text>
          <View style={styles.colorRow}>
            {AVATAR_COLORS.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.colorDot, { backgroundColor: c },
                  formColor === c && styles.colorDotSelected
                ]}
                onPress={() => setFormColor(c)}
              />
            ))}
          </View>

          {/* Child toggle */}
          {!editTarget?.is_owner && (
            <TouchableOpacity style={styles.toggleRow} onPress={() => setFormIsChild(v => !v)}>
              <View>
                <Text style={styles.toggleLabel}>Profil enfant</Text>
                <Text style={styles.toggleSub}>Contenu adapté à l'âge</Text>
              </View>
              <View style={[styles.toggle, formIsChild && styles.toggleOn]}>
                <View style={[styles.toggleThumb, formIsChild && styles.toggleThumbOn]} />
              </View>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.saveBtn, { opacity: formName.trim().length > 0 ? 1 : 0.5, marginTop: 32 }]}
            onPress={handleSave}
            disabled={!formName.trim() || formLoading}
          >
            {formLoading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.saveBtnText}>{editTarget ? 'Enregistrer' : 'Créer le profil'}</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Profiles List ─────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#2E4057" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profils famille</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={tokens.colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          {error.includes('famille') || error.includes('FAMILY') ? (
            <Text style={styles.subText}>
              Cette fonctionnalité est réservée à l'abonnement Famille.
            </Text>
          ) : null}
          <TouchableOpacity style={styles.saveBtn} onPress={load}>
            <Text style={styles.saveBtnText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={profiles}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListFooterComponent={
            profiles.length < 6 ? (
              <TouchableOpacity style={styles.addCard} onPress={openCreate}>
                <MaterialCommunityIcons name="plus-circle" size={32} color={tokens.colors.primary} />
                <Text style={styles.addCardText}>Ajouter un profil</Text>
              </TouchableOpacity>
            ) : null
          }
          renderItem={({ item }) => {
            const color = item.avatar_color || AVATAR_COLORS[0];
            return (
              <View style={styles.profileRow}>
                {/* Avatar */}
                <View style={[styles.rowAvatar, { backgroundColor: color }]}>
                  <Text style={styles.rowAvatarLetter}>{item.name?.[0]?.toUpperCase() || '?'}</Text>
                </View>

                {/* Info */}
                <View style={{ flex: 1 }}>
                  <Text style={styles.profileName}>{item.name}</Text>
                  <View style={styles.badgeRow}>
                    {item.is_owner && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>Principal</Text>
                      </View>
                    )}
                    {item.is_child && (
                      <View style={[styles.badge, { backgroundColor: '#E8F5E9' }]}>
                        <Text style={[styles.badgeText, { color: '#2E7D32' }]}>Enfant</Text>
                      </View>
                    )}
                    {item.has_pin && (
                      <View style={[styles.badge, { backgroundColor: '#FFF3E0' }]}>
                        <MaterialCommunityIcons name="lock" size={11} color="#E65100" />
                        <Text style={[styles.badgeText, { color: '#E65100', marginLeft: 3 }]}>PIN actif</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Actions */}
                <View style={styles.rowActions}>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => item.has_pin ? handleRemovePin(item) : openPin(item)}
                  >
                    <MaterialCommunityIcons
                      name={item.has_pin ? 'lock-open' : 'lock'}
                      size={20}
                      color={item.has_pin ? '#E65100' : '#9E9E9E'}
                    />
                  </TouchableOpacity>
                  {!item.is_owner && (
                    <>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(item)}>
                        <MaterialCommunityIcons name="pencil" size={20} color="#2E4057" />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(item)}>
                        <MaterialCommunityIcons name="delete-outline" size={20} color="#ef5350" />
                      </TouchableOpacity>
                    </>
                  )}
                  {item.is_owner && (
                    <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(item)}>
                      <MaterialCommunityIcons name="pencil" size={20} color="#2E4057" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fcfaf8' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0ebe3',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#2E4057' },
  errorText: { fontSize: 15, color: '#ef5350', textAlign: 'center', marginBottom: 8 },
  subText: { fontSize: 13, color: '#9E9E9E', textAlign: 'center', marginBottom: 16 },

  list: { padding: 16, paddingBottom: 40 },
  profileRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12, padding: 12,
    marginBottom: 10, borderWidth: 1, borderColor: '#f0ebe3',
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4,
  },
  rowAvatar: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  rowAvatarLetter: { fontSize: 20, fontWeight: '800', color: '#fff' },
  profileName: { fontSize: 15, fontWeight: '700', color: '#2E4057', marginBottom: 4 },
  badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  badge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF3E0', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#E65100' },
  rowActions: { flexDirection: 'row', gap: 2 },
  actionBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  addCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    borderWidth: 1.5, borderColor: '#f4a825', borderStyle: 'dashed',
    marginTop: 4,
  },
  addCardText: { fontSize: 15, fontWeight: '700', color: '#f4a825' },

  // Form
  formScroll: { padding: 24, alignItems: 'center' },
  avatarPreview: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  avatarLetter: { fontSize: 32, fontWeight: '800', color: '#fff' },
  formLabel: { fontSize: 13, fontWeight: '700', color: '#2E4057', alignSelf: 'flex-start', marginBottom: 6 },
  formInput: {
    width: '100%', borderWidth: 1, borderColor: '#e0d8cc',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 16, color: '#2E4057', marginBottom: 20, backgroundColor: '#fff',
  },
  colorRow: { flexDirection: 'row', gap: 10, marginBottom: 24, alignSelf: 'flex-start', flexWrap: 'wrap' },
  colorDot: { width: 36, height: 36, borderRadius: 18 },
  colorDotSelected: { borderWidth: 3, borderColor: '#2E4057' },
  toggleRow: {
    width: '100%', flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', backgroundColor: '#fff',
    borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#f0ebe3', marginBottom: 8,
  },
  toggleLabel: { fontSize: 14, fontWeight: '700', color: '#2E4057' },
  toggleSub: { fontSize: 12, color: '#9E9E9E', marginTop: 2 },
  toggle: {
    width: 44, height: 24, borderRadius: 12,
    backgroundColor: '#E0E0E0', padding: 2, justifyContent: 'center',
  },
  toggleOn: { backgroundColor: '#4CAF50' },
  toggleThumb: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#fff', elevation: 2,
  },
  toggleThumbOn: { alignSelf: 'flex-end' },
  saveBtn: {
    backgroundColor: '#f4a825', borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 32, alignItems: 'center',
    width: '100%',
  },
  saveBtnText: { color: '#111', fontWeight: '800', fontSize: 16 },

  // PIN
  pinSheet: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  pinLabel: { fontSize: 15, fontWeight: '600', color: '#2E4057', marginBottom: 12 },
  pinInput: {
    width: '100%', borderWidth: 1.5, borderColor: '#f4a825',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 24, letterSpacing: 8, textAlign: 'center',
    color: '#2E4057', marginBottom: 8, backgroundColor: '#fff',
  },
  pinError: { color: '#ef5350', fontSize: 13, marginBottom: 12 },
});
