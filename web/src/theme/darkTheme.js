import { createTheme } from '@mui/material/styles';
import tokens from '../../../shared/tokens';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: tokens.colors.primary,
      dark: tokens.colors.primaryDark,
      light: tokens.colors.primaryLight
    },
    secondary: {
      main: tokens.colors.secondary,
      light: tokens.colors.secondaryLight
    },
    background: {
      default: tokens.colors.backgrounds.dark,
      paper: tokens.colors.surfaces.dark.default
    },
    text: {
      primary: tokens.colors.onBackground.dark,
      secondary: tokens.colors.onSurface.dark
    },
    success: {
      main: tokens.colors.semantic.success
    },
    warning: {
      main: tokens.colors.semantic.warning
    },
    error: {
      main: tokens.colors.semantic.error
    },
    info: {
      main: tokens.colors.semantic.info
    }
  },
  typography: {
    fontFamily: `${tokens.typography.families.body}, -apple-system, sans-serif`,
    h1: {
      fontFamily: `${tokens.typography.families.display}, Georgia, serif`,
      fontSize: tokens.typography.scale.h1.rem,
      fontWeight: tokens.typography.scale.h1.weight,
      lineHeight: tokens.typography.scale.h1.lineHeight
    },
    h2: {
      fontFamily: `${tokens.typography.families.display}, Georgia, serif`,
      fontSize: tokens.typography.scale.h2.rem,
      fontWeight: tokens.typography.scale.h2.weight,
      lineHeight: tokens.typography.scale.h2.lineHeight
    },
    body1: {
      fontSize: tokens.typography.scale.body.rem,
      fontWeight: tokens.typography.scale.body.weight,
      lineHeight: tokens.typography.scale.body.lineHeight
    }
  },
  shape: {
    borderRadius: parseInt(tokens.shapes.borderRadius.cards)
  },
  spacing: 8
});

export default darkTheme;
