// Design tokens - copied from shared folder for React Native compatibility
// Source of truth: ../../../shared/tokens/

const colors = require('./tokens/colors.json');
const typography = require('./tokens/typography.json');
const spacing = require('./tokens/spacing.json');
const shapes = require('./tokens/shapes.json');

// Export with safe defaults and helper structure
module.exports = {
  colors: {
    ...colors,
    // Add commonly used aliases for easier access
    text: {
      primary: colors.onSurface?.light || '#3D2B1F',
      secondary: colors.onSurface?.light || '#3D2B1F',
    }
  },
  typography: {
    ...typography,
    // Add helper properties for common patterns
    fontWeight: {
      regular: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
    fontSize: {
      xs: 12,
      sm: 14,
      base: 16,
      lg: 18,
      xl: 21,
      xxl: 26,
      display: 32,
    }
  },
  spacing,
  shapes,
};
