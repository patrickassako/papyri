import { MD3LightTheme } from 'react-native-paper';

console.log('=== DEBUG THEME START ===');

// Import shared design tokens via local bridge
let tokens;
try {
  tokens = require('../config/tokens');
  console.log('Tokens loaded:', tokens ? 'YES' : 'NO');
  console.log('Tokens keys:', tokens ? Object.keys(tokens) : 'N/A');
  console.log('Colors:', tokens && tokens.colors ? 'YES' : 'NO');
  console.log('Colors primary:', tokens && tokens.colors && tokens.colors.primary);
} catch (error) {
  console.error('Error loading tokens:', error);
  // Fallback to default values
  tokens = {
    colors: {
      primary: '#B5651D',
      primaryLight: '#D4A574',
      secondary: '#D4A017',
      secondaryLight: '#F0D68A',
      accent: '#2E4057',
      backgrounds: { light: '#FBF7F2', dark: '#1A1A1A' },
      surfaces: {
        light: { default: '#FFFFFF', variant: '#F5EDE4' },
        dark: { default: '#2D2D2D', variant: '#3A3A3A' }
      },
      onBackground: { light: '#2C1810', dark: '#F5EDE4' },
      onSurface: { light: '#3D2B1F', dark: '#E8DDD0' },
      semantic: {
        success: '#4A7C59',
        warning: '#D4A017',
        error: '#C25450',
        info: '#2E4057'
      }
    },
    typography: {
      scale: {
        display: { size: '32px', weight: 700 },
        h1: { size: '26px', weight: 700 },
        body: { size: '16px', weight: 400 },
        bodySmall: { size: '14px', weight: 400 },
        button: { size: '16px', weight: 600 }
      }
    }
  };
}

console.log('=== DEBUG THEME END ===');

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: tokens.colors.primary,
    primaryContainer: tokens.colors.primaryLight,
    secondary: tokens.colors.secondary,
    secondaryContainer: tokens.colors.secondaryLight,
    tertiary: tokens.colors.accent,
    background: tokens.colors.backgrounds.light,
    surface: tokens.colors.surfaces.light.default,
    surfaceVariant: tokens.colors.surfaces.light.variant,
    error: tokens.colors.semantic.error,
    onPrimary: '#FFFFFF',
    onSecondary: '#2C1810',
    onBackground: tokens.colors.onBackground.light,
    onSurface: tokens.colors.onSurface.light,
  },
  fonts: {
    ...MD3LightTheme.fonts,
    displayLarge: {
      fontFamily: 'System',
      fontSize: 32,
      fontWeight: '700',
      letterSpacing: 0,
      lineHeight: 64,
    },
    displayMedium: {
      fontFamily: 'System',
      fontSize: 26,
      fontWeight: '700',
      letterSpacing: 0,
      lineHeight: 52,
    },
    bodyLarge: {
      fontFamily: 'System',
      fontSize: 16,
      fontWeight: '400',
      letterSpacing: 0.5,
      lineHeight: 24,
    },
    bodyMedium: {
      fontFamily: 'System',
      fontSize: 14,
      fontWeight: '400',
      letterSpacing: 0.25,
      lineHeight: 20,
    },
    labelLarge: {
      fontFamily: 'System',
      fontSize: 16,
      fontWeight: '600',
      letterSpacing: 0.1,
      lineHeight: 20,
    },
  },
  roundness: 8,
};

export default theme;
