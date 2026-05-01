import { MD3LightTheme } from 'react-native-paper';

// Import shared design tokens via local bridge
const tokens = require('../config/tokens');

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
