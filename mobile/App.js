import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PaperProvider, Text } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts, PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import theme from './src/theme/theme';
import * as authService from './src/services/auth.service';

// Import screens
import OnboardingScreen from './src/screens/OnboardingScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import HomeScreen from './src/screens/HomeScreen';
import ProfileScreen from './src/screens/ProfileScreen.simple';
import HistoryScreen from './src/screens/HistoryScreen.simple';
import CatalogScreen from './src/screens/CatalogScreen';
import ContentDetailScreen from './src/screens/ContentDetailScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);

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
      // DEV MODE: Force onboarding to show (comment out after testing)
      // await AsyncStorage.removeItem('onboarding_complete');

      // Check if user has seen onboarding
      const onboardingComplete = await AsyncStorage.getItem('onboarding_complete');
      setHasSeenOnboarding(onboardingComplete === 'true');

      // Check authentication
      const authenticated = await authService.isAuthenticated();
      setIsAuthenticated(authenticated);
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

  return (
    <PaperProvider theme={theme}>
      <NavigationContainer>
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
            options={{ title: 'Mon Profil' }}
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
            options={{ title: 'Détails' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
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
