/**
 * 🎨 Theme Configuration
 * Ana tema export dosyası
 */

import { colors } from './colors';
import { typography } from './typography';
import { spacing, borderRadius, iconSize, layout } from './spacing';

export const theme = {
  colors,
  typography,
  spacing,
  borderRadius,
  iconSize,
  layout,
} as const;

export type Theme = typeof theme;

// Individual exports
export { colors } from './colors';
export { typography } from './typography';
export { spacing, borderRadius, iconSize, layout } from './spacing';
export { shadows } from './shadows';

// Type exports
export type { ColorKey, PrimaryColor, SecondaryColor } from './colors';
export type { TypographyStyle } from './typography';
export type { SpacingKey, BorderRadiusKey } from './spacing';

