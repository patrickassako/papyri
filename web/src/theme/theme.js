import { createTheme } from '@mui/material/styles';
import tokens from '../config/tokens';

const theme = createTheme({
  palette: {
    mode: 'light',
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
      default: tokens.colors.backgrounds.light,
      paper: tokens.colors.surfaces.light.default
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
    h3: {
      fontFamily: `${tokens.typography.families.display}, Georgia, serif`,
      fontSize: tokens.typography.scale.h3.rem,
      fontWeight: tokens.typography.scale.h3.weight,
      lineHeight: tokens.typography.scale.h3.lineHeight
    },
    body1: {
      fontSize: tokens.typography.scale.body.rem,
      fontWeight: tokens.typography.scale.body.weight,
      lineHeight: tokens.typography.scale.body.lineHeight
    },
    body2: {
      fontSize: tokens.typography.scale.bodySmall.rem,
      fontWeight: tokens.typography.scale.bodySmall.weight,
      lineHeight: tokens.typography.scale.bodySmall.lineHeight
    },
    caption: {
      fontSize: tokens.typography.scale.caption.rem,
      fontWeight: tokens.typography.scale.caption.weight,
      lineHeight: tokens.typography.scale.caption.lineHeight
    },
    button: {
      fontSize: tokens.typography.scale.button.rem,
      fontWeight: tokens.typography.scale.button.weight,
      textTransform: 'none'
    }
  },
  shape: {
    borderRadius: parseInt(tokens.shapes.borderRadius.cards)
  },
  spacing: 8, // base 8px
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: tokens.shapes.borderRadius.buttons,
          minHeight: '48px',
          paddingLeft: '24px',
          paddingRight: '24px'
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: tokens.shapes.borderRadius.cards
        }
      }
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: tokens.shapes.borderRadius.inputs
          }
        }
      }
    }
  }
});

export default theme;
