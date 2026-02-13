/**
 * Design Tokens Configuration (Web)
 * Re-exports shared design tokens with ES6 module syntax
 */

import colors from '../../../shared/tokens/colors.json';
import typography from '../../../shared/tokens/typography.json';
import spacing from '../../../shared/tokens/spacing.json';
import shapes from '../../../shared/tokens/shapes.json';

export default {
  colors,
  typography,
  spacing,
  shapes,
};

// Named exports for convenience
export { colors, typography, spacing, shapes };
