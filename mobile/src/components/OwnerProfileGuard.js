import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useProfile } from '../context/ProfileContext';

const tokens = require('../config/tokens');

/**
 * Wrap any screen reserved to the family owner profile (or solo accounts).
 * Non-owner profiles see a "section reserved to main profile" screen with
 * actions to switch profile or go home.
 */
export default function OwnerProfileGuard({ children }) {
  const navigation = useNavigation();
  const { activeProfile, isOwnerContext } = useProfile();

  if (isOwnerContext) return children;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.center}>
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name="lock-outline" size={36} color="#f1a10a" />
        </View>
        <Text style={styles.title}>Section réservée au profil principal</Text>
        <Text style={styles.body}>
          {`Le profil "${activeProfile?.name || ''}" n'a pas accès à cette page. Seul le profil principal peut gérer l'abonnement, la famille et les préférences du compte.`}
        </Text>
        <TouchableOpacity style={styles.btn} onPress={() => navigation.navigate('Home')} activeOpacity={0.8}>
          <Text style={styles.btnText}>Retour à l'accueil</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.btnSecondary]}
          onPress={() => navigation.navigate('ProfileSelector')}
          activeOpacity={0.8}
        >
          <Text style={[styles.btnText, styles.btnSecondaryText]}>Changer de profil</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F2EE' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  iconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#fff5e6',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    fontFamily: 'Playfair Display',
    fontSize: 22, fontWeight: '700',
    color: '#1c160d', textAlign: 'center', marginBottom: 10,
  },
  body: {
    fontSize: 14, color: '#7b6b51',
    textAlign: 'center', lineHeight: 21,
    marginBottom: 28,
  },
  btn: {
    width: '100%', height: 50, borderRadius: 14,
    backgroundColor: tokens.colors.primary,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 10,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnSecondary: { backgroundColor: '#EDE8E2' },
  btnSecondaryText: { color: '#4a4440' },
});
