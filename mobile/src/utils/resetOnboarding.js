import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Réinitialise le flag d'onboarding pour forcer l'affichage au prochain démarrage
 * Utile pour le développement/test
 */
export const resetOnboarding = async () => {
  try {
    await AsyncStorage.removeItem('onboarding_complete');
    console.log('✅ Onboarding reset! Redémarrez l\'app pour voir l\'onboarding.');
    return true;
  } catch (error) {
    console.error('❌ Erreur lors du reset onboarding:', error);
    return false;
  }
};

/**
 * Force l'affichage de l'onboarding (bypass la vérification)
 */
export const forceShowOnboarding = async () => {
  try {
    await AsyncStorage.setItem('onboarding_complete', 'false');
    console.log('✅ Onboarding forcé! Redémarrez l\'app.');
    return true;
  } catch (error) {
    console.error('❌ Erreur:', error);
    return false;
  }
};
