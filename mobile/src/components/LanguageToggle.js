import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { changeLanguage, SUPPORTED_LANGUAGES } from '../i18n';

const tokens = require('../config/tokens');

/**
 * Compact language toggle (FR / EN) — used on Onboarding, Login, Register.
 * Two side-by-side pills; the active one is highlighted.
 */
export default function LanguageToggle({ style, compact = false }) {
  const { i18n } = useTranslation();
  const current = (i18n.language || 'fr').slice(0, 2);

  return (
    <View style={[styles.row, style]}>
      {SUPPORTED_LANGUAGES.map((lang) => {
        const active = current === lang.code;
        return (
          <TouchableOpacity
            key={lang.code}
            onPress={() => { if (!active) changeLanguage(lang.code); }}
            activeOpacity={0.8}
            style={[
              styles.pill,
              compact && styles.pillCompact,
              active && styles.pillActive,
            ]}
            accessibilityLabel={lang.label}
          >
            <Text style={[styles.flag, compact && styles.flagCompact]}>{lang.flag}</Text>
            <Text style={[styles.label, compact && styles.labelCompact, active && styles.labelActive]}>
              {lang.code.toUpperCase()}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1, borderColor: '#E8DDD4',
    backgroundColor: '#fff',
  },
  pillCompact: { paddingHorizontal: 10, paddingVertical: 5 },
  pillActive: { borderColor: tokens.colors.primary, backgroundColor: `${tokens.colors.primary}12` },
  flag: { fontSize: 16 },
  flagCompact: { fontSize: 13 },
  label: { fontSize: 12, fontWeight: '700', color: '#8a7d73', letterSpacing: 0.5 },
  labelCompact: { fontSize: 11 },
  labelActive: { color: tokens.colors.primary },
});
