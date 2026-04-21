import './src/i18n'; // initialize i18n before anything else
import React, { useState, useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PaperProvider, Text } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts, PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import theme from './src/theme/theme';
import * as authService from './src/services/auth.service';
import { deviceService } from './src/services/device.service';
import { registerForPushNotifications } from './src/services/notifications.service';
import { AudioProvider } from './src/context/AudioContext';
import GlobalMiniPlayer from './src/components/GlobalMiniPlayer';

// Import screens
import OnboardingScreen from './src/screens/OnboardingScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import HomeScreen from './src/screens/HomeScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import CatalogScreen from './src/screens/CatalogScreen';
import ContentDetailScreen from './src/screens/ContentDetailScreen';
import AudioPlayerScreen from './src/screens/AudioPlayerScreen';
import ReaderScreen from './src/screens/ReaderScreen';
import BookReaderScreen from './src/screens/BookReaderScreen';
import SubscriptionScreen from './src/screens/SubscriptionScreen';
import DownloadsScreen from './src/screens/DownloadsScreen';
import LegalScreen from './src/screens/LegalScreen';
import FamilyScreen from './src/screens/FamilyScreen';
import ProfileSelectorScreen from './src/screens/ProfileSelectorScreen';

const Stack = createNativeStackNavigator();

// Screens where mini-player should be hidden
const HIDE_MINI_PLAYER_SCREENS = ['Onboarding', 'Login', 'Register', 'ForgotPassword', 'AudioPlayer', 'Reader', 'BookReader'];

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);
  const [currentRoute, setCurrentRoute] = useState('');
  const navigationRef = useNavigationContainerRef();

  // Load fonts
  const [fontsLoaded] = useFonts({
    'Playfair Display': PlayfairDisplay_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      checkAuthStatus();
    }
  }, [fontsLoaded]);

  const checkAuthStatus = async () => {
    try {
      const onboardingComplete = await AsyncStorage.getItem('onboarding_complete');
      setHasSeenOnboarding(onboardingComplete === 'true');

      const authenticated = await authService.isAuthenticated();
      setIsAuthenticated(authenticated);
      if (authenticated) {
        deviceService.register().catch(() => {});
        registerForPushNotifications().catch(() => {});
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setIsAuthenticated(false);
      setHasSeenOnboarding(false);
    } finally {
      setIsLoading(false);
    }
  };

  if (!fontsLoaded || isLoading) {
    return (
      <PaperProvider theme={theme}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#B5651D" />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </PaperProvider>
    );
  }

  const getInitialRoute = () => {
    if (!hasSeenOnboarding) return 'Onboarding';
    return isAuthenticated ? 'Home' : 'Login';
  };

  const showMiniPlayer = !HIDE_MINI_PLAYER_SCREENS.includes(currentRoute);

  return (
    <PaperProvider theme={theme}>
      <AudioProvider>
        <NavigationContainer
          ref={navigationRef}
          onReady={() => {
            setCurrentRoute(navigationRef.getCurrentRoute()?.name || '');
          }}
          onStateChange={() => {
            setCurrentRoute(navigationRef.getCurrentRoute()?.name || '');
          }}
        >
          <View style={{ flex: 1 }}>
            <StatusBar style="auto" />
            <Stack.Navigator
              initialRouteName={getInitialRoute()}
              screenOptions={{
                headerStyle: {
                  backgroundColor: '#B5651D',
                },
                headerTintColor: '#FFFFFF',
                headerTitleStyle: {
                  fontWeight: 'bold',
                },
              }}
            >
              {/* Onboarding */}
              <Stack.Screen
                name="Onboarding"
                component={OnboardingScreen}
                options={{ headerShown: false }}
              />

              {/* Public routes */}
              <Stack.Screen
                name="Login"
                component={LoginScreen}
                options={{ title: 'Connexion' }}
              />
              <Stack.Screen
                name="Register"
                component={RegisterScreen}
                options={{ title: 'Inscription' }}
              />
              <Stack.Screen
                name="ForgotPassword"
                component={ForgotPasswordScreen}
                options={{ title: 'Mot de passe oublié' }}
              />

              {/* Protected routes */}
              <Stack.Screen
                name="Home"
                component={HomeScreen}
                options={{
                  title: 'Accueil',
                  headerShown: false
                }}
              />
              <Stack.Screen
                name="Profile"
                component={ProfileScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="Subscription"
                component={SubscriptionScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="History"
                component={HistoryScreen}
                options={{ title: 'Historique' }}
              />
              <Stack.Screen
                name="Catalog"
                component={CatalogScreen}
                options={{
                  title: 'Catalogue',
                  headerShown: false
                }}
              />
              <Stack.Screen
                name="ContentDetail"
                component={ContentDetailScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="Reader"
                component={ReaderScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="BookReader"
                component={BookReaderScreen}
                options={{ headerShown: false }}
              />

              {/* Downloads */}
              <Stack.Screen
                name="Downloads"
                component={DownloadsScreen}
                options={{ headerShown: false }}
              />

              {/* Legal pages */}
              <Stack.Screen
                name="Legal"
                component={LegalScreen}
                options={{ headerShown: false }}
              />

              {/* Family accounts */}
              <Stack.Screen
                name="Family"
                component={FamilyScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="ProfileSelector"
                component={ProfileSelectorScreen}
                options={{ headerShown: false }}
              />

              {/* Audio Player — full screen modal */}
              <Stack.Screen
                name="AudioPlayer"
                component={AudioPlayerScreen}
                options={{
                  headerShown: false,
                  presentation: 'fullScreenModal',
                }}
              />
            </Stack.Navigator>

            {/* Global MiniPlayer */}
            {showMiniPlayer && (
              <GlobalMiniPlayer navigationRef={navigationRef} />
            )}
          </View>
        </NavigationContainer>
      </AudioProvider>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FBF7F2',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#867465',
  },
});
