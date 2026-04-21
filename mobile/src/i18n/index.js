import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';

import fr from './fr.json';
import en from './en.json';

const STORAGE_KEY = 'papyri_lang';

// Detect device language
function getDeviceLanguage() {
  try {
    const locale =
      Platform.OS === 'ios'
        ? NativeModules.SettingsManager?.settings?.AppleLocale ||
          NativeModules.SettingsManager?.settings?.AppleLanguages?.[0] ||
          'fr'
        : NativeModules.I18nManager?.localeIdentifier || 'fr';
    return locale?.substring(0, 2) || 'fr';
  } catch {
    return 'fr';
  }
}

// AsyncStorage language detector plugin
const AsyncStorageDetector = {
  type: 'languageDetector',
  async: true,
  detect: async (callback) => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved && ['fr', 'en'].includes(saved)) {
        callback(saved);
      } else {
        const deviceLang = getDeviceLanguage();
        const lang = ['fr', 'en'].includes(deviceLang) ? deviceLang : 'fr';
        callback(lang);
      }
    } catch {
      callback('fr');
    }
  },
  init: () => {},
  cacheUserLanguage: async (language) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, language);
    } catch {}
  },
};

i18n
  .use(AsyncStorageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
    },
    fallbackLng: 'fr',
    supportedLngs: ['fr', 'en'],
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;

// Helper to change language and persist it
export async function changeLanguage(lang) {
  await i18n.changeLanguage(lang);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, lang);
  } catch {}
}

export const SUPPORTED_LANGUAGES = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
];
